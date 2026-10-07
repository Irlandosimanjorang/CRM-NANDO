// Supabase Edge Function: admin-org-features (8 Okt 2026)
// Kelola saklar fitur per organisasi (kolom organizations.features) dari
// Command Center (kartu FITUR KLIEN). Hanya ADMIN_EMAIL - pola sama dengan
// admin-invoices. Kolom features dijaga trigger sehingga owner organisasi tidak
// bisa mengubahnya sendiri; function ini memakai service role.
//
// Body: { action: "list" }                                  -> organisasi + saklarnya
//       { action: "set", org_id, key, enabled }             -> nyalakan/matikan satu fitur
//       { action: "apply_preset", org_id, preset }           -> ganti seluruh saklar dengan isi preset
//       { action: "copy_features", org_id, from_org_id }     -> salin saklar dari organisasi lain
//       { action: "detail", org_id }                          -> ringkasan satu klien (paket, anggota, lead,
//                                                                pipeline, saklar, invoice, quotation)
//       { action: "apply_template", org_id, template }       -> terapkan template klien lengkap
//         template = { industry, features: [kunci...], stages: [{ key, label, hex, type }] }
//       { action: "backup_list", org_id }                     -> cadangan konfigurasi organisasi (terbaru dulu)
//       { action: "backup_create", org_id, label? }          -> buat cadangan sekarang
//       { action: "backup_restore", backup_id }               -> pulihkan pipeline + pengaturan dari cadangan
//
// Cadangan = konfigurasi saja (pipeline, industri, label field, saklar), bukan lead
// (tabel org_config_backups; fungsi snapshot_org_config / restore_org_config). apply_template
// membuat cadangan otomatis sebelum mengubah apa pun; pemulihan membuat cadangan
// pengaman dari kondisi sekarang dan ditolak kalau lead masih memakai tahap yang tidak
// ada di cadangan.
//
// apply_template: saklar fitur SELALU diterapkan. Pipeline + industri + label field
// kustom HANYA diterapkan kalau organisasi belum punya lead sama sekali (termasuk
// yang sudah dihapus); kalau sudah punya lead, mengganti pipeline bisa membuat lead
// kehilangan tahapnya, jadi hanya saklar yang berubah dan hasilnya dilaporkan.
//
// FEATURE_KEYS dan PRESETS harus sama dengan ORG_FEATURES dan ORG_PRESETS di
// src/lib/orgFeatures.js. Preset hanya mengatur saklar fitur, tidak menyentuh
// tahap pipeline atau field (itu milik tiap organisasi).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

const CORS = {
  "Access-Control-Allow-Origin": "https://nexto.site",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEATURE_KEYS = ["marketing_report", "lead_webhook"];
const PRESETS = {
  standar: [],
  marketing: ["marketing_report", "lead_webhook"],
  webhook: ["lead_webhook"],
};
const STAGE_KEY_RE = /^[a-z0-9_]{1,40}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const INDUSTRY_RE = /^[a-z0-9_]{2,40}$/;
const asFlags = (keys) => Object.fromEntries(keys.map((k) => [k, true]));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) return json({ error: "Hanya admin platform yang dapat mengelola fitur klien." }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const { data: orgs, error } = await admin.from("organizations")
        .select("id, name, plan, plan_expires_at, industry, owner_user_id, features, created_at")
        .order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      // Email owner (untuk membedakan organisasi yang namanya sama, mis. "Organisasi Saya").
      const ids = [...new Set((orgs || []).map((o) => o.owner_user_id).filter(Boolean))];
      const emails = new Map();
      for (let i = 0; i < ids.length; i += 20) {
        await Promise.all(ids.slice(i, i + 20).map(async (id) => {
          const { data } = await admin.auth.admin.getUserById(id);
          if (data?.user?.email) emails.set(id, data.user.email);
        }));
      }
      // Klien berbayar (8 Okt 2026): Enterprise tercatat di organisasi, Standard/Professional
      // di settings milik owner. Paket yang masa aktifnya sudah lewat tidak dihitung berbayar.
      const { data: sets } = await admin.from("settings").select("user_id, plan, plan_expires_at").in("user_id", ids);
      const setBy = new Map((sets || []).map((r) => [r.user_id, r]));
      const live = (iso) => !iso || new Date(iso).getTime() > Date.now();
      const effective = (o) => {
        if (o.plan === "enterprise" && live(o.plan_expires_at)) return "enterprise";
        const st = setBy.get(o.owner_user_id);
        if (st?.plan === "premium" && live(st.plan_expires_at)) return "professional";
        if (st?.plan === "standard" && live(st.plan_expires_at)) return "standard";
        return null;
      };
      return json({
        keys: FEATURE_KEYS,
        orgs: (orgs || []).map((o) => {
          const plan_effective = effective(o);
          return {
            id: o.id, name: o.name, plan: o.plan, plan_effective, paid: !!plan_effective, industry: o.industry, created_at: o.created_at,
            owner_email: emails.get(o.owner_user_id) || null, features: o.features || {},
          };
        }),
      });
    }

    if (body.action === "set") {
      if (!UUID_RE.test(String(body.org_id || ""))) return json({ error: "Organisasi tidak valid." }, 400);
      if (!FEATURE_KEYS.includes(body.key)) return json({ error: "Fitur tidak dikenal." }, 400);
      const { data: org, error } = await admin.from("organizations").select("id, features").eq("id", body.org_id).maybeSingle();
      if (error) throw error;
      if (!org) return json({ error: "Organisasi tidak ditemukan." }, 404);
      const next = { ...(org.features || {}) };
      if (body.enabled) next[body.key] = true; else delete next[body.key];
      const { error: upErr } = await admin.from("organizations").update({ features: next }).eq("id", org.id);
      if (upErr) throw upErr;
      console.log(`[admin-org-features] ${body.key}=${!!body.enabled} untuk org ${org.id} oleh ${userData.user.email}`);
      return json({ org_id: org.id, features: next });
    }

    if (body.action === "apply_preset") {
      if (!UUID_RE.test(String(body.org_id || ""))) return json({ error: "Organisasi tidak valid." }, 400);
      if (!Object.prototype.hasOwnProperty.call(PRESETS, body.preset)) return json({ error: "Preset tidak dikenal." }, 400);
      const next = asFlags(PRESETS[body.preset]);
      const { data: org, error } = await admin.from("organizations").update({ features: next }).eq("id", body.org_id).select("id").maybeSingle();
      if (error) throw error;
      if (!org) return json({ error: "Organisasi tidak ditemukan." }, 404);
      console.log(`[admin-org-features] preset ${body.preset} untuk org ${org.id} oleh ${userData.user.email}`);
      return json({ org_id: org.id, features: next });
    }

    if (body.action === "copy_features") {
      if (!UUID_RE.test(String(body.org_id || "")) || !UUID_RE.test(String(body.from_org_id || ""))) return json({ error: "Organisasi tidak valid." }, 400);
      if (body.org_id === body.from_org_id) return json({ error: "Pilih organisasi sumber yang berbeda." }, 400);
      const { data: src, error } = await admin.from("organizations").select("features").eq("id", body.from_org_id).maybeSingle();
      if (error) throw error;
      if (!src) return json({ error: "Organisasi sumber tidak ditemukan." }, 404);
      // Hanya kunci yang dikenal dan bernilai true yang disalin.
      const next = asFlags(FEATURE_KEYS.filter((k) => src.features?.[k] === true));
      const { data: org, error: upErr } = await admin.from("organizations").update({ features: next }).eq("id", body.org_id).select("id").maybeSingle();
      if (upErr) throw upErr;
      if (!org) return json({ error: "Organisasi tujuan tidak ditemukan." }, 404);
      console.log(`[admin-org-features] salin saklar dari ${body.from_org_id} ke ${org.id} oleh ${userData.user.email}`);
      return json({ org_id: org.id, features: next });
    }

    if (body.action === "detail") {
      if (!UUID_RE.test(String(body.org_id || ""))) return json({ error: "Organisasi tidak valid." }, 400);
      const { data: org, error } = await admin.from("organizations")
        .select("id, name, plan, plan_expires_at, member_limit, industry, custom_field_labels, features, owner_user_id, created_at")
        .eq("id", body.org_id).maybeSingle();
      if (error) throw error;
      if (!org) return json({ error: "Organisasi tidak ditemukan." }, 404);
      const [{ data: owner }, members, leadsLive, leadsAll, { data: stages }, { data: invs }, { data: quos }] = await Promise.all([
        admin.auth.admin.getUserById(org.owner_user_id),
        admin.from("organization_members").select("id", { count: "exact", head: true }).eq("org_id", org.id),
        admin.from("leads").select("id", { count: "exact", head: true }).eq("org_id", org.id).is("deleted_at", null),
        admin.from("leads").select("id", { count: "exact", head: true }).eq("org_id", org.id),
        admin.from("stages").select("key, label, hex, type, position").eq("org_id", org.id).order("position"),
        admin.from("admin_invoices").select("number, company, status, total, invoice_date, data").order("created_at", { ascending: false }).limit(300),
        admin.from("admin_quotations").select("number, company, status, total, invoice_date, data").order("created_at", { ascending: false }).limit(300),
      ]);
      const ownerEmail = (owner?.user?.email || "").toLowerCase();
      const mine = (r) => r.data?.activation?.org_id === org.id || (ownerEmail && String(r.data?.email || "").toLowerCase() === ownerEmail);
      const brief = (r) => ({ number: r.number, company: r.company, status: r.status, total: r.total, date: r.invoice_date });
      return json({
        org: {
          id: org.id, name: org.name, plan: org.plan, plan_expires_at: org.plan_expires_at, member_limit: org.member_limit,
          industry: org.industry, custom_field_labels: org.custom_field_labels || {}, features: org.features || {},
          owner_email: owner?.user?.email || null, created_at: org.created_at,
        },
        members: members.count || 0, leads: leadsLive.count || 0, leads_total: leadsAll.count || 0,
        stages: stages || [],
        invoices: (invs || []).filter(mine).map(brief),
        quotations: (quos || []).filter(mine).map(brief),
      });
    }

    if (body.action === "apply_template") {
      if (!UUID_RE.test(String(body.org_id || ""))) return json({ error: "Organisasi tidak valid." }, 400);
      const t = body.template || {};
      if (!INDUSTRY_RE.test(String(t.industry || ""))) return json({ error: "Industri template tidak valid." }, 400);
      const features = Array.isArray(t.features) ? t.features : [];
      if (!features.every((k) => FEATURE_KEYS.includes(k))) return json({ error: "Template memuat fitur yang tidak dikenal." }, 400);
      const stages = Array.isArray(t.stages) ? t.stages : [];
      if (stages.length < 2 || stages.length > 15) return json({ error: "Template harus punya 2 sampai 15 tahap pipeline." }, 400);
      const seen = new Set();
      for (const st of stages) {
        if (!STAGE_KEY_RE.test(String(st.key || "")) || seen.has(st.key)) return json({ error: "Kunci tahap pipeline tidak valid atau ganda." }, 400);
        seen.add(st.key);
        if (!String(st.label || "").trim() || String(st.label).length > 40) return json({ error: "Nama tahap pipeline tidak valid." }, 400);
        if (!HEX_RE.test(String(st.hex || ""))) return json({ error: "Warna tahap pipeline tidak valid." }, 400);
        if (!["normal", "won", "lost"].includes(st.type)) return json({ error: "Jenis tahap pipeline tidak valid." }, 400);
      }
      if (!stages.some((st) => st.type === "won")) return json({ error: "Pipeline harus punya minimal satu tahap Menang." }, 400);

      const { data: org, error } = await admin.from("organizations").select("id, owner_user_id").eq("id", body.org_id).maybeSingle();
      if (error) throw error;
      if (!org) return json({ error: "Organisasi tidak ditemukan." }, 404);
      const { count, error: cErr } = await admin.from("leads").select("id", { count: "exact", head: true }).eq("org_id", org.id);
      if (cErr) throw cErr;

      // Cadangan otomatis sebelum mengubah apa pun.
      const { data: backupId, error: bErr } = await admin.rpc("snapshot_org_config", { p_org_id: org.id, p_label: `otomatis sebelum template ${t.industry}` });
      if (bErr) throw bErr;

      const result = { org_id: org.id, features: asFlags(features), pipeline_applied: false, leads_total: count || 0, backup_id: backupId };
      if ((count || 0) === 0) {
        const { error: delErr } = await admin.from("stages").delete().eq("org_id", org.id);
        if (delErr) throw delErr;
        const rows = stages.map((st, i) => ({ user_id: org.owner_user_id, org_id: org.id, key: st.key, label: String(st.label).trim(), hex: st.hex, type: st.type, position: i }));
        const { error: insErr } = await admin.from("stages").insert(rows);
        if (insErr) throw insErr;
        const { error: upErr } = await admin.from("organizations").update({ industry: t.industry, custom_field_labels: {}, features: result.features }).eq("id", org.id);
        if (upErr) throw upErr;
        result.pipeline_applied = true;
        result.industry = t.industry;
      } else {
        const { error: upErr } = await admin.from("organizations").update({ features: result.features }).eq("id", org.id);
        if (upErr) throw upErr;
      }
      console.log(`[admin-org-features] template ${t.industry} untuk org ${org.id} (pipeline=${result.pipeline_applied}, leads=${count}) oleh ${userData.user.email}`);
      return json(result);
    }

    if (body.action === "backup_list") {
      if (!UUID_RE.test(String(body.org_id || ""))) return json({ error: "Organisasi tidak valid." }, 400);
      const { data, error } = await admin.from("org_config_backups").select("id, label, created_at, data").eq("org_id", body.org_id).order("created_at", { ascending: false }).limit(30);
      if (error) throw error;
      return json({
        backups: (data || []).map((b) => ({
          id: b.id, label: b.label, created_at: b.created_at,
          industry: b.data?.org?.industry || null, stages: (b.data?.stages || []).length, leads_total: b.data?.leads_total ?? null,
          features: b.data?.org?.features || {},
        })),
      });
    }

    if (body.action === "backup_create") {
      if (!UUID_RE.test(String(body.org_id || ""))) return json({ error: "Organisasi tidak valid." }, 400);
      const label = String(body.label || "").trim().slice(0, 200) || "manual";
      const { data: id, error } = await admin.rpc("snapshot_org_config", { p_org_id: body.org_id, p_label: label });
      if (error) throw error;
      console.log(`[admin-org-features] cadangan ${id} untuk org ${body.org_id} oleh ${userData.user.email}`);
      return json({ backup_id: id });
    }

    if (body.action === "backup_restore") {
      if (!UUID_RE.test(String(body.backup_id || ""))) return json({ error: "Cadangan tidak valid." }, 400);
      const { data, error } = await admin.rpc("restore_org_config", { p_backup_id: body.backup_id });
      // Penolakan yang disengaja (lead masih memakai tahap lain) dikirim apa adanya, bukan 500.
      if (error) return json({ error: String(error.message || "Gagal memulihkan cadangan.") }, 409);
      console.log(`[admin-org-features] pulihkan cadangan ${body.backup_id} oleh ${userData.user.email}`);
      return json(data);
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (e) {
    console.error("[admin-org-features]", String(e));
    return json({ error: String(e?.message || e) }, 500);
  }
});

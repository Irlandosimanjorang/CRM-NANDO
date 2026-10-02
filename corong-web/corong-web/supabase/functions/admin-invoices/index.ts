// Supabase Edge Function: admin-invoices (2 Okt 2026)
// Simpan, tampilkan, dan ubah status invoice langganan Nexto yang dibuat
// admin dari Command Center (kartu INVOICE). Hanya ADMIN_EMAIL - pola sama
// dengan admin-status. Tabel admin_invoices tidak punya policy RLS, jadi
// satu-satunya jalan akses ya lewat function ini (service role).
//
// Body: { action: "list" }
//       { action: "create", invoice: { company, invoice_date, due_date, total, data } }
//       { action: "set_status", id, status: "unpaid" | "paid" | "void" }
//       { action: "activation_preview", id, email?, plan? }  -> kondisi akun sekarang vs sesudah
//       { action: "activate", id, email?, plan? }            -> terapkan paket dari invoice Lunas
//         (plan hanya dipakai untuk invoice paket Custom: enterprise | professional | standard)
//       { action: "get_profile" } / { action: "save_profile", profile }
//                                                     -> data penagih (rekening, ttd, stempel)
//       { action: "check_email", email }              -> cek akun klien saat membuat invoice
//
// Aktivasi paket dari invoice (2 Okt 2026, permintaan Nando): Enterprise
// biasanya custom jumlah anggota (bukan 4 seperti di Mayar), jadi admin
// mengaktifkan langsung dari invoice yang sudah Lunas. Kolom yang diubah SAMA
// dengan mayar-webhook (plan, member_limit, plan_expires_at, reset reminder),
// jadi reminder H-3 & auto-downgrade check-plan-expiry tetap berjalan seperti
// biasa. Masa aktif = tanggal akhir periode di invoice, pukul 23:59:59 WIB.
// Satu invoice hanya bisa diaktifkan sekali (tercatat di data.activation).
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLAN_LABEL = { standard: "Standard", professional: "Professional", enterprise: "Enterprise" };
const PROFILE_KEYS = ["name", "address", "email", "phone", "bank", "account", "holder", "signName", "signTitle", "signImage", "stampImage"];
const MAX_PROFILE_BYTES = 1.5 * 1024 * 1024; // tanda tangan & stempel berupa data URL PNG
const wibToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const fmtWib = (iso) => new Date(iso).toLocaleString("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

async function findUserByEmail(admin, email) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    const hit = users.find((u) => (u.email || "").toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) return null;
  }
  return null;
}

// Kondisi sekarang & rencana perubahan untuk satu invoice - tidak mengubah
// apa pun. `problems` = alasan aktivasi ditolak; `warnings` = hal yang perlu
// diperhatikan admin sebelum konfirmasi.
async function planActivation(admin, id, emailOverride, planOverride) {
  const { data: inv, error } = await admin.from("admin_invoices").select("id, number, status, data").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!inv) return null;
  const d = inv.data || {};
  const problems = [];
  const warnings = [];
  // Invoice Custom (2 Okt 2026): harga/jumlah bebas, paket Nexto yang
  // diaktifkan dipilih admin (default dari isian invoice, lalu Enterprise).
  const plan = d.plan === "custom"
    ? (PLAN_LABEL[planOverride] ? planOverride : PLAN_LABEL[d.activatePlan] ? d.activatePlan : "enterprise")
    : d.plan;
  const seats = Math.max(1, Math.floor(Number(d.seats) || 1));
  const email = String(emailOverride || d.email || "").trim().toLowerCase();
  const expiresAt = DATE_RE.test(d.end || "") ? new Date(`${d.end}T23:59:59+07:00`).toISOString() : null;

  const out = {
    invoice: { id: inv.id, number: inv.number, status: inv.status, data: d },
    plan, planLabel: PLAN_LABEL[plan] || "Custom", seats, email, expires_at: expiresAt,
    user: null, org: null, current: null, problems, warnings,
  };

  if (d.activation) problems.push(`Invoice ini sudah diaktifkan pada ${fmtWib(d.activation.at)}.`);
  if (inv.status !== "paid") problems.push("Paket hanya dapat diaktifkan dari invoice berstatus Lunas.");
  if (!PLAN_LABEL[plan]) problems.push("Paket pada invoice ini tidak dikenali, sehingga tidak dapat diaktifkan otomatis.");
  if (!expiresAt) problems.push("Periode langganan di invoice tidak valid.");
  else if (new Date(expiresAt).getTime() <= Date.now()) problems.push("Periode langganan di invoice sudah berakhir.");
  if (problems.length) return out;
  if (!email) { problems.push("Invoice tidak memiliki email klien. Isi email akun owner klien."); return out; }
  if (!EMAIL_RE.test(email)) { problems.push("Format email tidak valid."); return out; }

  const user = await findUserByEmail(admin, email);
  if (!user) { problems.push(`Belum ada akun Nexto dengan email ${email}. Minta klien mendaftar dengan email ini terlebih dahulu.`); return out; }
  out.user = { id: user.id, email: user.email };
  if (ADMIN_EMAIL && email === ADMIN_EMAIL.toLowerCase()) warnings.push("Ini akun admin Anda sendiri, bukan akun klien. Paket di akun ini akan ikut berubah.");

  if (plan === "enterprise") {
    const { data: org, error: orgErr } = await admin.from("organizations").select("id, name, plan, member_limit, plan_expires_at")
      .eq("owner_user_id", user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (orgErr) throw orgErr;
    if (!org) {
      const { data: m } = await admin.from("organization_members").select("org_id").eq("user_id", user.id).limit(1).maybeSingle();
      problems.push(m
        ? `${email} terdaftar sebagai anggota tim organisasi lain, bukan owner. Paket Enterprise diaktifkan ke akun owner.`
        : `Organisasi untuk ${email} belum terbentuk. Minta klien masuk ke Nexto sekali, lalu coba lagi.`);
      return out;
    }
    const { count, error: cErr } = await admin.from("organization_members").select("id", { count: "exact", head: true }).eq("org_id", org.id);
    if (cErr) throw cErr;
    out.org = { ...org, members: count || 0 };
    if ((count || 0) > seats) problems.push(`Organisasi ini sudah memiliki ${count} anggota, lebih banyak dari ${seats} anggota di invoice.`);
    if (org.plan === "enterprise" && !org.plan_expires_at) {
      warnings.push("Enterprise organisasi ini saat ini TANPA batas waktu. Setelah diaktifkan, masa aktifnya berakhir sesuai tanggal di invoice dan organisasi turun ke Free otomatis setelahnya.");
    }
    if (org.plan === "enterprise" && org.plan_expires_at && new Date(org.plan_expires_at) > new Date(expiresAt)) {
      warnings.push(`Masa aktif Enterprise saat ini (${fmtWib(org.plan_expires_at)}) lebih panjang dari periode invoice dan akan diganti dengan tanggal di invoice.`);
    }
  } else {
    const { data: st, error: sErr } = await admin.from("settings").select("plan, plan_expires_at").eq("user_id", user.id).maybeSingle();
    if (sErr) throw sErr;
    if (!st) { problems.push(`Akun ${email} belum pernah masuk ke Nexto. Minta klien masuk sekali, lalu coba lagi.`); return out; }
    out.current = st;
    if (seats > 1) warnings.push(`Paket ${PLAN_LABEL[plan]} berlaku per akun. Hanya akun ${email} yang diaktifkan; ${seats - 1} pengguna lainnya diaktifkan dari invoice masing-masing.`);
    if (st.plan && !st.plan_expires_at) {
      warnings.push("Paket akun ini saat ini TANPA batas waktu. Setelah diaktifkan, masa aktifnya berakhir sesuai tanggal di invoice dan akun turun ke Free otomatis setelahnya.");
    }
    if (st.plan && st.plan_expires_at && new Date(st.plan_expires_at) > new Date(expiresAt)) {
      warnings.push(`Masa aktif paket saat ini (${fmtWib(st.plan_expires_at)}) lebih panjang dari periode invoice dan akan diganti dengan tanggal di invoice.`);
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    if (!ADMIN_EMAIL || userData.user.email !== ADMIN_EMAIL) return json({ error: "Hanya admin platform yang dapat mengelola invoice." }, 403);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));

    if (body.action === "list") {
      const { data, error } = await admin
        .from("admin_invoices")
        .select("id, number, company, invoice_date, due_date, total, status, paid_at, data, created_at")
        .order("year", { ascending: false })
        .order("seq", { ascending: false })
        .limit(300);
      if (error) throw error;
      return json({ invoices: data || [] });
    }

    if (body.action === "create") {
      const inv = body.invoice || {};
      const company = String(inv.company || "").trim().slice(0, 200);
      if (!company) return json({ error: "Nama perusahaan wajib diisi." }, 400);
      if (!DATE_RE.test(inv.invoice_date || "") || !DATE_RE.test(inv.due_date || "")) return json({ error: "Tanggal invoice atau jatuh tempo tidak valid." }, 400);
      const total = Number(inv.total);
      if (!Number.isFinite(total) || total < 0) return json({ error: "Total tidak valid." }, 400);
      const data = { ...(inv.data || {}) };
      delete data.activation; // hanya boleh diisi oleh aksi "activate"
      const { data: row, error } = await admin.rpc("create_admin_invoice", {
        p_company: company, p_invoice_date: inv.invoice_date, p_due_date: inv.due_date, p_total: total, p_data: data,
      });
      if (error) throw error;
      return json({ invoice: row });
    }

    if (body.action === "set_status") {
      if (!["unpaid", "paid", "void"].includes(body.status)) return json({ error: "Status tidak valid." }, 400);
      const { data: cur } = await admin.from("admin_invoices").select("status, data").eq("id", body.id).maybeSingle();
      if (!cur) return json({ error: "Invoice tidak ditemukan." }, 404);
      if (cur.data?.activation && body.status !== "paid") return json({ error: "Paket dari invoice ini sudah diaktifkan, jadi statusnya tetap Lunas. Ubah paket klien secara manual bila perlu." }, 409);
      // Tanggal lunas (2 Okt 2026): admin mengisi tanggal uang benar-benar
      // masuk (bukan waktu klik). Disimpan pukul 12.00 WIB supaya tanggalnya
      // tidak bergeser karena zona waktu. Tanpa paid_date = hari ini.
      let paidAt = null;
      if (body.status === "paid") {
        const pd = body.paid_date || wibToday();
        if (!DATE_RE.test(pd)) return json({ error: "Tanggal pembayaran tidak valid." }, 400);
        if (pd > wibToday()) return json({ error: "Tanggal pembayaran tidak boleh di masa depan." }, 400);
        paidAt = new Date(`${pd}T12:00:00+07:00`).toISOString();
      }
      const patch = { status: body.status, paid_at: paidAt };
      const { data, error } = await admin.from("admin_invoices").update(patch).eq("id", body.id).select("id, status, paid_at").maybeSingle();
      if (error) throw error;
      return json({ invoice: data });
    }

    if (body.action === "activation_preview") {
      const p = await planActivation(admin, body.id, body.email, body.plan);
      if (!p) return json({ error: "Invoice tidak ditemukan." }, 404);
      delete p.invoice.data;
      return json({ preview: p });
    }

    if (body.action === "activate") {
      const p = await planActivation(admin, body.id, body.email, body.plan);
      if (!p) return json({ error: "Invoice tidak ditemukan." }, 404);
      if (p.problems.length) return json({ error: p.problems[0] }, 409);

      // Kunci invoice dulu (hanya jika masih Lunas & belum pernah diaktifkan)
      // supaya klik ganda / dua tab tidak menerapkan paket dua kali.
      const before = p.invoice.data;
      const activation = {
        at: new Date().toISOString(), by: userData.user.email, user_id: p.user.id, email: p.user.email,
        plan: p.plan, seats: p.seats, expires_at: p.expires_at, org_id: p.org?.id || null, org_name: p.org?.name || null,
      };
      const after = { ...before, activation };
      const { data: locked, error: lockErr } = await admin.from("admin_invoices")
        .update({ data: after })
        .eq("id", body.id).eq("status", "paid").is("data->activation", null)
        .select("id").maybeSingle();
      if (lockErr) throw lockErr;
      if (!locked) return json({ error: "Invoice ini baru saja diaktifkan atau statusnya berubah. Muat ulang riwayat invoice." }, 409);

      const { error: applyErr } = p.plan === "enterprise"
        ? await admin.from("organizations").update({ plan: "enterprise", member_limit: p.seats, plan_expires_at: p.expires_at, plan_expiry_reminder_sent_at: null }).eq("id", p.org.id)
        : await admin.from("settings").update({ plan: p.plan === "professional" ? "premium" : "standard", plan_expires_at: p.expires_at, plan_expiry_reminder_sent_at: null }).eq("user_id", p.user.id);
      if (applyErr) {
        // Gagal menerapkan -> lepas kunci supaya bisa dicoba lagi.
        await admin.from("admin_invoices").update({ data: before }).eq("id", body.id);
        throw applyErr;
      }
      console.log(`[admin-invoices] ${p.invoice.number} diaktifkan: ${p.plan} x${p.seats} untuk ${p.user.email}${p.org ? ` (org ${p.org.id})` : ""}, s.d. ${p.expires_at}`);
      return json({ invoice: { id: body.id, data: after }, activation });
    }

    if (body.action === "get_profile") {
      const { data, error } = await admin.from("admin_settings").select("value, updated_at").eq("key", "invoice_seller").maybeSingle();
      if (error) throw error;
      return json({ profile: data?.value || null, updated_at: data?.updated_at || null });
    }

    if (body.action === "save_profile") {
      const src = body.profile || {};
      const profile = {};
      for (const k of PROFILE_KEYS) profile[k] = typeof src[k] === "string" ? src[k] : "";
      for (const k of ["signImage", "stampImage"]) if (profile[k] && !profile[k].startsWith("data:image/")) profile[k] = "";
      if (JSON.stringify(profile).length > MAX_PROFILE_BYTES) return json({ error: "Gambar tanda tangan/stempel terlalu besar. Unggah ulang dengan ukuran lebih kecil." }, 413);
      const updated_at = new Date().toISOString();
      const { error } = await admin.from("admin_settings").upsert({ key: "invoice_seller", value: profile, updated_at });
      if (error) throw error;
      return json({ ok: true, updated_at });
    }

    if (body.action === "check_email") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return json({ found: false, invalid: true });
      const user = await findUserByEmail(admin, email);
      if (!user) return json({ found: false });
      const { data: m } = await admin.from("organization_members").select("org_id, role").eq("user_id", user.id).limit(1).maybeSingle();
      const { data: org } = m ? await admin.from("organizations").select("name, plan, plan_expires_at").eq("id", m.org_id).maybeSingle() : { data: null };
      const { data: st } = await admin.from("settings").select("plan, plan_expires_at").eq("user_id", user.id).maybeSingle();
      // Masa aktif paket yang berjalan (untuk menyarankan tanggal mulai invoice perpanjangan).
      const expires_at = org?.plan === "enterprise" ? org.plan_expires_at : (st?.plan ? st.plan_expires_at : null);
      return json({ found: true, role: m?.role || null, org_name: org?.name || null, org_plan: org?.plan || null, expires_at: expires_at || null });
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (e) {
    console.error("[admin-invoices]", String(e));
    return json({ error: String(e?.message || e) }, 500);
  }
});

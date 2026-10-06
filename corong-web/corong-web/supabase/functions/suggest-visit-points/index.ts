// Supabase Edge Function: suggest-visit-points
// "Poin Diskusi (AI)" - pas rep mau atur visit/meeting ke suatu lead, AI baca
// histori progress notes lead itu terus nyaranin 3-5 poin yang perlu
// didiskusikan/disampein pas ketemu, biar rep gak dateng modal kosong.
//
// Standard ke atas, 10x/bulan WIB per user (admin platform bebas kuota).
// Pakai org_memory (pola objection/playbook org) sebagai konteks tambahan.
//
// === AUDIT (30 Sep 2026) ===
// Kuota sebelumnya kepotong walau lead belum punya catatan, AI gagal, atau AI
// gak ngasih poin - sekarang dikembalikan di semua jalur gagal itu. Pesan ke
// user & gaya poin pakai bahasa baku.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// Kuota bulanan berlaku 1 bulan sejak pemakaian pertama (6 Okt 2026, tabel
// quota_periods) - bukan lagi reset tiap tanggal 1. reserve_edge_function_call
// menghitung periodenya sendiri; helper ini untuk menampilkan tanggal terisi
// kembali di pesan kuota habis.
async function quotaRefillText(admin, userId, feature) {
  try {
    const { data } = await admin.rpc("quota_usage", { p_user_id: userId, p_feature: feature });
    if (data?.reset_at) return `Kuota terisi kembali pada ${new Date(data.reset_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}.`;
  } catch (_) { /* pesan tanpa tanggal */ }
  return "Kuota terisi kembali 1 bulan setelah pemakaian pertama.";
}

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

const cors = { "Access-Control-Allow-Origin": "https://nexto.site", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

// Balikin id reservasi (buat di-release kalau gagal), atau null kalau kuota habis.
async function reserveMonthly(admin, userId, functionName, maxCalls) {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const wibNow = new Date(Date.now() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  const windowStart = new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS).toISOString();
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: windowStart, p_max_calls: maxCalls });
  if (error) { console.error("[suggest-visit-points] reserve_edge_function_call gagal:", error); return null; }
  return data || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let admin = null;
  let reservationId = null;
  const releaseQuota = async () => {
    if (!admin || !reservationId) return;
    try { await admin.rpc("release_edge_function_call", { p_id: reservationId }); } catch (_) { /* best effort */ }
    reservationId = null;
  };
  try {
    const { lead_id } = await req.json();
    if (!lead_id) return new Response(JSON.stringify({ error: "lead_id wajib diisi" }), { status: 400, headers: cors });

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
    const userId = userData.user.id;
    const isAdmin = !!ADMIN_EMAIL && userData.user.email === ADMIN_EMAIL;

    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: settingsRow } = await admin.from("settings").select("plan").eq("user_id", userId).maybeSingle();
    const { data: memberRow } = await admin.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
    let orgPlan = null;
    if (memberRow) {
      const { data: org } = await admin.from("organizations").select("plan").eq("id", memberRow.org_id).maybeSingle();
      orgPlan = org?.plan;
    }
    const PLAN_LEVEL = { free: 0, standard: 1, premium: 2 };
    const myPlanLevel = orgPlan === "enterprise" ? 2 : (PLAN_LEVEL[settingsRow?.plan] ?? 0);
    if (!isAdmin && myPlanLevel < 1) {
      return new Response(JSON.stringify({ error: "Poin Diskusi (AI) tersedia untuk paket Standard ke atas. Silakan upgrade melalui tab Pengaturan." }), { status: 403, headers: cors });
    }

    // Cek lead & catatan DULU sebelum motong kuota.
    const { data: lead, error: leadErr } = await supabase.from("leads").select("*, progress_notes(id, note_date, text)").eq("id", lead_id).single();
    if (leadErr || !lead) return new Response(JSON.stringify({ error: "Lead tidak ditemukan" }), { status: 404, headers: cors });

    const notes = (lead.progress_notes || [])
      .slice(-8)
      .map((p) => `${p.note_date}: ${(p.text || "").slice(0, 200)}`);

    if (notes.length === 0) {
      return new Response(JSON.stringify({ error: "Lead ini belum memiliki catatan progress. AI membutuhkan riwayat untuk menyarankan poin diskusi - silakan isi manual terlebih dahulu." }), { status: 200, headers: cors });
    }

    if (!isAdmin) {
      reservationId = await reserveMonthly(admin, userId, "suggest-visit-points", 10);
      if (!reservationId) {
        return new Response(JSON.stringify({ error: `Kuota Poin Diskusi (10x per bulan) sudah terpakai. ${await quotaRefillText(admin, userId, "suggest-visit-points")} Anda juga dapat mengisinya secara manual.` }), { status: 429, headers: cors });
      }
    }

    let orgMemoryBlock = "";
    try {
      if (memberRow) {
        const { data: mem } = await admin.from("org_memory").select("ideal_customer_profile, common_objections, winning_playbook").eq("org_id", memberRow.org_id).maybeSingle();
        if (mem) {
          const objectionsArr = Array.isArray(mem.common_objections) ? mem.common_objections : [];
          const playbookArr = Array.isArray(mem.winning_playbook) ? mem.winning_playbook : [];
          const objections = objectionsArr.map((o) => `"${o?.objection}" -> ${o?.how_to_handle}`).join("; ");
          const playbook = playbookArr.join("; ");
          orgMemoryBlock = `\nPENGETAHUAN DARI HISTORI DEAL LAIN DI ORG INI (dipake buat konteks TAMBAHAN, tetep prioritasin isi progress notes lead ini di atas):\n${mem.ideal_customer_profile ? `- Ideal customer profile: ${mem.ideal_customer_profile}\n` : ""}${objections ? `- Objection yang sering muncul & cara ngatasin yang kebukti berhasil: ${objections}\n` : ""}${playbook ? `- Taktik yang kebukti berhasil di deal lain: ${playbook}\n` : ""}`;
        }
      }
    } catch (memErr) {
      console.log("[suggest-visit-points] gagal baca org_memory, lanjut tanpa konteks itu:", String(memErr));
      orgMemoryBlock = "";
    }

    const stateNote = lead.customer_state?.state_reason ? `Customer state saat ini: ${lead.customer_state.state_reason}.` : "";
    const prompt = `Kamu asisten sales berpengalaman. Sales rep mau visit/meeting ke lead berikut. Baca histori progress notes-nya, terus saranin 3-5 poin SPESIFIK yang perlu didiskusikan/disampein pas ketemu nanti - biar rep gak dateng modal kosong dan langsung nyambung ke konteks terakhir.

Lead: ${lead.name}
Produk/kebutuhan: ${lead.product || "-"}
Tahap saat ini: ${lead.stage_key || "-"}
Next action yang tercatat: ${lead.next_action || "-"}
${stateNote}
${lead.visit_meet ? `Bakal ketemu: ${lead.visit_meet}` : ""}
${orgMemoryBlock}
Progress notes (terbaru di bawah):
${notes.join("\n")}

ATURAN:
- Poin harus SPESIFIK berdasar isi notes di atas (misal follow-up soal harga yang pernah dibahas, objection yang perlu dijawab, next step yang perlu didorong) - JANGAN generik kayak "tanya kabar" atau "perkenalan".
- Tiap poin 1 kalimat pendek, actionable, dalam Bahasa Indonesia baku yang profesional (jangan pakai bahasa gaul seperti "gak", "udah").
- Kalau dari notes keliatan ada objection/keberatan yang belum terjawab, WAJIB jadi salah satu poin - kalau objection itu MIRIP sama yang ada di "pengetahuan dari histori deal lain", pake cara ngatasin yang udah kebukti berhasil itu.
- Kalau dari notes keliatan udah deket closing, WAJIB ada poin yang ngarah ke closing/next step konkret.

Balas HANYA JSON, tanpa markdown: {"points":["...","...","..."]}`;

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-5-5", max_tokens: 700, thinking: { type: "between_tools" }, output_config: { effort: "medium" }, messages: [{ role: "user", content: prompt }] }),
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.log("[suggest-visit-points] AI gagal, status", resp.status, errText.slice(0, 300));
      await releaseQuota();
      return new Response(JSON.stringify({ error: "AI gagal menyiapkan poin diskusi. Kuota Anda tidak terpakai, silakan coba lagi sebentar." }), { status: 500, headers: cors });
    }
    const dat = await resp.json();
    const t = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    let obj = {};
    const x = t.replace(/```json/gi, "").replace(/```/g, "").trim();
    const a = x.indexOf("{"); const e = x.lastIndexOf("}");
    if (a !== -1 && e !== -1) { try { obj = JSON.parse(x.slice(a, e + 1)); } catch (_) {} }

    const points = Array.isArray(obj.points) ? obj.points.filter((p) => typeof p === "string" && p.trim()).slice(0, 5) : [];
    if (points.length === 0) {
      await releaseQuota();
      return new Response(JSON.stringify({ error: "AI belum berhasil menyiapkan poin yang jelas. Kuota Anda tidak terpakai, silakan coba lagi." }), { status: 200, headers: cors });
    }

    return new Response(JSON.stringify({ ok: true, points }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    await releaseQuota();
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});

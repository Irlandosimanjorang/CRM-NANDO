// Supabase Edge Function: verify-selfie-photo
// Dipanggil dari PhotoCheckinModal (Visit & Follow-up) SEBELUM check-in
// GPS beneran kesimpen. Foto dikirim ke Claude Vision, ditanya apa isinya
// beneran ada WAJAH orang atau bukan (foto struk/galeri gak lolos).
//
// Riwayat (detail di versi sebelumnya): v2 wajib WAJAH (bukan cuma tangan),
// fail-open kalau layanan verifikasi sendiri gagal (diputuskan di client),
// rate limit 60x/bulan WIB per user (atomic via reserve_edge_function_call),
// photo_url wajib dari storage project ini (anti SSRF), plan gate Enterprise
// di server, model Sonnet 5.5.
//
// === BAHASA BAKU (1 Okt 2026) === Pesan ke user & alasan dari AI (yang
// tampil di layar sales) pakai bahasa baku. Kuota dikembalikan kalau AI gagal.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

// Base64-encode CHUNKED - foto beberapa MB bakal bikin
// String.fromCharCode(...buf) meledak ("Maximum call stack size exceeded")
// kalau di-spread sekaligus, jadi diproses per-chunk kecil.
function bufferToBase64(buf) {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < buf.length; i += chunkSize) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

// Balikin id reservasi (buat dikembalikan kalau gagal) atau null kalau kuota habis.
async function reserveMonthly(admin, userId, functionName, maxCalls) {
  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const wibNow = new Date(Date.now() + WIB_OFFSET_MS);
  const y = wibNow.getUTCFullYear(), m = wibNow.getUTCMonth();
  const windowStart = new Date(Date.UTC(y, m, 1, 0, 0, 0) - WIB_OFFSET_MS).toISOString();
  const { data, error } = await admin.rpc("reserve_edge_function_call", { p_user_id: userId, p_function_name: functionName, p_window_start: windowStart, p_max_calls: maxCalls });
  if (error) { console.error("[verify-selfie-photo] reserve_edge_function_call gagal:", error); return null; }
  return data || null;
}

async function isEnterpriseUser(admin, userId) {
  const { data: memberRow } = await admin.from("organization_members").select("org_id").eq("user_id", userId).limit(1).maybeSingle();
  if (!memberRow?.org_id) return false;
  const { data: orgRow } = await admin.from("organizations").select("plan").eq("id", memberRow.org_id).maybeSingle();
  return orgRow?.plan === "enterprise";
}

Deno.serve(async (req) => {
  const cors = {
    "Access-Control-Allow-Origin": "https://nexto.site",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  let admin = null;
  let reservationId = null;
  const releaseQuota = async () => {
    if (!admin || !reservationId) return;
    try { await admin.rpc("release_edge_function_call", { p_id: reservationId }); } catch (_) { /* best effort */ }
    reservationId = null;
  };

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: cors });
    const userId = userData.user.id;

    const { photo_url } = await req.json();
    if (!photo_url) return new Response(JSON.stringify({ error: "Foto belum dilampirkan." }), { status: 400, headers: cors });

    // Batesin photo_url cuma boleh dari storage Supabase project ini sendiri -
    // jangan sampe function ini jadi proxy fetch alamat sembarang (SSRF-adjacent).
    if (!photo_url.startsWith(`${SUPABASE_URL}/storage/`)) {
      return new Response(JSON.stringify({ error: "Foto harus diunggah melalui Nexto." }), { status: 400, headers: cors });
    }

    admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // PLAN GATE - GPS Check-in itu Enterprise-only, dicek juga di server.
    if (!(await isEnterpriseUser(admin, userId))) {
      return new Response(JSON.stringify({ error: "Verifikasi foto check-in tersedia khusus paket Enterprise." }), { status: 403, headers: cors });
    }

    // RATE LIMIT - 60x/bulan kalender WIB per user.
    reservationId = await reserveMonthly(admin, userId, "verify-selfie-photo", 60);
    if (!reservationId) {
      return new Response(JSON.stringify({ error: "Kuota verifikasi foto (60x/bulan) sudah terpakai. Silakan coba lagi bulan depan." }), { status: 429, headers: cors });
    }

    const imgResp = await fetch(photo_url);
    if (!imgResp.ok) {
      await releaseQuota();
      return new Response(JSON.stringify({ error: "Gagal mengambil foto dari penyimpanan." }), { status: 502, headers: cors });
    }
    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    const buf = new Uint8Array(await imgResp.arrayBuffer());

    // Foto >8MB gak dikirim ke AI (kemungkinan bukan foto HP biasa) - dilewati.
    if (buf.length > 8 * 1024 * 1024) {
      await releaseQuota();
      return new Response(JSON.stringify({ isSelfie: true, reason: "Ukuran foto terlalu besar untuk diperiksa otomatis, pemeriksaan dilewati." }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const base64 = bufferToBase64(buf);

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 250,
        thinking: { type: "between_tools" },
        output_config: { effort: "low" },
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: contentType, data: base64 } },
            {
              type: "text",
              text: `Ini foto bukti check-in kunjungan sales ke lokasi customer, wajib selfie.\n\nTugas kamu: tentuin apakah di foto ini ADA WAJAH MANUSIA yang KELIATAN JELAS (mata/hidung/mulut kebaca, walau dari samping/sebagian, gak harus sempurna) - jawab true CUMA kalau wajah beneran kelihatan.\n\nJawab FALSE kalau: gak ada wajah sama sekali (foto struk/nota, foto layar HP/komputer, foto barang, foto tembok/ruangan kosong), foto CUMA nunjukkin bagian tubuh lain TANPA wajah (tangan/jari/lengan doang megang sesuatu, punggung/belakang kepala doang), foto terlalu gelap/blur sampe wajahnya gak kebaca sama sekali, atau foto random dari galeri/internet yang gak ada kaitannya sama sekali.\n\nAlasan ditampilkan ke sales - tulis dalam Bahasa Indonesia baku yang sopan, 1 kalimat.\n\nBalas HANYA dengan JSON persis format ini, tanpa markdown, tanpa penjelasan tambahan:\n{"is_person": true, "reason": "alasan singkat 1 kalimat"}\n\natau\n\n{"is_person": false, "reason": "alasan singkat 1 kalimat mengapa wajah tidak terlihat/tidak ada"}`,
            },
          ],
        }],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.log("[verify-selfie-photo] Claude API error:", resp.status, errText.slice(0, 300));
      await releaseQuota();
      return new Response(JSON.stringify({ error: "Verifikasi foto gagal diproses." }), { status: 502, headers: cors });
    }

    const dat = await resp.json();
    const text = (dat.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let parsed = null;
    try {
      const x = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      const a = x.indexOf("{"); const e = x.lastIndexOf("}");
      if (a !== -1 && e !== -1) parsed = JSON.parse(x.slice(a, e + 1));
    } catch (_) {}

    if (!parsed || typeof parsed.is_person !== "boolean") {
      console.log("[verify-selfie-photo] gagal parse respons AI:", text.slice(0, 200));
      // Fail-open: ketidakpastian TEKNIS jangan sampai memblokir check-in yang mungkin sah.
      return new Response(JSON.stringify({ isSelfie: true, reason: "AI belum memberikan jawaban yang jelas, pemeriksaan dilewati." }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ isSelfie: parsed.is_person, reason: (parsed.reason || "").slice(0, 200) }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.log("[verify-selfie-photo] EXCEPTION:", String(e));
    await releaseQuota();
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors });
  }
});

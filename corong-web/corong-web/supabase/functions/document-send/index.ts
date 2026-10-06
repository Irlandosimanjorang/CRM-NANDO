// Supabase Edge Function: document-send (7 Okt 2026)
// Kirim Quotation/Invoice yang SUDAH TERBIT ke email customer. Pengirim harus
// anggota organisasi dokumen itu (pembuat atau owner/manager) dengan paket
// Professional/Enterprise. Setiap pengiriman dicatat di documents.email_log.
// Batas: 5 kali per dokumen per 24 jam, 30 kali per pengguna per jam.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { renderDocumentEmail, documentSubject, sendEmail } from "./document_email.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Sesi tidak valid. Silakan masuk kembali." }, 401);
    const uid = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const id = String(body.id || "");
    const to = String(body.to || "").trim().toLowerCase();
    const message = String(body.message || "").slice(0, 1000);
    if (!EMAIL_RE.test(to)) return json({ error: "Alamat email tujuan tidak valid." }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: doc, error } = await admin.from("documents").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!doc || !doc.issued_at) return json({ error: "Dokumen belum diterbitkan atau tidak ditemukan." }, 404);

    // Akses: anggota org dokumen, pembuat atau owner/manager, paket Pro/Enterprise.
    const { data: member } = await admin.from("organization_members").select("role").eq("org_id", doc.org_id).eq("user_id", uid).maybeSingle();
    if (!member) return json({ error: "Anda tidak memiliki akses ke dokumen ini." }, 403);
    if (!(["owner", "manager"].includes(member.role) || doc.user_id === uid)) return json({ error: "Anda tidak memiliki akses ke dokumen ini." }, 403);
    const [{ data: org }, { data: st }] = await Promise.all([
      admin.from("organizations").select("plan").eq("id", doc.org_id).maybeSingle(),
      admin.from("settings").select("plan").eq("user_id", uid).maybeSingle(),
    ]);
    if (!(org?.plan === "enterprise" || st?.plan === "premium")) return json({ error: "Fitur dokumen tersedia untuk paket Professional dan Enterprise." }, 403);
    if (doc.status === "void" || doc.status === "draft") return json({ error: "Dokumen ini tidak bisa dikirim." }, 400);

    const log = Array.isArray(doc.email_log) ? doc.email_log : [];
    const dayAgo = Date.now() - 24 * 3600000;
    if (log.filter((e) => new Date(e.at).getTime() > dayAgo).length >= 5) return json({ error: "Dokumen ini sudah dikirim 5 kali dalam 24 jam terakhir. Coba lagi besok." }, 429);
    const hourStart = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
    const { data: slot } = await admin.rpc("reserve_edge_function_call", { p_user_id: uid, p_function_name: "document-send", p_window_start: hourStart, p_max_calls: 30 });
    if (!slot) return json({ error: "Terlalu banyak email dikirim dalam satu jam. Coba lagi nanti." }, 429);

    const seller = doc.snapshot?.seller || {};
    const accent = doc.snapshot?.accent || "#c2410c";
    const kind = doc.kind === "quotation" ? "quotation" : "invoice";
    try {
      await sendEmail({
        apiKey: RESEND_API_KEY, to,
        subject: documentSubject(kind, doc, seller),
        html: renderDocumentEmail(kind, doc, seller, accent, message),
        replyTo: seller.email || userData.user.email, bcc: seller.email || userData.user.email, fromName: seller.name,
      });
    } catch (e) {
      await admin.rpc("release_edge_function_call", { p_id: slot });
      throw e;
    }
    const entry = { type: kind, to, at: new Date().toISOString(), by: uid };
    await admin.from("documents").update({ email_log: [...log, entry] }).eq("id", doc.id);
    return json({ ok: true, entry });
  } catch (e) {
    console.error("[document-send]", String(e));
    return json({ error: String((e as Error)?.message || e).slice(0, 200) }, 500);
  }
});

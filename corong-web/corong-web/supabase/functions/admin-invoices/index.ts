// Supabase Edge Function: admin-invoices (2 Okt 2026)
// Simpan, tampilkan, dan ubah status invoice langganan Nexto yang dibuat
// admin dari Command Center (kartu INVOICE). Hanya ADMIN_EMAIL - pola sama
// dengan admin-status. Tabel admin_invoices tidak punya policy RLS, jadi
// satu-satunya jalan akses ya lewat function ini (service role).
//
// Body: { action: "list" }
//       { action: "create", invoice: { company, invoice_date, due_date, total, data } }
//       { action: "set_status", id, status: "unpaid" | "paid" | "void" }
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
      const { data, error } = await admin.rpc("create_admin_invoice", {
        p_company: company, p_invoice_date: inv.invoice_date, p_due_date: inv.due_date, p_total: total, p_data: inv.data || {},
      });
      if (error) throw error;
      return json({ invoice: data });
    }

    if (body.action === "set_status") {
      if (!["unpaid", "paid", "void"].includes(body.status)) return json({ error: "Status tidak valid." }, 400);
      const patch = { status: body.status, paid_at: body.status === "paid" ? new Date().toISOString() : null };
      const { data, error } = await admin.from("admin_invoices").update(patch).eq("id", body.id).select("id, status, paid_at").maybeSingle();
      if (error) throw error;
      if (!data) return json({ error: "Invoice tidak ditemukan." }, 404);
      return json({ invoice: data });
    }

    return json({ error: "Aksi tidak dikenal." }, 400);
  } catch (e) {
    console.error("[admin-invoices]", String(e));
    return json({ error: String(e?.message || e) }, 500);
  }
});

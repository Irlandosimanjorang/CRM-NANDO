// Halaman invoice untuk klien (2 Okt 2026): nexto.site/invoice?t=<token>.
// Dibuka dari tombol "Lihat & unduh invoice" di email - tanpa login. Isi
// dokumen dirender dengan buildInvoiceHtml yang sama dengan PDF admin, jadi
// tampilannya identik.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { buildInvoiceHtml } from "../components/EnterpriseInvoicePanel";
import { printHtml } from "../lib/docKit";

export default function InvoicePublic() {
  const token = new URLSearchParams(window.location.search).get("t") || "";
  const [state, setState] = useState({ loading: true, error: "", invoice: null });
  const frameRef = useRef(null);

  useEffect(() => {
    document.title = "Invoice - Nexto";
    // Halaman berisi data tagihan: jangan diindeks mesin pencari.
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("invoice-public", { body: { token } });
        if (error) {
          let msg = null;
          try { msg = (await error.context.json())?.error; } catch (_) {}
          throw new Error(msg || "Invoice tidak dapat dimuat.");
        }
        setState({ loading: false, error: "", invoice: data.invoice });
        document.title = `${data.invoice.number} - ${data.invoice.company}`;
      } catch (e) {
        setState({ loading: false, error: e.message, invoice: null });
      }
    })();
    return () => meta.remove();
  }, [token]);

  const inv = state.invoice;
  const html = inv ? buildInvoiceHtml(inv.data, { number: inv.number, status: inv.status, paidAt: inv.paid_at }) : "";

  return (
    <div className="flex min-h-screen flex-col bg-[#eceef2]">
      <header className="sticky top-0 z-10 border-b border-slate-300/70 bg-white">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-slate-900">{inv ? inv.number : "Invoice"}</div>
            {inv && <div className="truncate text-[12px] text-slate-500">{inv.company}</div>}
          </div>
          {inv && (
            <button type="button" onClick={() => printHtml(html)} className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-slate-700">
              Unduh PDF
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[860px] flex-1 px-4 py-5">
        {state.loading ? (
          <p className="py-16 text-center text-[13px] text-slate-500">Memuat invoice…</p>
        ) : state.error ? (
          <div className="mx-auto max-w-md rounded-lg border border-slate-300 bg-white px-5 py-6 text-center">
            <p className="text-[14px] font-semibold text-slate-900">Invoice tidak dapat ditampilkan</p>
            <p className="mt-1.5 text-[13px] text-slate-600">{state.error}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-slate-300 bg-white shadow-sm">
              <iframe ref={frameRef} title="Invoice" srcDoc={html} onLoad={(e) => { const d = e.currentTarget.contentDocument; if (d) e.currentTarget.style.height = d.documentElement.scrollHeight + "px"; }} className="block h-[1120px] w-full min-w-[640px] bg-white" />
            </div>
            <p className="mt-3 text-center text-[12px] text-slate-500">Pada jendela cetak, pilih "Simpan sebagai PDF" untuk menyimpan invoice ini.</p>
          </>
        )}
      </main>
    </div>
  );
}

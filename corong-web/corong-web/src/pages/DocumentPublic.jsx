// Halaman Quotation/Invoice untuk customer (7 Okt 2026): nexto.site/dokumen?t=<token>.
// Dibuka dari tombol di email - tanpa login. Isi dokumen dirender dengan
// buildDocumentHtml yang sama dengan PDF penerbit, jadi tampilannya identik.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { printHtml } from "../lib/docKit";
import { buildDocumentHtml, brandingOf, KIND_META } from "../lib/documents";

export default function DocumentPublic() {
  const token = new URLSearchParams(window.location.search).get("t") || "";
  const [state, setState] = useState({ loading: true, error: "", doc: null });

  useEffect(() => {
    document.title = "Dokumen";
    // Halaman berisi data tagihan: jangan diindeks mesin pencari.
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("document-public", { body: { token } });
        if (error) {
          let msg = null;
          try { msg = (await error.context.json())?.error; } catch (_) { /* tanpa detail */ }
          throw new Error(msg || "Dokumen tidak dapat dimuat.");
        }
        setState({ loading: false, error: "", doc: data.document });
        document.title = `${data.document.number} - ${data.document.customer?.name || ""}`;
      } catch (e) {
        setState({ loading: false, error: e.message, doc: null });
      }
    })();
    return () => meta.remove();
  }, [token]);

  const doc = state.doc;
  const html = useMemo(() => (doc ? buildDocumentHtml(doc, brandingOf(doc, null)) : ""), [doc]);

  return (
    <div className="flex min-h-screen flex-col bg-[#eceef2]">
      <header className="sticky top-0 z-10 border-b border-slate-300/70 bg-white">
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-slate-900">{doc ? doc.number : "Dokumen"}</div>
            {doc && <div className="truncate text-[12px] text-slate-500">{KIND_META[doc.kind]?.label} · {doc.snapshot?.seller?.name || ""}</div>}
          </div>
          {doc && (
            <button type="button" onClick={() => printHtml(html)} className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-[13px] font-semibold text-white hover:bg-slate-700">
              Unduh PDF
            </button>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[860px] flex-1 px-4 py-5">
        {state.loading ? (
          <p className="py-16 text-center text-[13px] text-slate-500">Memuat dokumen…</p>
        ) : state.error ? (
          <div className="mx-auto max-w-md rounded-lg border border-slate-300 bg-white px-5 py-6 text-center">
            <p className="text-[14px] font-semibold text-slate-900">Dokumen tidak dapat ditampilkan</p>
            <p className="mt-1.5 text-[13px] text-slate-600">{state.error}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-md border border-slate-300 bg-white shadow-sm">
              <iframe title="Dokumen" sandbox="allow-same-origin" srcDoc={html} onLoad={(e) => { const d = e.currentTarget.contentDocument; if (d) e.currentTarget.style.height = `${d.documentElement.scrollHeight}px`; }} className="block w-full border-0" style={{ minHeight: 700 }} />
            </div>
            <p className="mt-3 text-center text-[12px] text-slate-500">Pada jendela cetak, pilih "Simpan sebagai PDF" untuk menyimpan dokumen ini.</p>
          </>
        )}
      </main>
    </div>
  );
}

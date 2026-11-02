// Halaman scan kartu garansi (3 Nov 2026): nexto.site/garansi?t=<token>. Tanpa login.
// Hanya menampilkan info pemasangan, nomor WhatsApp, dan riwayat servis. Tidak ada data pribadi customer.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

async function fetchCard(token) {
  const { data, error } = await supabase.functions.invoke("warranty-card", { body: { action: "get", t: token } });
  if (error) {
    let msg = null;
    try { msg = (await error.context.json())?.error; } catch (_) {}
    throw new Error(msg || "Kartu garansi belum bisa dimuat.");
  }
  return data;
}

const fmtDate = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

export default function WarrantyPublic() {
  const token = new URLSearchParams(window.location.search).get("t") || "";
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    document.title = "Kartu Garansi - Nexto";
    const meta = document.createElement("meta");
    meta.name = "robots"; meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    fetchCard(token)
      .then((data) => setState({ loading: false, error: "", data }))
      .catch((e) => setState({ loading: false, error: e.message, data: null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shell = (children) => (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-md space-y-4">{children}</div>
    </div>
  );

  if (state.loading) return shell(<p className="text-sm text-slate-500">Memuat kartu garansi...</p>);
  if (state.error) return shell(<div className="rounded-2xl bg-white p-5 text-sm text-rose-600 shadow-sm">{state.error}</div>);

  const d = state.data;
  const waHref = `https://wa.me/${d.contact_wa}`;
  return shell(
    <>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="text-xs text-slate-500">Kartu garansi dari {d.org_name}</div>
        <h1 className="mt-1 text-lg font-semibold text-slate-900">{d.product || "Unit terpasang"}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-slate-500">Tanggal pasang</dt><dd className="font-medium text-slate-800">{fmtDate(d.installed_at)}</dd></div>
          <div><dt className="text-xs text-slate-500">Garansi berlaku s.d.</dt><dd className={`font-medium ${d.warranty_active ? "text-emerald-600" : "text-rose-600"}`}>{fmtDate(d.warranty_until)}</dd></div>
        </dl>
        <p className={`mt-3 rounded-xl px-3 py-2 text-sm ${d.warranty_active ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
          {d.warranty_active ? "Garansi masih aktif." : "Masa garansi sudah berakhir."}
        </p>
        <a href={waHref} target="_blank" rel="noopener noreferrer" className="mt-4 flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700">
          Hubungi via WhatsApp
        </a>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Riwayat servis ({d.logs.length})</h2>
        {d.logs.length === 0 && <p className="mt-2 text-sm text-slate-500">Belum ada servis tercatat.</p>}
        <ul className="mt-3 space-y-4">
          {d.logs.map((l) => (
            <li key={l.id} className="border-l-2 border-slate-200 pl-3">
              <div className="text-xs text-slate-500">{fmtDate(l.service_date)} · {l.technician_name}</div>
              <div className="mt-1 text-sm text-slate-800"><span className="text-slate-500">Kerusakan:</span> {l.problem}</div>
              <div className="mt-1 text-sm text-slate-800"><span className="text-slate-500">Tindakan:</span> {l.action}</div>
              {l.photos?.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {l.photos.map((url) => (
                    <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                      <img src={url} alt="Foto servis" className="h-20 w-full rounded-lg object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

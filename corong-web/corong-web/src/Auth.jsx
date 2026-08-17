import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { Filter, Loader2 } from "lucide-react";
export default function Auth() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setMsg(""); setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        setMsg("Akun dibuat. Cek email buat verifikasi (kalau confirm email aktif), lalu masuk.");
      }
    } catch (e) { setMsg(e.message); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl shadow-sm p-7">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/25"><Filter size={20} className="text-slate-900" /></div>
          <div className="leading-tight"><div className="font-bold tracking-tight">Nexto</div></div>
        </div>
        <h1 className="text-lg font-bold mb-1">{mode === "signin" ? "Masuk" : "Daftar akun"}</h1>
        <p className="text-xs text-slate-400 mb-4">{mode === "signin" ? "Masuk buat akses pipeline-mu." : "Bikin akun buat mulai."}</p>
        <div className="space-y-3">
          <input className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          {msg && <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2">{msg}</div>}
          <button onClick={submit} disabled={loading} className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm py-2.5 rounded-xl font-medium flex items-center justify-center gap-2">{loading ? <Loader2 size={15} className="animate-spin" /> : null} {mode === "signin" ? "Masuk" : "Daftar"}</button>
          <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMsg(""); }} className="w-full text-xs text-slate-500 hover:text-slate-800">
            {mode === "signin" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
          </button>
        </div>
      </div>
    </div>
  );
}

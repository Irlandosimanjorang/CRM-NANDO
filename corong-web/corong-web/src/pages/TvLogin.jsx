// Login sederhana untuk layar TV (25 Okt 2026) - hanya form masuk, tanpa panel promosi.
// Captcha Turnstile dan login Google memakai cara yang sama dengan halaman login utama (Auth.jsx).
// Verifikasi dua langkah (2FA) TIDAK dilewati: TvScreen mengecek level sesi setelah login.
import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const TURNSTILE_SITE_KEY = "0x4AAAAAAEu6vGXceQD1CTOl";

export default function TvLogin() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const tryRender = () => {
      if (cancelled || !turnstileRef.current || widgetId.current) return;
      if (!window.turnstile) { setTimeout(tryRender, 200); return; }
      widgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(""),
        "error-callback": () => setCaptchaToken(""),
      });
    };
    tryRender();
    return () => { cancelled = true; };
  }, []);

  // Token captcha hanya sekali pakai, jadi widget di-reset setiap selesai mencoba.
  const resetCaptcha = () => {
    setCaptchaToken("");
    if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current);
  };

  const submit = async (e) => {
    e.preventDefault();
    setMsg("");
    if (!captchaToken) { setMsg("Selesaikan verifikasi dulu."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw, options: { captchaToken } });
      if (error) setMsg(error.message);
    } catch (err) {
      setMsg(String(err?.message || err));
    } finally {
      setLoading(false);
      resetCaptcha();
    }
  };

  const signInWithGoogle = async () => {
    setMsg("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/tv` },
    });
    if (error) setMsg(error.message);
  };

  const input = "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[16px] text-slate-100 placeholder:text-slate-500 focus:border-sky-300/60 focus:outline-none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b1020] px-5 text-slate-100">
      <div className="w-full max-w-sm">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">Layar TV Nexto</h1>
        <p className="mt-1.5 text-[14px] text-slate-400">Masuk dengan akun owner. Browser ini akan tetap masuk.</p>

        <form onSubmit={submit} className="mt-8 grid gap-3">
          <input className={input} type="email" placeholder="Email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className={input} type="password" placeholder="Password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          <div ref={turnstileRef} className="mt-1" />
          <button type="submit" disabled={loading} className="mt-1 rounded-xl bg-white py-3 text-[15px] font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60">
            {loading ? "Memproses..." : "Masuk"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-[12px] text-slate-500">
          <span className="h-px flex-1 bg-white/10" /> atau <span className="h-px flex-1 bg-white/10" />
        </div>
        <button type="button" onClick={signInWithGoogle} className="w-full rounded-xl border border-white/15 py-3 text-[15px] font-semibold text-slate-100 transition-colors hover:bg-white/5">
          Masuk dengan Google
        </button>

        {msg && <p role="alert" className="mt-4 text-[14px] text-rose-300">{msg}</p>}
      </div>
    </div>
  );
}

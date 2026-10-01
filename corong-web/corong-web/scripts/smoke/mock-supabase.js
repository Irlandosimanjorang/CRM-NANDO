// Supabase palsu untuk tes App lengkap (scripts/smoke/app.html). Sesi login
// palsu, 2FA tidak aktif, dan query apa pun mengembalikan data kosong.
// window.__fireAuth(event) mensimulasikan Supabase memperbarui sesi (mis.
// saat tab browser kembali fokus).
const listeners = [];
const session = { user: { id: "u1", email: "uji@example.com", user_metadata: {} }, access_token: "x" };
const empty = { data: [], error: null, count: 0 };
function query() {
  const q = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (res, rej) => Promise.resolve(empty).then(res, rej);
      if (prop === "single" || prop === "maybeSingle") return () => Promise.resolve({ data: null, error: null });
      return () => q;
    },
    apply() { return q; },
  });
  return q;
}
export const isConfigured = true;
export const supabase = {
  auth: {
    getSession: async () => ({ data: { session } }),
    getUser: async () => ({ data: { user: session.user }, error: null }),
    onAuthStateChange: (cb) => { listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; },
    signOut: async () => ({}),
    mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null }) },
  },
  from: () => query(),
  rpc: () => query(),
  functions: { invoke: async () => ({ data: null, error: null }) },
  storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
  channel: () => ({ on() { return this; }, subscribe() { return this; } }),
  removeChannel: () => {},
};
window.__fireAuth = (event = "TOKEN_REFRESHED") => listeners.forEach((cb) => cb(event, { ...session }));

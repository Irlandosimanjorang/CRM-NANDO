import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isConfigured = Boolean(url && key);

// Kalau env belum diisi, client tetap dibuat dengan placeholder biar app ga crash;
// App.jsx akan menampilkan layar setup.
export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder");

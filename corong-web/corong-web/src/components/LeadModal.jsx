import { useState } from "react";
import { X, Save, Trash2, Plus, ClipboardList, Pencil, Check, MapPin, Mail, Send, Loader2, Sparkles } from "lucide-react";
import * as db from "../lib/db";
import { fmtDate, todayISO, stageMeta, chipStyle } from "../lib/helpers";
import { getFieldLabel, isFieldHidden, getCustomFieldSlots, getCategories, getCompanyTypeOptions } from "../lib/industryTemplates";

const inp = "w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10";
function Field({ label, children }) { return <label className="block"><span className="text-xs font-medium text-slate-500">{label}</span>{children}</label>; }

// Chip kecil buat nampilin level Customer State (Interest/Intent/Risk) dengan
// warna - "invert" dipake buat Risk, soalnya "high risk" itu JELEK (merah),
// beda arah sama Interest/Intent yang "high" itu BAGUS (hijau).
function StateChip({ label, level, invert }) {
  const COLORS = invert
    ? { high: "#e11d48", medium: "#d97706", low: "#16a34a" }
    : { high: "#16a34a", medium: "#d97706", low: "#94a3b8" };
  const hex = COLORS[level] || "#94a3b8";
  return (
    <div className="rounded-xl border px-2 py-1.5 text-center" style={{ borderColor: `${hex}55`, backgroundColor: `${hex}14` }}>
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className="text-[11px] font-bold capitalize" style={{ color: hex }}>{level || "—"}</div>
    </div>
  );
}

// Template siap pakai - {{nama}} & {{pic}} otomatis keganti pas dipilih.
const EMAIL_TEMPLATES = {
  perkenalan: {
    label: "Perkenalan",
    subject: "Perkenalan dari Nexto - Solusi untuk {{nama}}",
    body: `Selamat siang {{pic}},

Perkenalkan, saya dari tim sales yang ingin memperkenalkan produk kami yang mungkin relevan untuk kebutuhan produksi {{nama}}.

Kami melayani kebutuhan bahan baku PVC/kimia dengan kualitas terjamin dan harga kompetitif. Boleh saya jadwalkan waktu singkat untuk diskusi lebih lanjut?

Terima kasih atas waktunya.`,
  },
  penawaran: {
    label: "Penawaran",
    subject: "Penawaran Produk untuk {{nama}}",
    body: `Selamat siang {{pic}},

Menindaklanjuti diskusi kita sebelumnya, dengan senang hati kami sampaikan penawaran produk untuk {{nama}}.

[Rincian produk, harga, dan ketentuan bisa ditambahkan di sini]

Kami siap membantu kalau ada pertanyaan lebih lanjut. Ditunggu kabarnya ya.`,
  },
  followup: {
    label: "Follow-up",
    subject: "Follow-up - {{nama}}",
    body: `Selamat siang {{pic}},

Semoga kabar baik. Saya ingin follow-up terkait diskusi kita sebelumnya mengenai kebutuhan {{nama}}.

Apakah ada perkembangan atau pertanyaan yang bisa saya bantu? Saya siap membantu kapan saja dibutuhkan.

Terima kasih.`,
  },
  terimakasih: {
    label: "Ucapan Terima Kasih",
    subject: "Terima Kasih - {{nama}}",
    body: `Selamat siang {{pic}},

Terima kasih banyak atas waktu dan kesempatan diskusi/pertemuan kita. Senang bisa membahas kebutuhan {{nama}} lebih lanjut.

Kalau ada yang bisa saya bantu selanjutnya, jangan ragu untuk menghubungi saya kapan saja.

Sekali lagi terima kasih.`,
  },
};
function fillTemplate(str, lead) {
  return str.replace(/\{\{nama\}\}/g, lead.name || "perusahaan Anda").replace(/\{\{pic\}\}/g, lead.key_person || "Bapak/Ibu");
}

export default function LeadModal({ lead, stages, settings, industry, onClose, onSaved }) {
  const [f, setF] = useState({ ...lead });
  const [log, setLog] = useState(lead.progressLog || []);
  const [newProg, setNewProg] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  // Label field & slot custom field ngikutin template industri org (Settings > pilihan
  // industri pas onboarding). Org PVC lama gak kerasa bedanya - labelnya persis sama.
  const lbl = (field, fallback) => getFieldLabel(industry, field, fallback);
  const hidden = (field) => isFieldHidden(industry, field);
  const customSlots = getCustomFieldSlots(industry);
  const categories = getCategories(industry);
  const companyTypeOptions = getCompanyTypeOptions(industry);
  // Warna header ngikutin tahap pipeline lead ini (real-time ngikutin pilihan
  // dropdown Tahap di bawah, bukan cuma nilai awal pas modal dibuka).
  const sm = stageMeta(stages, f.stage_key || stages[0]?.key);

  // ---- KIRIM EMAIL ----
  const [showEmail, setShowEmail] = useState(false);
  const [emailTpl, setEmailTpl] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState("");

  const pickTemplate = (key) => {
    setEmailTpl(key);
    if (!key) { setEmailSubject(""); setEmailBody(""); return; }
    const t = EMAIL_TEMPLATES[key];
    setEmailSubject(fillTemplate(t.subject, f));
    setEmailBody(fillTemplate(t.body, f));
  };

  const sendEmail = async () => {
    if (!f.email) { alert("Lead ini belum punya alamat email."); return; }
    if (!emailSubject.trim() || !emailBody.trim()) { alert("Subjek & isi email wajib diisi."); return; }
    setEmailBusy(true); setEmailMsg("");
    try {
      await db.sendLeadEmail({ lead_id: lead.id, to_email: f.email, to_name: f.name, subject: emailSubject, body: emailBody, sender_name: settings?.community_display_name });
      setEmailMsg("✅ Email berhasil terkirim & kecatet di progress.");
      setEmailTpl(""); setEmailSubject(""); setEmailBody("");
      onSaved();
    } catch (e) {
      setEmailMsg("Gagal: " + e.message);
    } finally {
      setEmailBusy(false);
    }
  };

  const saveLocation = () => {
    if (!lead.id) { alert("Simpan lead-nya dulu sebelum simpan lokasi."); return; }
    if (!navigator.geolocation) { alert("HP/browser kamu ga dukung GPS."); return; }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          await db.saveLeadLocation(lead.id, latitude, longitude);
          await db.checkIn({ lead_id: lead.id, lead_name: f.name, latitude, longitude, distance_meters: 0 });
          setF((p) => ({ ...p, latitude, longitude }));
          alert("✅ Lokasi tersimpan & check-in tercatat.");
        } catch (e) { alert("Gagal simpan lokasi: " + e.message); }
        finally { setLocBusy(false); }
      },
      () => { alert("Gagal ambil lokasi GPS. Pastikan izin lokasi diaktifkan."); setLocBusy(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const save = async () => {
    if (!f.name?.trim()) { alert("Nama wajib diisi."); return; }
    setBusy(true);
    try { await db.upsertLead(f); onSaved(); }
    catch (e) { alert("Gagal simpan: " + e.message); setBusy(false); }
  };
  const del = async () => { if (!window.confirm("Hapus lead ini?")) return; setBusy(true); await db.deleteLead(lead.id); onSaved(); };

  const addProg = async () => {
    if (!newProg.trim() || !lead.id) { if (!lead.id) alert("Simpan lead-nya dulu sebelum catat progress."); return; }
    const p = await db.addProgress(lead.id, newProg.trim());
    setLog([p, ...log]); setNewProg("");
  };
  const delProg = async (id) => { await db.deleteProgress(id); setLog(log.filter((x) => x.id !== id)); };
  const startEditProg = (p) => { setEditingId(p.id); setEditText(p.text); };
  const cancelEditProg = () => { setEditingId(null); setEditText(""); };
  const saveEditProg = async (id) => {
    if (!editText.trim()) return;
    await db.updateProgress(id, editText.trim());
    setLog(log.map((x) => (x.id === id ? { ...x, text: editText.trim() } : x)));
    setEditingId(null); setEditText("");
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl my-8 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header gradient sesuai warna tahap pipeline lead ini - avatar bubble
            "bocor" ke luar band, senada sama gaya kartu profil & popup lain. */}
        <div className="relative h-20 shrink-0" style={{ background: `linear-gradient(135deg, ${sm.hex}, ${sm.hex}cc 55%, ${sm.hex}99)` }}>
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"><X size={16} /></button>
          <div className="absolute -bottom-7 left-5 w-16 h-16 rounded-2xl overflow-hidden bg-white ring-4 ring-white shadow-md flex items-center justify-center font-bold text-xl" style={{ color: sm.hex }}>
            {(f.name || "?").charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="pt-9 px-5 pb-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-bold text-lg text-slate-900 truncate">{f.name || (lead.id ? "Edit Lead" : "Tambah Lead")}</h2>
              <div className="text-xs text-slate-400 truncate">{f.category || (lead.id ? "Edit detail lead" : "Isi info lead baru")}</div>
            </div>
            <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border mt-0.5" style={chipStyle(sm.hex)}>{sm.label}</span>
          </div>
        </div>
        <div className="space-y-3 px-5 pb-5 pt-3">
          {lead.customer_state && (
            <div className="border border-violet-200 bg-violet-50/60 rounded-2xl p-3">
              <div className="text-xs font-semibold text-violet-700 mb-2 flex items-center gap-1.5">
                <Sparkles size={13} /> Customer State (AI)
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <StateChip label="Interest" level={lead.customer_state.interest} />
                <StateChip label="Intent" level={lead.customer_state.intent} />
                <StateChip label="Risk" level={lead.customer_state.risk} invert />
              </div>
              {lead.customer_state.objection && (
                <div className="mt-2 text-xs text-slate-600"><span className="text-slate-400">Objection:</span> {lead.customer_state.objection}</div>
              )}
              <div className="mt-1 text-xs text-slate-600">
                <span className="text-slate-400">Decision maker:</span> {lead.customer_state.decision_maker_known ? "Kelihatannya sudah" : "Belum pasti"}
                {lead.customer_state.expected_decision_date && <> · <span className="text-slate-400">Keputusan sekitar:</span> {new Date(lead.customer_state.expected_decision_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</>}
              </div>
              {lead.customer_state.state_reason && (
                <p className="mt-2 text-[11px] text-violet-700/80 italic">"{lead.customer_state.state_reason}"</p>
              )}
              <p className="mt-2 text-[10px] text-slate-400">Dihitung otomatis dari progress notes - update tiap lead ini kena analisis AI Advisor.</p>
            </div>
          )}
          <Field label={lbl("name", "Nama perusahaan") + " *"}><input className={inp} value={f.name || ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori"><select className={inp} value={f.category || categories[0]} onChange={(e) => set("category", e.target.value)}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
            {!hidden("company_type") && (
              <Field label={lbl("company_type", "Tipe perusahaan")}><select className={inp} value={f.company_type || ""} onChange={(e) => set("company_type", e.target.value)}>{companyTypeOptions.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></Field>
            )}
          </div>
          <Field label="Tahap"><select className={inp} value={f.stage_key || stages[0]?.key} onChange={(e) => set("stage_key", e.target.value)}>{stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></Field>
          <Field label={lbl("product", "Produk")}><input className={inp} value={f.product || ""} onChange={(e) => set("product", e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="Email"><input className={inp} value={f.email || ""} onChange={(e) => set("email", e.target.value)} /></Field><Field label="Telepon / WA"><input className={inp} value={f.phone || ""} onChange={(e) => set("phone", e.target.value.replace(/[^\d+\-\s,\/()]/g, ""))} placeholder="0812xxxxxxx, 0813xxxxxxx" /></Field></div>
          {(!hidden("key_person") || !hidden("key_person_title")) && (
            <div className="grid grid-cols-2 gap-3">
              {!hidden("key_person") && <Field label={lbl("key_person", "Key person")}><input className={inp} value={f.key_person || ""} onChange={(e) => set("key_person", e.target.value)} /></Field>}
              {!hidden("key_person_title") && <Field label={lbl("key_person_title", "Jabatan")}><input className={inp} value={f.key_person_title || ""} onChange={(e) => set("key_person_title", e.target.value)} /></Field>}
            </div>
          )}
          <Field label="Kota"><input className={inp} value={f.city || ""} onChange={(e) => set("city", e.target.value)} /></Field>
          {customSlots.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {customSlots.map((slot) => (
                <Field key={slot.key} label={slot.label}><input className={inp} value={f[slot.key] || ""} onChange={(e) => set(slot.key, e.target.value)} /></Field>
              ))}
            </div>
          )}
          {!hidden("location") && (
            <div className="flex items-center justify-between border border-slate-200 rounded-2xl p-3 bg-slate-50">
              <div className="text-xs">
                <div className="font-semibold text-slate-600 flex items-center gap-1.5"><MapPin size={13} /> Titik lokasi GPS</div>
                <div className="text-slate-400 mt-0.5">{f.latitude ? `Tersimpan (${Number(f.latitude).toFixed(5)}, ${Number(f.longitude).toFixed(5)})` : "Belum ada — simpan pas kamu lagi di lokasi"}</div>
              </div>
              <button onClick={saveLocation} disabled={locBusy || !lead.id} className="text-xs border border-orange-300 text-orange-700 bg-white rounded-xl px-3 py-1.5 hover:bg-orange-50 disabled:opacity-50 shrink-0 font-medium">
                {locBusy ? "Menyimpan…" : f.latitude ? "Check In" : "Simpan Lokasi Ini"}
              </button>
            </div>
          )}
          {!hidden("website") && (
            <Field label="Website"><input className={inp} value={f.website || ""} onChange={(e) => set("website", e.target.value)} placeholder="https://" /></Field>
          )}
          <div className="border border-orange-200 bg-orange-50/60 rounded-2xl p-3 space-y-2.5">
            <Field label="Next action"><input className={inp} value={f.next_action || ""} onChange={(e) => set("next_action", e.target.value)} placeholder="langkah berikutnya" /></Field>
            <Field label="Tunggu sampai (opsional)">
              <input type="date" className={inp} value={f.wait_until || ""} onChange={(e) => set("wait_until", e.target.value || null)} />
            </Field>
            {f.wait_until && (
              <p className="text-[11px] text-orange-700">⏸️ AI Advisor & reminder bakal DIEM buat lead ini sampai tanggal di atas lewat - gak akan dianggep overdue walaupun lama gak dikontak.</p>
            )}
          </div>

          <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
            <div className="text-xs font-semibold text-slate-600 mb-2 flex items-center gap-1.5"><ClipboardList size={14} /> Progress harian</div>
            <div className="flex gap-2 mb-2">
              <input className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-orange-500" value={newProg} onChange={(e) => setNewProg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addProg()} placeholder={lead.id ? "Update hari ini… (Enter)" : "Simpan lead dulu"} />
              <button onClick={addProg} className="bg-slate-900 hover:bg-slate-800 text-white text-xs px-3 rounded-lg flex items-center gap-1"><Plus size={13} /> Catat</button>
            </div>
            {log.length === 0 ? <p className="text-xs text-slate-400">Belum ada progress.</p> : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">{log.map((p) => (
                editingId === p.id ? (
                  <div key={p.id} className="flex items-start gap-2 text-xs bg-white border border-orange-300 rounded px-2 py-1.5">
                    <span className="text-slate-400 font-mono shrink-0 pt-1">{fmtDate(p.date)}</span>
                    <input
                      className="flex-1 px-1.5 py-1 text-xs border border-slate-300 rounded bg-white focus:outline-none focus:border-orange-500"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") saveEditProg(p.id); if (e.key === "Escape") cancelEditProg(); }}
                      autoFocus
                    />
                    <button onClick={() => saveEditProg(p.id)} className="text-emerald-600 hover:text-emerald-700 shrink-0"><Check size={14} /></button>
                    <button onClick={cancelEditProg} className="text-slate-300 hover:text-slate-500 shrink-0"><X size={13} /></button>
                  </div>
                ) : (
                  <div key={p.id} className="flex items-start gap-2 text-xs bg-white border border-slate-200 rounded px-2 py-1.5">
                    <span className="text-slate-400 font-mono shrink-0">{fmtDate(p.date)}</span>
                    <span className="flex-1 text-slate-700">{p.text}</span>
                    <button onClick={() => startEditProg(p)} className="text-slate-300 hover:text-blue-500 shrink-0"><Pencil size={13} /></button>
                    <button onClick={() => delProg(p.id)} className="text-slate-300 hover:text-rose-500 shrink-0"><X size={13} /></button>
                  </div>
                )
              ))}</div>
            )}
          </div>

          <div className="border border-slate-200 rounded-2xl p-3 bg-slate-50">
            <button onClick={() => setShowEmail((v) => !v)} className="w-full flex items-center justify-between text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1.5"><Mail size={14} /> Kirim Email</span>
              <span className="text-slate-400">{showEmail ? "▲" : "▼"}</span>
            </button>
            {showEmail && (
              <div className="mt-3 space-y-2.5">
                {!f.email ? (
                  <p className="text-xs text-amber-700 bg-amber-50 rounded-lg p-2">Lead ini belum punya alamat email — isi dulu di field Email di atas.</p>
                ) : (
                  <>
                    <p className="text-[11px] text-slate-400">Kirim ke: <b>{f.email}</b></p>
                    <select className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white" value={emailTpl} onChange={(e) => pickTemplate(e.target.value)}>
                      <option value="">— Pilih template —</option>
                      {Object.entries(EMAIL_TEMPLATES).map(([k, t]) => <option key={k} value={k}>{t.label}</option>)}
                    </select>
                    <input className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white" placeholder="Subjek email" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
                    <textarea className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white min-h-[120px]" placeholder="Isi email" value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />
                    <button onClick={sendEmail} disabled={emailBusy} className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1.5">
                      {emailBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} {emailBusy ? "Mengirim…" : "Kirim Email"}
                    </button>
                    {emailMsg && <p className={`text-[11px] ${emailMsg.startsWith("Gagal") ? "text-rose-600" : "text-emerald-700"}`}>{emailMsg}</p>}
                  </>
                )}
              </div>
            )}
          </div>

          <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!!f.verified} onChange={(e) => set("verified", e.target.checked)} className="w-4 h-4 accent-emerald-600" /><span className="text-slate-500">Kontak terverifikasi</span></label>
        </div>
        <div className="flex items-center gap-2 mt-5">
          <button onClick={save} disabled={busy} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm shadow-orange-600/20"><Save size={15} /> Simpan</button>
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50">Batal</button>
          {lead.id && <button onClick={del} className="ml-auto text-sm text-rose-600 hover:bg-rose-50 px-3 py-2 rounded-xl flex items-center gap-1.5"><Trash2 size={15} /> Hapus</button>}
        </div>
      </div>
    </div>
  );
}

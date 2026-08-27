import { useState, useRef, useEffect } from "react";
import { X, ClipboardList, Loader2, Send, Pencil, Trash2, Check } from "lucide-react";
import * as db from "../lib/db";

// Popup ringan khusus progress notes - dipicu dari kolom "Update progress"
// di bagian bawah kartu Leads. Beda dari LeadModal (yang nampilin SEMUA
// field lead), ini fokus sempit: history scroll-able + tambah/edit/hapus
// progress cepet, tanpa perlu buka modal penuh.
//
// Sengaja modal DI TENGAH LAYAR (bukan nempel di posisi klik) - lebih
// simpel & konsisten kayak LeadModal, gak rawan salah posisi/kepotong
// tergantung di mana kartu-nya ada di halaman.
export default function ProgressPopup({ lead, onClose, onChanged, autoFocus }) {
  const [notes, setNotes] = useState((lead.progressLog || []).slice().sort((a, b) => (a.date < b.date ? 1 : -1)));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  const submit = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    try {
      const added = await db.addProgress(lead.id, text.trim());
      setNotes((prev) => [added, ...prev]);
      setText("");
      onChanged && onChanged();
    } catch (e) {
      alert("Gagal simpan: " + e.message);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (n) => { setEditingId(n.id); setEditText(n.text); };
  const saveEdit = async (id) => {
    if (!editText.trim()) return;
    try {
      await db.updateProgress(id, editText.trim());
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, text: editText.trim() } : n)));
      setEditingId(null);
      onChanged && onChanged();
    } catch (e) {
      alert("Gagal update: " + e.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus catatan ini?")) return;
    try {
      await db.deleteProgress(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      onChanged && onChanged();
    } catch (e) {
      alert("Gagal hapus: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-sm flex flex-col overflow-hidden"
        style={{ maxHeight: "min(560px, calc(100vh - 32px))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 pt-4 pb-3 bg-gradient-to-br from-orange-50 to-white border-b border-slate-100 flex items-start justify-between gap-2 shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1"><ClipboardList size={11} /> Progress Harian</div>
            <div className="font-bold text-slate-900 text-sm mt-0.5 truncate">{lead.name}</div>
          </div>
          <button onClick={onClose} className="shrink-0 text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>

        {/* History - scroll-able, terbaru di atas */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {notes.length === 0 && <p className="text-xs text-slate-400 text-center py-6">Belum ada catatan progress.</p>}
          {notes.map((n) => (
            <div key={n.id} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 group">
              <div className="flex items-start justify-between gap-2">
                <span className="text-[10px] font-medium text-slate-400">{new Date(n.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</span>
                {editingId !== n.id && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => startEdit(n)} className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50"><Pencil size={11} /></button>
                    <button onClick={() => remove(n.id)} className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"><Trash2 size={11} /></button>
                  </div>
                )}
              </div>
              {editingId === n.id ? (
                <div className="mt-1.5 flex items-end gap-1.5">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    className="flex-1 text-xs border border-orange-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    autoFocus
                  />
                  <button onClick={() => saveEdit(n.id)} className="shrink-0 p-1.5 rounded-lg bg-orange-600 text-white hover:bg-orange-700"><Check size={12} /></button>
                </div>
              ) : (
                <p className="text-xs text-slate-700 mt-1 whitespace-pre-wrap">{n.text}</p>
              )}
            </div>
          ))}
        </div>

        {/* Input tambah progress baru - selalu keliatan di bawah, gak kepotong scroll */}
        <div className="px-3 py-3 border-t border-slate-100 shrink-0 bg-white">
          <div className="flex items-end gap-1.5">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Update progress hari ini… (Enter buat kirim)"
              rows={1}
              className="flex-1 text-sm border border-slate-300 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
            />
            <button onClick={submit} disabled={busy || !text.trim()} className="shrink-0 p-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Plus, X, MessageCircle, Trash2, Loader2, Send, Users2 } from "lucide-react";
import * as db from "../lib/db";

const CATEGORIES = [
  { key: "Nego & Strategi", color: "blue" },
  { key: "Cari Supplier", color: "purple" },
  { key: "Referensi Perusahaan", color: "amber" },
  { key: "Cari Buyer", color: "emerald" },
  { key: "Diskusi Umum", color: "slate" },
];

const COLOR_CLASSES = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  slate: "bg-slate-100 text-slate-600 border-slate-200",
};

function catColor(cat) {
  return COLOR_CLASSES[CATEGORIES.find((c) => c.key === cat)?.color || "slate"];
}

function fmtWhen(iso) {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "baru saja";
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} jam lalu`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} hari lalu`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function NewPostModal({ onClose, onCreated }) {
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) { alert("Judul/pertanyaannya diisi dulu."); return; }
    setBusy(true);
    try {
      await db.createCommunityPost({ category, title: title.trim(), body: body.trim() });
      onCreated();
      onClose();
    } catch (e) { alert("Gagal posting: " + e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Post baru</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <span className="text-xs font-medium text-slate-500 block mb-1.5">Kategori</span>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${category === c.key ? COLOR_CLASSES[c.color] + " ring-2 ring-offset-1 ring-orange-300" : "bg-white border-slate-200 text-slate-500"}`}
                >
                  {c.key}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-500">Judul / pertanyaan</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='Misal: "Ada supplier CaZn stabilizer?"' className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-500">Detail (opsional)</span>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Jelasin lebih detail kalau perlu..." className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 resize-none" />
          </label>
        </div>

        <button onClick={submit} disabled={busy} className="w-full mt-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-1.5">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Post ke Komunitas
        </button>
      </div>
    </div>
  );
}

function PostThread({ post, myId, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!open && replies === null) {
      try { setReplies(await db.getReplies(post.id)); }
      catch (e) { setReplies([]); }
    }
    setOpen((v) => !v);
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      const r = await db.addReply(post.id, replyText.trim());
      setReplies((prev) => [...(prev || []), r]);
      setReplyText("");
    } catch (e) { alert("Gagal bales: " + e.message); }
    finally { setBusy(false); }
  };

  const delReply = async (id) => {
    if (!window.confirm("Hapus balasan ini?")) return;
    try { await db.deleteReply(id); setReplies((prev) => prev.filter((r) => r.id !== id)); }
    catch (e) { alert("Gagal hapus: " + e.message); }
  };

  const delPost = async () => {
    if (!window.confirm("Hapus post ini beserta semua balasannya?")) return;
    try { await db.deleteCommunityPost(post.id); onDeleted(post.id); }
    catch (e) { alert("Gagal hapus: " + e.message); }
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${catColor(post.category)}`}>{post.category}</span>
          <h3 className="font-semibold text-slate-900 mt-1.5 text-sm leading-snug">{post.title}</h3>
          {post.body && <p className="text-xs text-slate-500 mt-1 leading-relaxed whitespace-pre-wrap">{post.body}</p>}
          <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400">
            <span className="font-medium text-slate-500">{post.author_name}</span>
            <span>·</span>
            <span>{fmtWhen(post.created_at)}</span>
          </div>
        </div>
        {post.user_id === myId && (
          <button onClick={delPost} className="text-slate-300 hover:text-rose-500 shrink-0"><Trash2 size={14} /></button>
        )}
      </div>

      <button onClick={toggle} className="mt-3 text-xs text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1.5">
        <MessageCircle size={13} /> {post.replyCount || 0} balasan {open ? "▲" : "▼"}
      </button>

      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2.5">
          {replies === null ? (
            <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Memuat…</div>
          ) : replies.length === 0 ? (
            <p className="text-xs text-slate-400">Belum ada balasan. Jadi yang pertama!</p>
          ) : (
            replies.map((r) => (
              <div key={r.id} className="bg-slate-50 rounded-2xl rounded-tl-sm px-3 py-2 group relative">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">{r.author_name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400">{fmtWhen(r.created_at)}</span>
                    {r.user_id === myId && (
                      <button onClick={() => delReply(r.id)} className="text-slate-300 hover:text-rose-500"><X size={12} /></button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap">{r.body}</p>
              </div>
            ))
          )}
          <div className="flex items-center gap-2 pt-1">
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder="Tulis balasan..."
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
            />
            <button onClick={sendReply} disabled={busy} className="text-orange-600 hover:text-orange-700 disabled:opacity-50 shrink-0"><Send size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Community() {
  const [posts, setPosts] = useState(null);
  const [filterCat, setFilterCat] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [myId, setMyId] = useState(null);
  const [nameBusy, setNameBusy] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const load = async () => {
    try { setPosts(await db.getCommunityPosts(filterCat || undefined)); }
    catch (e) { setPosts([]); }
  };

  useEffect(() => {
    db.getCurrentUserId().then(setMyId);
    db.getCommunityDisplayName().then((n) => { if (!n) setShowNamePrompt(true); });
  }, []);

  useEffect(() => { load(); }, [filterCat]);

  const saveNamePrompt = async () => {
    if (!nameInput.trim()) return;
    setNameBusy(true);
    try { await db.saveCommunityDisplayName(nameInput.trim()); setShowNamePrompt(false); }
    catch (e) { alert("Gagal simpan nama: " + e.message); }
    finally { setNameBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Users2 size={22} className="text-orange-500" /> Komunitas</h1>
          <p className="text-xs text-slate-400 mt-0.5">Tanya strategi, cari supplier/buyer, atau minta referensi ke sesama pengguna Nexto.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm px-3 py-2 rounded-xl font-medium shadow-sm shadow-orange-600/20"><Plus size={15} /> Post</button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button onClick={() => setFilterCat("")} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${filterCat === "" ? "bg-orange-600 text-white border-orange-600" : "bg-white border-slate-200 text-slate-500"}`}>Semua</button>
        {CATEGORIES.map((c) => (
          <button key={c.key} onClick={() => setFilterCat(c.key)} className={`text-xs px-3 py-1.5 rounded-full border font-medium ${filterCat === c.key ? COLOR_CLASSES[c.color] + " ring-2 ring-offset-1 ring-orange-300" : "bg-white border-slate-200 text-slate-500"}`}>{c.key}</button>
        ))}
      </div>

      {posts === null ? (
        <div className="text-sm text-slate-400 flex items-center gap-1.5 py-10 justify-center"><Loader2 size={15} className="animate-spin" /> Memuat…</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-14 text-sm text-slate-400">Belum ada post. Jadi yang pertama share/tanya sesuatu!</div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostThread key={p.id} post={p} myId={myId} onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
          ))}
        </div>
      )}

      {showNew && <NewPostModal onClose={() => setShowNew(false)} onCreated={load} />}

      {showNamePrompt && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5">
            <h2 className="font-bold text-base mb-1.5">Siapa nama kamu di Komunitas?</h2>
            <p className="text-xs text-slate-500 mb-3">Nama ini yang bakal keliatan pas kamu post/bales di Komunitas (bukan nama akun login kamu).</p>
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveNamePrompt()}
              placeholder="Misal: Nando - PT Sinar Plastindo"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              autoFocus
            />
            <button onClick={saveNamePrompt} disabled={nameBusy} className="w-full mt-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium">
              {nameBusy ? "Menyimpan…" : "Simpan & lanjut"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

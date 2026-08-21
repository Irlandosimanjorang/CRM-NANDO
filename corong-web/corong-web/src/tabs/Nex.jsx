import { useState, useEffect, useRef } from "react";
import { X, MessageCircle, Trash2, Loader2, Send, ThumbsUp, Share2, Image as ImageIcon, Pencil } from "lucide-react";
import * as db from "../lib/db";

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

const AVATAR_COLORS = ["bg-orange-100 text-orange-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-purple-100 text-purple-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700"];
function avatarColor(name) {
  const s = name || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}
function Avatar({ name, size = 38 }) {
  const initial = (name || "?").trim()[0]?.toUpperCase() || "?";
  return (
    <div className={`rounded-full font-bold flex items-center justify-center shrink-0 ${avatarColor(name)}`} style={{ width: size, height: size, fontSize: size * 0.42 }}>
      {initial}
    </div>
  );
}

function ProfileCard({ myName, myBio, postCount, totalLikes, onEdit }) {
  return (
    <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-3 flex items-center gap-3">
      <Avatar name={myName} size={44} />
      <div className="min-w-0 flex-1">
        <div className="font-bold text-sm text-slate-900 truncate">{myName || "User Nexto"}</div>
        {myBio ? (
          <div className="text-[11px] text-slate-500 truncate">{myBio}</div>
        ) : null}
        <div className="text-[11px] text-slate-400 mt-0.5">
          <span className="font-semibold text-slate-600">{postCount}</span> Post · <span className="font-semibold text-slate-600">{totalLikes}</span> Suka
        </div>
      </div>
      <button onClick={onEdit} className="text-xs border border-slate-300 rounded-xl px-2.5 py-1.5 hover:bg-slate-50 font-medium flex items-center gap-1 shrink-0">
        <Pencil size={11} /> Edit
      </button>
    </div>
  );
}

function ProfileEditModal({ initialName, initialBio, onClose, onSaved }) {
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) { alert("Nama gak boleh kosong."); return; }
    setBusy(true);
    try {
      await db.saveCommunityProfile({ name: name.trim(), bio: bio.trim() });
      onSaved(name.trim(), bio.trim());
      onClose();
    } catch (e) { alert("Gagal simpan: " + e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base">Edit Profil Nex</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Nama tampilan</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Misal: Nando"
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500">Bio / jabatan (opsional)</span>
            <input
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Misal: Sales di PT Sinar Plastindo"
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-300 rounded-xl bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
            />
          </label>
        </div>
        <button onClick={save} disabled={busy} className="w-full mt-4 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-4 py-2 rounded-xl font-medium">
          {busy ? "Menyimpan…" : "Simpan"}
        </button>
      </div>
    </div>
  );
}

function ComposerModal({ displayName, onClose, onPosted }) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const pickFiles = (e) => {
    const chosen = Array.from(e.target.files || []).slice(0, 4 - files.length);
    setFiles((prev) => [...prev, ...chosen].slice(0, 4));
    setPreviews((prev) => [...prev, ...chosen.map((f) => URL.createObjectURL(f))].slice(0, 4));
    e.target.value = "";
  };
  const removeImage = (i) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!text.trim() && files.length === 0) { alert("Tulis sesuatu atau tambahin foto dulu."); return; }
    setBusy(true);
    try {
      const imageUrls = [];
      for (const f of files) imageUrls.push(await db.uploadCommunityImage(f));
      await db.createCommunityPost({ body: text.trim(), imageUrls });
      onPosted();
      onClose();
    } catch (e) { alert("Gagal posting: " + e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-start justify-center p-4 z-50 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg my-8 p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Buat post</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>

        <div className="flex items-center gap-2.5 mb-3">
          <Avatar name={displayName} />
          <div className="font-semibold text-sm text-slate-800">{displayName}</div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Tanya strategi, cari supplier/buyer, share info..."
          className="w-full px-3 py-2.5 text-sm border-0 focus:outline-none resize-none placeholder:text-slate-400"
          autoFocus
        />

        {previews.length > 0 && (
          <div className={`grid gap-1.5 mb-3 ${previews.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {previews.map((src, i) => (
              <div key={i} className="relative">
                <img src={src} className="w-full h-32 object-cover rounded-xl" />
                <button onClick={() => removeImage(i)} className="absolute top-1.5 right-1.5 bg-slate-900/60 text-white rounded-full p-1"><X size={12} /></button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            onClick={() => fileRef.current?.click()}
            disabled={files.length >= 4}
            className="flex items-center gap-1.5 text-sm text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-xl font-medium disabled:opacity-40"
          >
            <ImageIcon size={17} /> Foto
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={pickFiles} />

          <button onClick={submit} disabled={busy} className="bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-sm px-5 py-2 rounded-xl font-medium flex items-center gap-1.5">
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Post
          </button>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, myId, onDeleted }) {
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [shareCount, setShareCount] = useState(post.share_count || 0);
  const [showComments, setShowComments] = useState(false);
  const [replies, setReplies] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [busy, setBusy] = useState(false);

  const toggleLike = async () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    try { await db.toggleCommunityLike(post.id, next); }
    catch (e) { setLiked(!next); setLikeCount((c) => c + (next ? -1 : 1)); }
  };

  const share = async () => {
    setShareCount((c) => c + 1);
    try { await db.incrementCommunityShare(post.id); }
    catch (e) { setShareCount((c) => c - 1); }
  };

  const toggleComments = async () => {
    if (!showComments && replies === null) {
      try { setReplies(await db.getReplies(post.id)); }
      catch (e) { setReplies([]); }
    }
    setShowComments((v) => !v);
  };

  const sendReply = async () => {
    if (!replyText.trim()) return;
    setBusy(true);
    try {
      const r = await db.addReply(post.id, replyText.trim());
      setReplies((prev) => [...(prev || []), r]);
      setReplyText("");
    } catch (e) { alert("Gagal komentar: " + e.message); }
    finally { setBusy(false); }
  };

  const delReply = async (id) => {
    if (!window.confirm("Hapus komentar ini?")) return;
    try { await db.deleteReply(id); setReplies((prev) => prev.filter((r) => r.id !== id)); }
    catch (e) { alert("Gagal hapus: " + e.message); }
  };

  const delPost = async () => {
    if (!window.confirm("Hapus post ini?")) return;
    try { await db.deleteCommunityPost(post.id); onDeleted(post.id); }
    catch (e) { alert("Gagal hapus: " + e.message); }
  };

  return (
    <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-4">
      <div className="flex items-center gap-2.5">
        <Avatar name={post.author_name} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-900 truncate">{post.author_name}</div>
          <div className="text-[11px] text-slate-400">{fmtWhen(post.created_at)}</div>
        </div>
        {post.user_id === myId && (
          <button onClick={delPost} className="text-slate-300 hover:text-rose-500 shrink-0"><Trash2 size={15} /></button>
        )}
      </div>

      {post.body && <p className="text-sm text-slate-800 mt-3 leading-relaxed whitespace-pre-wrap">{post.body}</p>}

      {post.image_urls && post.image_urls.length > 0 && (
        <div className={`mt-3 grid gap-1 rounded-xl overflow-hidden ${post.image_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {post.image_urls.map((url, i) => (
            <img key={i} src={url} className="w-full h-full object-cover max-h-96 bg-slate-100" />
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 mt-3 pt-2 border-t border-slate-100 text-slate-500">
        <button onClick={toggleLike} className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl transition-colors ${liked ? "text-orange-600 bg-orange-50" : "hover:bg-slate-50"}`}>
          <ThumbsUp size={15} fill={liked ? "currentColor" : "none"} /> {likeCount > 0 ? likeCount : ""} Suka
        </button>
        <button onClick={toggleComments} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl hover:bg-slate-50">
          <MessageCircle size={15} /> {post.replyCount > 0 ? post.replyCount : ""} Komentar
        </button>
        <button onClick={share} className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl hover:bg-slate-50">
          <Share2 size={15} /> {shareCount > 0 ? shareCount : ""} Bagikan
        </button>
      </div>

      {showComments && (
        <div className="mt-2 pt-3 border-t border-slate-100 space-y-2.5">
          {replies === null ? (
            <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Memuat…</div>
          ) : replies.length === 0 ? (
            <p className="text-xs text-slate-400">Belum ada komentar. Jadi yang pertama!</p>
          ) : (
            replies.map((r) => (
              <div key={r.id} className="flex items-start gap-2">
                <Avatar name={r.author_name} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="bg-slate-50 rounded-2xl rounded-tl-sm px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-slate-700">{r.author_name}</span>
                      {r.user_id === myId && (
                        <button onClick={() => delReply(r.id)} className="text-slate-300 hover:text-rose-500"><X size={12} /></button>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 mt-0.5 leading-relaxed whitespace-pre-wrap">{r.body}</p>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 ml-3">{fmtWhen(r.created_at)}</div>
                </div>
              </div>
            ))
          )}
          <div className="flex items-center gap-2 pt-1">
            <Avatar name={post.__myName} size={28} />
            <input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendReply()}
              placeholder="Tulis komentar..."
              className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-full bg-white focus:outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10"
            />
            <button onClick={sendReply} disabled={busy} className="text-orange-600 hover:text-orange-700 disabled:opacity-50 shrink-0"><Send size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Nex() {
  const [posts, setPosts] = useState(null);
  const [showComposer, setShowComposer] = useState(false);
  const [myId, setMyId] = useState(null);
  const [myName, setMyName] = useState("");
  const [myBio, setMyBio] = useState("");
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const load = async () => {
    try { setPosts(await db.getCommunityPosts()); }
    catch (e) { setPosts([]); }
  };

  useEffect(() => {
    db.getCurrentUserId().then(setMyId);
    db.getCommunityProfile().then((p) => {
      setMyName(p.name); setMyBio(p.bio); setProfileLoaded(true);
      if (!p.name) setShowProfileEdit(true);
    });
    load();
  }, []);

  const myPosts = posts ? posts.filter((p) => p.user_id === myId) : [];
  const postCount = myPosts.length;
  const totalLikes = myPosts.reduce((a, p) => a + (p.likeCount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-violet-700">Nex</h1>
          <p className="text-xs text-slate-400 mt-0.5">Share info sesama sales.</p>
        </div>
        {profileLoaded && (
          <button onClick={() => setShowProfileEdit(true)} className="shrink-0" title={`${myName || "User Nexto"} · ${postCount} Post · ${totalLikes} Suka`}>
            <Avatar name={myName || "?"} size={40} />
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-100 rounded-[28px] shadow-[0_2px_16px_-4px_rgba(15,23,42,0.08)] p-3 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setShowComposer(true)}>
        <div className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm text-slate-400">Apa yang mau kamu share, {myName ? myName.split(" ")[0] : ""}?</div>
        <ImageIcon size={20} className="text-emerald-500 shrink-0" />
      </div>

      {posts === null ? (
        <div className="text-sm text-slate-400 flex items-center gap-1.5 py-10 justify-center"><Loader2 size={15} className="animate-spin" /> Memuat…</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-14 text-sm text-slate-400">Belum ada post. Jadi yang pertama share/tanya sesuatu!</div>
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={{ ...p, __myName: myName }} myId={myId} onDeleted={(id) => setPosts((prev) => prev.filter((x) => x.id !== id))} />
          ))}
        </div>
      )}

      {showComposer && <ComposerModal displayName={myName || "User Nexto"} onClose={() => setShowComposer(false)} onPosted={load} />}

      {showProfileEdit && (
        <ProfileEditModal
          initialName={myName}
          initialBio={myBio}
          onClose={() => setShowProfileEdit(false)}
          onSaved={(n, b) => { setMyName(n); setMyBio(b); }}
        />
      )}
    </div>
  );
}

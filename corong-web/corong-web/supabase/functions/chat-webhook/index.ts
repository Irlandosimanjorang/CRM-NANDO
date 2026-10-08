// Supabase Edge Function: chat-webhook (9 Okt 2026)
// Penerima webhook Cekat.ai (juga cocok untuk penyedia chat lain yang mengirim JSON serupa):
//   POST /functions/v1/chat-webhook?k=<kunci saluran>   (atau header x-webhook-key)
// Kunci dibuat owner di Pengaturan (fungsi ensure_chat_channel) dan hanya berlaku bila saklar organisasi
// lead_webhook menyala. Tanpa login pengguna (verify_jwt = false); keamanan = kunci acak di URL.
//
// Alur: baca payload secara toleran -> catat di chat_webhook_log -> temukan atau buat percakapan per kontak
// -> kontak baru dibuatkan lead (tahap pertama, dibagi otomatis ke marketing, sumber = platform, kampanye iklan
// bila ada) -> simpan pesan masuk/keluar. Pesan yang sama (external_id) tidak disimpan dua kali.
//
// Format payload Cekat belum dipublikasikan lengkap, jadi pembacaannya sengaja longgar (beberapa kemungkinan
// nama kolom). Setiap payload yang masuk dicatat supaya pembacaan bisa disesuaikan dari data nyata.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const MAX_BODY = 200_000;

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
const str = (v) => (v === undefined || v === null ? "" : String(v).trim());
const get = (o, path) => path.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
const firstOf = (objs, paths) => {
  for (const o of objs) {
    if (!o) continue;
    for (const p of paths) {
      const v = get(o, p);
      if (v !== undefined && v !== null && v !== "" && typeof v !== "object") return v;
    }
  }
  return undefined;
};
const firstObj = (objs, paths) => {
  for (const o of objs) {
    if (!o) continue;
    for (const p of paths) { const v = get(o, p); if (isObj(v)) return v; }
  }
  return null;
};

const wibDate = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

function normPlatform(raw) {
  const s = str(raw).toLowerCase();
  if (!s) return "";
  if (/whats|(^|\W)wa(\W|$)/.test(s)) return "WhatsApp";
  if (/insta/.test(s)) return "Instagram";
  if (/messenger|facebook|(^|\W)fb(\W|$)/.test(s)) return "Messenger";
  if (/tiktok|tik tok/.test(s)) return "TikTok";
  if (/telegram/.test(s)) return "Telegram";
  if (/web|livechat|widget/.test(s)) return "Web";
  if (/mail/.test(s)) return "Email";
  return str(raw).slice(0, 40);
}

function toDate(v) {
  if (v === undefined || v === null || v === "") return new Date();
  if (typeof v === "number" || /^\d+$/.test(String(v))) {
    const n = Number(v);
    return new Date(n < 1e12 ? n * 1000 : n);
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

const digits = (s) => str(s).replace(/\D/g, "");
function normPhone(raw) {
  let d = digits(raw);
  if (d.length < 8 || d.length > 15) return "";
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return d;
}

// Payload -> bentuk baku. event: message | conversation | other.
function parsePayload(p) {
  const roots = [p, p?.data, p?.payload, p?.body, p?.result].filter(isObj);
  const eventRaw = str(firstOf(roots, ["event", "event_type", "eventType", "type", "trigger", "name"])).toLowerCase();

  const msgObj = firstObj(roots, ["message", "msg", "last_message", "data.message"]);
  const msgSources = msgObj ? [msgObj, ...roots] : roots;
  let text = str(firstOf(msgObj ? [msgObj] : [], ["content", "text", "body", "message", "caption"]));
  if (!text) {
    const flat = firstOf(roots, ["content", "text", "body", "message_text", "message", "caption"]);
    text = str(flat);
  }
  const mediaUrl = str(firstOf(msgSources, ["media_url", "mediaUrl", "file_url", "attachment_url", "image_url", "attachments.0.data_url", "attachments.0.url"]));
  const externalId = str(firstOf(msgObj ? [msgObj] : roots, ["id", "message_id", "messageId", "external_id", "wamid"]));

  // Arah pesan.
  let direction = "";
  const mt = str(firstOf(msgSources, ["message_type", "messageType", "direction", "type"])).toLowerCase();
  if (/^(incoming|inbound|in|received|0)$/.test(mt)) direction = "in";
  else if (/^(outgoing|outbound|out|sent|1)$/.test(mt)) direction = "out";
  const fromMe = firstOf(msgSources, ["fromMe", "from_me", "is_outgoing", "isOutgoing"]);
  if (!direction && fromMe !== undefined) direction = (fromMe === true || fromMe === "true" || fromMe === 1) ? "out" : "in";
  const senderType = str(firstOf(msgSources, ["sender_type", "senderType", "sender.type", "role"])).toLowerCase();
  if (!direction && senderType) direction = /contact|customer|user|client/.test(senderType) ? "in" : /agent|bot|ai|admin|human/.test(senderType) ? "out" : "";
  if (!direction) direction = /receiv|incoming|inbound|created|new/.test(eventRaw) && !/sent|outgoing/.test(eventRaw) ? "in" : /sent|outgoing|outbound/.test(eventRaw) ? "out" : "in";

  // Kontak (utamakan objek kontak; "sender" hanya dipercaya untuk pesan masuk).
  let contact = firstObj(roots, ["contact", "customer", "conversation.meta.sender", "conversation.contact", "lead", "profile"]);
  if (!contact && direction === "in") contact = firstObj(roots, ["sender", "from", "user"]);
  const cs = contact ? [contact] : [];
  const name = str(firstOf([...cs, ...roots], ["name", "display_name", "displayName", "full_name", "push_name", "pushname", "profile_name", "contact_name", "customer_name", "sender_name"]));
  const phone = normPhone(firstOf([...cs, ...roots], ["phone_number", "phoneNumber", "phone", "msisdn", "wa_id", "whatsapp", "mobile", "contact_phone", "customer_phone", "from", "identifier"]));
  const contactId = str(firstOf([...cs, ...roots], ["contact_id", "contactId", "customer_id", "username", "identifier", "id"]));
  const convId = str(firstOf(roots, ["conversation.id", "conversation_id", "conversationId", "chat_id", "room_id"]));

  const platform = normPlatform(firstOf(roots, ["channel", "channel_type", "inbox.channel_type", "conversation.channel", "platform", "source", "inbox.name", "provider"]));

  const campaign = str(firstOf(roots, [
    "campaign_name", "campaignName", "campaign", "ad_name", "adName", "ad_title", "ad.title", "ad.name", "referral.headline", "referral.ad_title",
    "additional_attributes.campaign", "conversation.additional_attributes.campaign", "custom_attributes.campaign", "utm_campaign", "utm.campaign",
  ]));
  const adId = str(firstOf(roots, ["ad_id", "adId", "referral.source_id", "ctwa_clid", "referral.ctwa_clid", "click_id", "referral.source_url", "ad.id"]));
  const sentAt = toDate(firstOf(msgSources, ["created_at", "createdAt", "timestamp", "sent_at", "time"]));

  let kind = "other";
  if (/message|chat|pesan/.test(eventRaw) || text || mediaUrl) kind = "message";
  else if (/conversation|contact|created|updated/.test(eventRaw)) kind = "conversation";

  return { event: eventRaw, kind, direction, text, mediaUrl, externalId, name, phone, contactId, convId, platform, campaign, adId, sentAt };
}

const isPlaceholderName = (n) => !n || /^(kontak|contact|unknown|tanpa nama)/i.test(n) || /^\+?\d[\d\s-]*$/.test(n);

async function pickAssignee(admin, org) {
  const { data: members } = await admin.from("organization_members").select("user_id, role").eq("org_id", org.id);
  const reps = (members || []).filter((m) => m.role === "sales_rep" || m.role === "manager");
  const pool = reps.length ? reps : (members || []).filter((m) => m.user_id === org.owner_user_id);
  if (!pool.length) return org.owner_user_id;
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: recent } = await admin.from("leads").select("assigned_to").eq("org_id", org.id).is("deleted_at", null).gte("created_at", since).in("assigned_to", pool.map((m) => m.user_id));
  const count = new Map(pool.map((m) => [m.user_id, 0]));
  for (const l of recent || []) count.set(l.assigned_to, (count.get(l.assigned_to) || 0) + 1);
  return [...pool].sort((a, b) => (count.get(a.user_id) || 0) - (count.get(b.user_id) || 0))[0].user_id;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const key = url.searchParams.get("k") || req.headers.get("x-webhook-key") || "";
  if (!key || key.length < 32) return json({ error: "Kunci tidak valid." }, 401);
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: channel } = await admin.from("chat_channels").select("id, org_id, active, auto_assign").eq("secret", key).maybeSingle();
  if (!channel || !channel.active) return json({ error: "Kunci tidak valid." }, 401);
  const { data: org } = await admin.from("organizations").select("id, owner_user_id, features").eq("id", channel.org_id).maybeSingle();
  if (!org || org.features?.lead_webhook !== true) return json({ error: "Fitur chat masuk tidak aktif untuk organisasi ini." }, 403);

  if (req.method === "GET") return json({ ok: true, message: "Webhook siap menerima data." });
  if (req.method !== "POST") return json({ error: "Gunakan POST." }, 405);

  const raw = await req.text();
  if (raw.length > MAX_BODY) return json({ error: "Payload terlalu besar." }, 413);
  let payload;
  try { payload = JSON.parse(raw); } catch (_) { payload = { _raw: raw.slice(0, 2000) }; }

  const log = async (ok, event, note) => {
    try {
      await admin.from("chat_webhook_log").insert({ org_id: org.id, channel_id: channel.id, event: event.slice(0, 80), ok, note: note.slice(0, 300), payload: raw.length > 30000 ? { truncated: true } : payload });
      await admin.from("chat_channels").update({ last_event_at: new Date().toISOString() }).eq("id", channel.id);
      const { data: old } = await admin.from("chat_webhook_log").select("id").eq("org_id", org.id).order("received_at", { ascending: false }).range(50, 250);
      if (old?.length) await admin.from("chat_webhook_log").delete().in("id", old.map((r) => r.id));
    } catch (e) { console.error("[chat-webhook] gagal mencatat log", String(e)); }
  };

  try {
    const p = parsePayload(payload);
    if (p.kind === "other") { await log(true, p.event, "Peristiwa diabaikan (bukan pesan atau percakapan)."); return json({ ok: true, ignored: true }); }

    const contactKey = p.phone ? `tel:${p.phone}` : p.contactId ? `${(p.platform || "chat").toLowerCase()}:${p.contactId}` : p.convId ? `conv:${p.convId}` : "";
    if (!contactKey) { await log(false, p.event, "Kontak tidak terbaca dari payload (tidak ada nomor, ID kontak, atau ID percakapan)."); return json({ ok: false, error: "kontak tidak terbaca" }); }

    // Percakapan
    let { data: conv } = await admin.from("lead_conversations").select("*").eq("org_id", org.id).eq("contact_key", contactKey).maybeSingle();
    const isAd = !!(p.campaign || p.adId);
    const sourceLabel = isAd ? (p.platform === "TikTok" ? "TikTok" : "Meta") : (p.platform || "Chat");

    if (!conv) {
      // Lead: pakai yang sudah ada bila nomor telepon sama, selain itu buat baru.
      let leadId = null;
      if (p.phone) {
        const { data: found } = await admin.from("leads").select("id, phone").eq("org_id", org.id).is("deleted_at", null).ilike("phone", `%${p.phone.slice(-9)}%`).limit(1);
        if (found?.length) leadId = found[0].id;
      }
      if (!leadId) {
        const { data: stages } = await admin.from("stages").select("key, type, position").eq("org_id", org.id).order("position");
        const first = (stages || []).find((s) => s.type === "normal") || stages?.[0];
        const assignee = channel.auto_assign ? await pickAssignee(admin, org) : org.owner_user_id;
        const leadName = (isPlaceholderName(p.name) ? (p.phone ? `+${p.phone}` : `Kontak ${p.platform || "chat"}`) : p.name).toUpperCase().slice(0, 160);
        const { data: lead, error: lErr } = await admin.from("leads").insert({
          user_id: org.owner_user_id, org_id: org.id, assigned_to: assignee, name: leadName, category: "Lainnya", stage_key: first?.key,
          phone: p.phone ? `+${p.phone}` : "", source: sourceLabel, ad_campaign: p.campaign.slice(0, 200),
          next_action: "Tindak lanjuti chat masuk", last_contact: wibDate(),
        }).select("id").single();
        if (lErr) throw lErr;
        leadId = lead.id;
        const first200 = p.text ? ` Pesan pertama: "${p.text.slice(0, 200)}"` : "";
        await admin.from("progress_notes").insert({
          user_id: org.owner_user_id, org_id: org.id, lead_id: leadId, note_date: wibDate(),
          text: `Chat masuk dari ${p.platform || "sosmed"}${p.campaign ? `, kampanye ${p.campaign}` : ""}.${first200}`,
        });
      }
      const { data: created, error: cErr } = await admin.from("lead_conversations").insert({
        org_id: org.id, lead_id: leadId, channel_id: channel.id, platform: p.platform, contact_key: contactKey,
        contact_name: p.name, contact_phone: p.phone ? `+${p.phone}` : "", campaign: p.campaign, started_at: p.sentAt.toISOString(), last_message_at: p.sentAt.toISOString(),
      }).select("*").single();
      if (cErr) throw cErr;
      conv = created;
    } else {
      // Lengkapi data kontak yang tadinya kosong.
      const patch = {};
      if (!conv.contact_name && p.name) patch.contact_name = p.name;
      if (!conv.contact_phone && p.phone) patch.contact_phone = `+${p.phone}`;
      if (!conv.campaign && p.campaign) patch.campaign = p.campaign;
      if (!conv.platform && p.platform) patch.platform = p.platform;
      if (Object.keys(patch).length) { await admin.from("lead_conversations").update(patch).eq("id", conv.id); Object.assign(conv, patch); }
      if (conv.lead_id) {
        const { data: lead } = await admin.from("leads").select("name, phone, ad_campaign").eq("id", conv.lead_id).maybeSingle();
        const lp = {};
        if (lead && p.phone && !lead.phone) lp.phone = `+${p.phone}`;
        if (lead && p.campaign && !lead.ad_campaign) lp.ad_campaign = p.campaign.slice(0, 200);
        if (lead && !isPlaceholderName(p.name) && isPlaceholderName(lead.name)) lp.name = p.name.toUpperCase().slice(0, 160);
        if (Object.keys(lp).length) await admin.from("leads").update(lp).eq("id", conv.lead_id);
      }
    }

    if (p.kind === "message" && (p.text || p.mediaUrl)) {
      let dup = false;
      if (p.externalId) {
        const { data: ex } = await admin.from("lead_messages").select("id").eq("conversation_id", conv.id).eq("external_id", p.externalId).maybeSingle();
        dup = !!ex;
      }
      if (!dup) {
        const { error: mErr } = await admin.from("lead_messages").insert({
          org_id: org.id, lead_id: conv.lead_id, conversation_id: conv.id, direction: p.direction, body: p.text.slice(0, 4000), media_url: p.mediaUrl.slice(0, 1000),
          sender_name: p.direction === "in" ? (p.name || conv.contact_name || "") : "", external_id: p.externalId || null, sent_at: p.sentAt.toISOString(),
        });
        if (mErr) throw mErr;
        const upd = { last_message_at: p.sentAt.toISOString() };
        if (p.direction === "in") upd.last_inbound_at = p.sentAt.toISOString(); else upd.last_outbound_at = p.sentAt.toISOString();
        await admin.from("lead_conversations").update(upd).eq("id", conv.id);
      }
      await log(true, p.event, dup ? "Pesan sudah pernah diterima (dilewati)." : `Pesan ${p.direction === "in" ? "masuk" : "keluar"} disimpan${isAd ? " (dari iklan)" : ""}.`);
      return json({ ok: true, duplicate: dup });
    }
    await log(true, p.event, "Percakapan diperbarui.");
    return json({ ok: true });
  } catch (e) {
    console.error("[chat-webhook]", String(e?.message || e));
    await log(false, "", `Gagal memproses: ${String(e?.message || e)}`);
    return json({ ok: false, error: "gagal memproses" }, 500);
  }
});

// AUTO-GENERATED oleh scripts/demo/gen-demo-mockdb.cjs - jangan diedit manual.
export async function getMyOrgId(){ return null; }
export async function clearOrgCache(){ return null; }
export async function getMyOrg(){ return window.__D.org; }
export async function setOrgIndustry(){ return null; }
export async function switchDemoIndustry(){ return null; }
export async function getStageHistory(){ return []; }
export async function getDealsRange(){ return null; }
export async function getDealEntries(){ return []; }
export async function getTeamActivity(){ return window.__D.teamActivity; }
export async function getTeamFeed(){ return window.__D.feed; }
export async function getMemberNotes(){ return (window.__D.leads.slice(0, 6).map((l, i) => ({ id: 'mn' + i, lead_id: l.id, text: l.progressLog[0] ? l.progressLog[0].text : '', created_at: new Date(Date.now() - i * 3600000).toISOString(), leads: { name: l.name } }))); }
export async function getTeamActivityDays(){ return window.__D.activityDays; }
export async function getPaymentTerms(){ return []; }
export async function addPaymentTerm(){ return null; }
export async function updatePaymentTerm(){ return null; }
export async function deletePaymentTerm(){ return null; }
export async function getTeamTargets(){ return window.__D.targets; }
export async function setSalesTarget(){ return null; }
export async function getTeamContracts(){ return []; }
export async function getOrgMembers(){ return window.__D.members; }
export async function getMemberCommissions(){ return []; }
export async function setMemberCommissionRate(){ return null; }
export async function createInviteCode(){ return null; }
export async function getPendingInviteCodes(){ return []; }
export async function revokeInviteCode(){ return null; }
export async function redeemInviteCode(){ return null; }
export async function getMyRole(){ return window.__D.role; }
export async function getOrgDashboardStats(){ return []; }
export async function getSalesCompanyView(){ return null; }
export async function requestApproval(){ return null; }
export async function getMyLatestApproval(){ return null; }
export async function markApprovalUsed(){ return null; }
export async function getPendingApprovals(){ return []; }
export async function requestDeleteAllMyLeads(){ return null; }
export async function decideApproval(){ return null; }
export async function removeMember(){ return null; }
export async function updateMemberRole(){ return null; }
export async function leaveOrg(){ return null; }
export async function uploadAvatar(){ return null; }
export async function saveMyProfile(){ return null; }
export async function setOrgName(){ return null; }
export async function mergeCustomFieldLabels(){ return null; }
export async function generateLeads(){ return null; }
export async function getActiveLeadGenJob(){ return null; }
export async function getEnrichProgress(){ return []; }
export async function getGeneratedLeads(){ return []; }
export async function getLeadGenCooldown(){ return ({ canGenerate: true, usedThisMonth: window.__QUSED ?? 1, quotaMax: 4, nextAvailableAt: null, resetAt: new Date(Date.now() + 20 * 86400000).toISOString(), addonTokens: window.__TOK ?? 0, addonExpiry: window.__TOK ? "2027-01-05T16:59:59.000Z" : null, pendingTokenRequest: window.__PEND || null }); }
export async function requestAddonTokens(){ return (function (n, note) { window.__REQ = { n: n, note: note }; return { id: 'r1', tokens: n, created_at: new Date().toISOString(), already_pending: false }; })(arguments[0], arguments[1]); }
export async function adminAddonTokens(){ return (function (action, payload) { const st = (window.__LOTS = window.__LOTS || [{ id: 'lot1', user_id: 'u1', email: 'dian.wicaksono83@gmail.com', tokens_total: 10, tokens_left: 7, expires_at: '2027-01-05T16:59:59.000Z', note: 'Paket 10 pencarian', granted_by: 'admin', created_at: '2026-10-08T01:00:00.000Z' }, { id: 'lot2', user_id: 'u2', email: 'rina@majujaya.id', tokens_total: 5, tokens_left: 0, expires_at: null, note: 'uji', granted_by: 'admin', created_at: '2026-10-07T01:00:00.000Z' }]); if (action === 'list') return { lots: st }; if (action === 'requests') { window.__RQS = window.__RQS || [{ id: 'rq1', user_id: 'u5', email: 'rina@majujaya.id', tokens: 20, note: 'untuk klien baru', status: 'pending', created_at: '2026-10-08T02:00:00.000Z', plan: 'professional', org_name: 'CV Maju Jaya', can_generate: true }]; return { requests: window.__RQS }; } if (action === 'dismiss_request') { window.__RQS = (window.__RQS || []).filter((x) => x.id !== payload.request_id); return { ok: true }; } if (action === 'lookup') { const e = payload.email.toLowerCase(); if (e.indexOf('@') < 1) return { found: false, invalid: true }; if (e === 'dian.wicaksono83@gmail.com') return { found: true, plan: 'enterprise', org_name: 'Organisasi Saya', can_generate: true }; if (e === 'budi@standar.id') return { found: true, plan: 'standard', org_name: null, can_generate: false }; return { found: false }; } if (action === 'grant') { const lot = { id: 'lot' + (st.length + 1), user_id: 'u9', email: payload.email, tokens_total: payload.tokens, tokens_left: payload.tokens, expires_at: payload.expires_at ? payload.expires_at + 'T16:59:59.000Z' : null, note: payload.note || '', granted_by: 'admin', created_at: new Date().toISOString() }; st.unshift(lot); window.__GRANT = payload; if (payload.request_id) window.__RQS = (window.__RQS || []).filter((x) => x.id !== payload.request_id); return { lot }; } if (action === 'revoke') { const l = st.find((x) => x.id === payload.lot_id); l.note = (l.note + ' (dicabut ' + l.tokens_left + ' token)').trim(); l.tokens_left = 0; return { lot: { id: l.id, tokens_left: 0, note: l.note } }; } return {}; })(arguments[0], arguments[1]); }
export async function importGeneratedLead(){ return null; }
export async function sendLeadEmail(){ return null; }
export async function draftFollowup(){ return null; }
export async function summarizeLeadNeeds(){ return null; }
export async function getLeadNeedsSummary(){ return null; }
export async function getProductCatalog(){ return window.__D.catalog; }
export async function getShareGrantTargets(){ return []; }
export async function setShareGrant(){ return null; }
export async function getIncomingShareGrants(){ return []; }
export async function getSharedOrgSnapshot(){ return null; }
export async function listRencana(){ return null; }
export async function addRencana(){ return null; }
export async function setRencanaDone(){ return null; }
export async function deleteRencana(){ return null; }
export async function saveProductCatalog(){ return null; }
export async function deleteMyAccount(){ return null; }
export async function adminOutreach(){ return null; }
export async function adminOrgFeatures(){ return (function (action, payload) { const st = (window.__ORGF = window.__ORGF || [{ id: '1c5963cb-51a6-4b4b-bf4b-5ee7e77f68b2', name: 'Organisasi Saya', plan: 'enterprise', plan_effective: 'enterprise', paid: true, owner_email: 'dian@contoh.id', features: {} }, { id: '217d90e3-36dd-4879-99c2-0de2be11d360', name: 'Organisasi Saya', plan: 'enterprise', plan_effective: 'enterprise', paid: true, owner_email: 'budi@contoh.id', features: { lead_webhook: true } }, { id: '33333333-3333-4333-8333-333333333333', name: 'CV Maju Jaya', plan: null, plan_effective: null, paid: false, owner_email: 'rina@majujaya.id', features: {} }]); if (action === 'list') return { keys: ['marketing_report', 'lead_webhook'], orgs: st }; if (action === 'set') { const o = st.find((x) => x.id === payload.org_id); if (payload.enabled) o.features[payload.key] = true; else delete o.features[payload.key]; return { org_id: o.id, features: o.features }; } if (action === 'apply_preset') { const o = st.find((x) => x.id === payload.org_id); const P = { standar: [], marketing: ['marketing_report', 'lead_webhook'], webhook: ['lead_webhook'] }; o.features = {}; P[payload.preset].forEach((k) => { o.features[k] = true; }); return { org_id: o.id, features: o.features }; } if (action === 'detail') { const o = st.find((x) => x.id === payload.org_id); return { org: { id: o.id, name: o.name, plan: o.plan, plan_expires_at: o.plan ? '2027-01-05T16:59:59.000Z' : null, member_limit: o.plan ? 3 : 1, industry: o.industry || 'corporate_consultant', custom_field_labels: {}, features: o.features, owner_email: o.owner_email }, members: 3, leads: o.name === 'CV Maju Jaya' ? 0 : 125, leads_total: o.name === 'CV Maju Jaya' ? 0 : 128, stages: [{ key: 'prospect', label: 'Prospect', hex: '#94a3b8', type: 'normal' }, { key: 'booking', label: 'Booking', hex: '#10b981', type: 'won' }, { key: 'lost', label: 'Lost', hex: '#f43f5e', type: 'lost' }], invoices: o.plan ? [{ number: 'INV/NXT/2026/10/0001', company: o.name, status: 'paid', total: 2241000, date: '2026-10-06' }] : [], quotations: [] }; } if (action === 'apply_template') { const o = st.find((x) => x.id === payload.org_id); o.features = {}; payload.template.features.forEach((k) => { o.features[k] = true; }); const empty = o.name === 'CV Maju Jaya'; if (empty) o.industry = payload.template.industry; window.__TPL = payload; return { org_id: o.id, features: o.features, pipeline_applied: empty, leads_total: empty ? 0 : 128 }; } if (action === 'backup_list') { return { backups: window.__BK || [] }; } if (action === 'backup_create') { window.__BK = window.__BK || []; window.__BK.unshift({ id: 'bk' + (window.__BK.length + 1), label: payload.label, created_at: new Date().toISOString(), industry: 'corporate_consultant', stages: 5, leads_total: 128, features: {} }); return { backup_id: 'bk' }; } if (action === 'backup_restore') { window.__RESTORED = payload.backup_id; return { org_id: 'x', restored_from: payload.backup_id, stages: 5 }; } if (action === 'copy_features') { const o = st.find((x) => x.id === payload.org_id); const f = st.find((x) => x.id === payload.from_org_id); o.features = Object.assign({}, f.features); return { org_id: o.id, features: o.features }; } return {}; })(arguments[0], arguments[1]); }
export async function adminInvoices(){ return (function (action, payload) { const isQ = !!(payload && payload.kind === 'quotation'); const st = isQ ? (window.__QUO = window.__QUO || []) : (window.__INV = window.__INV || []); if (isQ && action === 'create') { const i = payload.invoice; const seq = st.length + 1; const row = { id: 'quo' + seq, number: 'QUO/NXT/' + i.invoice_date.slice(0, 4) + '/' + i.invoice_date.slice(5, 7) + '/' + String(seq).padStart(4, '0'), company: i.company, invoice_date: i.invoice_date, due_date: i.due_date, total: i.total, status: 'open', data: i.data, public_token: '22222222-2222-4333-8444-' + String(seq).padStart(12, '0'), email_log: [] }; st.unshift(row); return { invoice: row }; } if (isQ && action === 'set_status') { const r = st.find((x) => x.id === payload.id); r.status = payload.status; return { invoice: { id: r.id, status: r.status } }; } if (isQ && action === 'send') { const r = st.find((x) => x.id === payload.id); r.email_log = [...(r.email_log || []), { type: 'quotation', to: payload.to, at: new Date().toISOString() }]; window.__SENT = payload; return { invoice: { id: r.id, email_log: r.email_log } }; } if (isQ && action === 'mark_converted') { const r = st.find((x) => x.id === payload.id); r.status = 'accepted'; r.data = Object.assign({}, r.data, { converted: { invoice_number: payload.invoice_number, at: new Date().toISOString() } }); return { invoice: { id: r.id, status: r.status, data: r.data } }; } if (action === 'list') return { invoices: st }; if (action === 'create') { const i = payload.invoice; const seq = st.filter((x) => x.invoice_date.slice(0, 4) === i.invoice_date.slice(0, 4)).length + 1; const row = { id: 'inv' + Date.now() + seq, number: 'INV/NXT/' + i.invoice_date.slice(0, 4) + '/' + i.invoice_date.slice(5, 7) + '/' + String(seq).padStart(4, '0'), company: i.company, invoice_date: i.invoice_date, due_date: i.due_date, total: i.total, status: 'unpaid', paid_at: null, data: i.data, public_token: '11111111-2222-4333-8444-' + String(seq).padStart(12, '0'), email_log: [], reminders_enabled: true }; st.unshift(row); return { invoice: row }; } if (action === 'set_status') { const r = st.find((x) => x.id === payload.id); if (r.data && r.data.activation && payload.status !== 'paid') throw new Error('Paket dari invoice ini sudah diaktifkan.'); r.status = payload.status; r.paid_at = payload.status === 'paid' ? (payload.paid_date ? payload.paid_date + 'T05:00:00.000Z' : new Date().toISOString()) : null; return { invoice: { id: r.id, status: r.status, paid_at: r.paid_at } }; } if (action === 'send') { const r = st.find((x) => x.id === payload.id); r.email_log = [...(r.email_log || []), { type: 'invoice', to: payload.to, at: new Date().toISOString() }]; window.__SENT = payload; return { invoice: { id: r.id, email_log: r.email_log } }; } if (action === 'set_reminders') { const r = st.find((x) => x.id === payload.id); r.reminders_enabled = !!payload.enabled; return { invoice: { id: r.id, reminders_enabled: r.reminders_enabled } }; } if (action === 'get_profile') return { profile: window.__PROFILE || null }; if (action === 'save_profile') { window.__PROFILE = payload.profile; window.__PROFILE_SAVES = (window.__PROFILE_SAVES || 0) + 1; return { ok: true }; } if (action === 'check_email') { const e = payload.email.toLowerCase(); if (!(e.indexOf('@') > 0 && e.split('@')[1].indexOf('.') > 0)) return { found: false, invalid: true }; if (e === 'elevasia.indonesia@gmail.com') return { found: true, role: 'owner', org_name: 'ELEVASIA', org_plan: 'enterprise', expires_at: '2026-11-01T16:59:59.000Z' }; return { found: false }; } if (action === 'activation_preview' || action === 'activate') { const r = st.find((x) => x.id === payload.id); const d = r.data; const email = (payload.email || d.email || '').toLowerCase(); const problems = []; if (!email) problems.push('Invoice tidak memiliki email klien. Isi email akun owner klien.'); else if (email.indexOf('belum') === 0) problems.push('Belum ada akun Nexto dengan email ' + email + '. Minta klien mendaftar dengan email ini terlebih dahulu.'); const pl = d.plan === 'custom' ? (payload.plan || d.activatePlan || 'enterprise') : d.plan; const ent = pl === 'enterprise'; const preview = { plan: pl, planLabel: ent ? 'Enterprise' : pl === 'professional' ? 'Professional' : 'Standard', seats: d.seats, email, expires_at: d.end + 'T16:59:59.000Z', user: problems.length ? null : { id: 'u1', email }, org: ent && !problems.length ? { id: 'o1', name: d.company, plan: 'enterprise', member_limit: 4, members: 3, plan_expires_at: '2026-10-20T16:59:59.000Z' } : null, current: !ent && !problems.length ? { plan: null, plan_expires_at: null } : null, problems, warnings: ent && !problems.length ? ['Contoh peringatan dari server.'] : [] }; if (action === 'activation_preview') return { preview }; if (problems.length) throw new Error(problems[0]); r.data = Object.assign({}, d, { activation: { at: new Date().toISOString(), email, plan: pl, seats: d.seats, expires_at: preview.expires_at } }); return { invoice: { id: r.id, data: r.data } }; } return {}; })(arguments[0], arguments[1]); }
export async function adminCashflow(){ return null; }
export async function getAdminStatus(){ return []; }
export async function callAdminTrigger(){ return null; }
export async function sendSupportChatMessage(){ return null; }
export async function flagHealthIssue(){ return null; }
export async function saveOutcome(){ return null; }
export async function clearOutcome(){ return null; }
export async function guessOutcomeReason(){ return null; }
export async function suggestVisitPoints(){ return null; }
export async function getStages(){ return window.__D.stages; }
export async function saveStages(){ return null; }
export async function initDefaultStages(){ return null; }
export async function getSettings(){ return window.__D.settings; }
export async function markOnboardingLevelSeen(){ return null; }
export async function getLeads(){ return window.__D.leads; }
export async function upsertLead(){ return null; }
export async function deleteLead(){ return null; }
export async function deleteAllLeads(){ return null; }
export async function getDeletedLeads(){ return []; }
export async function restoreLead(){ return null; }
export async function permanentlyDeleteLead(){ return null; }
export async function updateLeadNextAction(){ return null; }
export async function cancelVisit(){ return null; }
export async function updateLeadsBulk(){ return null; }
export async function updateLeadAssignee(){ return null; }
export async function saveLeadLocation(){ return null; }
export async function reverseGeocode(){ return null; }
export async function uploadCheckinPhoto(){ return null; }
export async function verifySelfiePhoto(){ return null; }
export const formatQuotaDate = (iso) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
export async function getCheckinCooldown(){ return ({ canCheckIn: true, usedThisMonth: 2, quotaMax: 20, nextAvailableAt: null, resetAt: new Date(Date.now() + 20 * 86400000).toISOString() }); }
export async function checkIn(){ return null; }
export async function getTodayCheckedInLeadIds(){ return []; }
export async function getCheckins(){ return []; }
export async function getMyNotifications(){ return []; }
export async function getUnreadNotificationCount(){ return 0; }
export async function markNotificationRead(){ return null; }
export async function markAllNotificationsRead(){ return null; }
export async function addProgress(){ return null; }
export async function deleteProgress(){ return null; }
export async function updateProgress(){ return null; }
export async function uploadMeetingAudio(){ return null; }
export async function transcribeMeeting(){ return null; }
export async function leadFromUrl(){ return null; }
export async function uploadQuickVoiceNote(){ return null; }
export async function transcribeQuickVoiceNote(){ return null; }
export async function classifyQuickText(){ return (function () { const l = (window.__LEADS || [])[0]; return { transcript: 'catatan meeting', action: 'update_lead', lead_id: l ? l.id : null, lead_name: l ? l.name : null, confidence: 'high', progress_note: 'Meeting dengan klien, minta penawaran ulang.', updates: { next_action: 'Kirim penawaran revisi' }, cancel_visit: false, result: null, new_lead: null, quota: { used: 118, max: 125, reset_at: null } }; })(); }
export async function getQuickVoiceQuota(){ return ({ used: 117, max: 125, reset_at: null }); }
export async function listStageChanges(){ return window.__D.stageChanges; }
export async function ensureChatChannel(){ return (function () { return { id: 'c1', secret: 'ac5b8e5ec93e48fb91d5828302432a9958b55362215448e5b715dfff7b970d45', active: true, auto_assign: true, last_event_at: '2026-10-08T14:42:39Z' }; })(); }
export async function getChatWebhookLog(){ return (function () { return [{ id: 'l1', received_at: '2026-10-08T14:42:39Z', event: 'message_received', ok: true, note: 'Pesan masuk disimpan.', payload: { event: 'message_received', text: 'kak ada katalog?' } }, { id: 'l2', received_at: '2026-10-08T14:40:00Z', event: 'message_created', ok: false, note: 'Kontak tidak terbaca dari payload.', payload: { event: 'message_created' } }]; })(); }
export async function getRecommendationEffect(){ return ({ hari: 90, total: 37, ditindaklanjuti: { n: 9, maju: 4, menang: 1, kalah: 0 }, tidak_ditindaklanjuti: { n: 28, maju: 3, menang: 0, kalah: 2 }, dipakai_eksplisit: 0, tidak_berguna_eksplisit: 0, per_jenis: [] }); }
export async function rateRecommendation(){ return null; }
export async function listChatWaiting(){ return (function () { const h = (n) => new Date(Date.now() - n * 3600000).toISOString(); const L = (window.__LEADS || []); const id = (i) => (L[i] ? L[i].id : 'x' + i); return [{ id: 'c1', lead_id: id(0), platform: 'whatsapp', campaign: 'Promo Jendela uPVC', last_inbound_at: h(5), last_outbound_at: h(8) }, { id: 'c2', lead_id: id(1), platform: 'instagram', campaign: '', last_inbound_at: h(3), last_outbound_at: null }, { id: 'c3', lead_id: id(2), platform: 'tiktok', campaign: '', last_inbound_at: h(6), last_outbound_at: h(5) }]; })(); }
export async function getLeadConversation(){ return (function () { return { conv: { id: 'v1', platform: 'WhatsApp', campaign: 'Promo Jendela uPVC', last_inbound_at: '2026-10-08T14:42:31Z' }, messages: [{ id: 'm1', direction: 'in', body: 'Halo, mau tanya harga jendela uPVC untuk rumah 2 lantai', sender_name: 'Budi Hartono', sent_at: '2026-10-08T14:42:31Z' }, { id: 'm2', direction: 'out', body: 'Halo Pak Budi, boleh share lokasi proyek?', sender_name: '', sent_at: '2026-10-08T14:43:00Z' }] }; })(); }
export async function listAdSpend(){ return ((from, to) => window.__D.ads.filter((a) => a.day >= from && a.day <= to))(arguments[0], arguments[1]); }
export async function importAdSpend(){ return (function (rows) { window.__IMPORTED = rows; return rows.length; })(arguments[0]); }
export async function deleteAdSpendRange(){ return (function () { window.__ADS = []; return null; })(); }
export async function listAdExpenses(){ return []; }
export async function addAdExpense(){ return null; }
export async function deleteAdExpense(){ return null; }
export async function listAdBudgets(){ return []; }
export async function setAdBudget(){ return null; }
export async function getDealTransactions(){ return window.__D.deals; }
export async function getOutcomeEvents(){ return []; }
export async function addDealTransaction(){ return null; }
export async function deleteDealTransaction(){ return null; }
export async function smartImportMap(){ return null; }
export async function bulkInsertLeads(){ return null; }
export async function getCompetitors(){ return window.__D.competitors; }
export async function upsertCompetitor(){ return null; }
export async function deleteCompetitor(){ return null; }
export async function getAdvisorHistory(){ return [window.__D.advisorRun]; }
export async function getTodayAdvisorRun(){ return window.__D.advisorRun; }
export async function getMemoryHealth(){ return null; }
export async function getLatestPipelineReview(){ return null; }
export async function exportAllData(){ return null; }
export async function computeMergeFill(){ return null; }
export async function mergeLeads(){ return null; }
export async function getGoogleCalendarLink(){ return null; }
export async function connectGoogleCalendar(){ return null; }
export async function disconnectGoogleCalendar(){ return null; }
export async function bulkSyncCalendar(){ return null; }
export async function getCommunityDisplayName(){ return null; }
export async function uploadCommunityImage(){ return null; }
export async function getCommunityPosts(){ return []; }
export async function createCommunityPost(){ return null; }
export async function deleteCommunityPost(){ return null; }
export async function toggleCommunityLike(){ return null; }
export async function incrementCommunityShare(){ return null; }
export async function getReplies(){ return []; }
export async function addReply(){ return null; }
export async function deleteReply(){ return null; }
export async function getCurrentUserId(){ return "u1"; }
export async function getMyAiRating(){ return null; }
export async function setAiRating(){ return null; }
export async function getMyAiRatings(){ return []; }
export async function getSuggestedCategories(){ return []; }
export async function bulkUpdateCategory(){ return null; }
export async function bulkMarkLost(){ return null; }

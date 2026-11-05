import { getCustomFieldSlots } from "./industryTemplates";
import { normalizePlatform } from "./adsImport";

// Slot isian "Sumber lead" dari template industri org (null kalau org tidak punya).
export function sourceSlotOf(org) {
  return getCustomFieldSlots(org?.industry, org?.custom_field_labels).find((s) => /sumber/i.test(s.label)) || null;
}

// Sumber satu lead. Dibaca sama di tab Report, Deal, dan Iklan:
// isian "Sumber lead" bila ada, selain itu kolom sumber bawaan.
export function sourceOfLead(lead, slot) {
  return normalizePlatform((slot ? lead[slot.key] : "") || lead.source || "") || "Tidak diisi";
}

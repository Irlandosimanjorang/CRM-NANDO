// Saklar fitur per organisasi (8 Okt 2026). Kolom organizations.features berisi
// {"nama_fitur": true}; fitur yang tidak tercantum dianggap mati. Hanya admin
// platform yang boleh mengubahnya (dijaga trigger protect_organizations_privileged_columns).
//
// Pakai untuk fitur yang sengaja tidak untuk semua klien:
//   {hasOrgFeature(org, "marketing_report") && <TabMarketing />}
// Fungsi/aturan di server untuk fitur itu juga harus mengecek kolom yang sama,
// supaya yang tahu alamatnya tidak bisa memakainya walau menunya tersembunyi.
// Menyalakan untuk satu klien (jalankan sebagai admin):
//   update organizations set features = features || '{"marketing_report": true}' where id = '<org id>';
export const hasOrgFeature = (org, key) => org?.features?.[key] === true;

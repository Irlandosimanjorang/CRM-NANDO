# Nexto CRM - MCP Server (buat submission ke Grok Bot / marketplace agent AI)

Dokumen ini isinya materi yang dibutuhin buat ngajuin Nexto sebagai connector/MCP
server pihak ketiga ke Grok Bot (xAI) atau platform agent lain yang support
Model Context Protocol (MCP). Bisa dipake buat isi form self-serve (kalau ada)
maupun buat reach out manual ke tim xAI.

## Info dasar

- **Nama**: Nexto CRM
- **Kategori**: Sales / CRM
- **Website**: https://nexto.site
- **Deskripsi singkat**: Nexto adalah CRM sales berbahasa Indonesia dengan AI
  bawaan (analisis lead harian, transkripsi meeting, draft follow-up, deteksi
  duplikat) buat UMKM & tim sales B2B. MCP server ini kasih agent AI luar
  (misal Grok Bot) akses buat baca & kelola data lead/pipeline pengguna secara
  aman dan terbatas.
- **Kontak developer**: Irlando Simanjorang (Nando) - simanjorangirlando@gmail.com

## Endpoint MCP

```
Server URL: https://cewggulyfshnbebcpyui.supabase.co/functions/v1/mcp-server
Transport : MCP Streamable HTTP (JSON-RPC 2.0 via POST), stateless (gak butuh Mcp-Session-Id)
Auth      : Authorization: Bearer <API key per akun Nexto>
```

Contoh config MCP client (`.mcp.json`):

```json
{
  "mcpServers": {
    "nexto-crm": {
      "url": "https://cewggulyfshnbebcpyui.supabase.co/functions/v1/mcp-server",
      "headers": {
        "Authorization": "Bearer <API_KEY_DARI_AKUN_NEXTO_USER>"
      }
    }
  }
}
```

## Model keamanan

- API key per akun, di-generate & bisa di-revoke independen dari login utama
  (gak pernah pakai email/password akun Nexto).
- Key disimpan sebagai hash SHA-256 di database - plaintext cuma ditunjukin
  sekali pas dibuat, gak bisa diambil ulang.
- Semua tools discoped ke `org_id` pemilik key - gak bisa baca/tulis data
  organisasi/akun lain.
- Cakupan aksi terbatas ke 7 tools eksplisit di bawah - gak ada akses generik
  ke settings, billing, atau manajemen anggota organisasi.

## Tools yang tersedia

| Tool | Deskripsi |
|---|---|
| `list_leads` | List lead/prospek, bisa difilter stage/kategori/priority/nama. |
| `get_lead` | Detail lengkap satu lead + progress notes terbaru. |
| `create_lead` | Buat lead/prospek baru. |
| `update_lead_stage` | Pindahin lead ke stage pipeline lain. |
| `add_progress_note` | Tambah catatan aktivitas/progress ke satu lead. |
| `list_stages` | List stage pipeline yang ada (key, label, tipe). |
| `get_pipeline_stats` | Ringkasan statistik: lead aktif, overdue follow-up, win rate. |

## Contoh use case buat sales team

- "Cek lead mana yang overdue follow-up hari ini, terus catetin hasil WA gua
  ke tiap lead itu."
- "Bikin lead baru buat PT Sumber Makmur, kategori distribusi, priority
  tinggi."
- "Pindahin lead PT Sumber Makmur ke stage negosiasi."
- "Kasih summary win rate pipeline gua bulan ini."

## Status saat ini (per 12 Sep 2026)

- MCP server sudah live & ditest manual (initialize/tools list/tools call) -
  berfungsi dengan baik.
- API key baru di-generate manual per akun (belum ada UI self-serve buat
  user lain generate sendiri) - masih tahap testing dengan 1 akun (founder).
- Belum ada rate limiting khusus di endpoint ini.
- Belum submit ke marketplace resmi Grok Bot - dokumen ini disiapin buat
  proses itu.

# Security & Privacy

X-ray adalah **data kesehatan**. Prinsipnya: simpan sesedikit mungkin, hanya bila pengguna memilih, dan bisa dihapus permanen.

## 1. Apa disimpan, di mana

| Data | Tamu | Login | Login + "Jangan simpan" |
|---|---|---|---|
| Gambar X-ray | Memori server selama request, lalu dibuang. Salinan terkompres di `sessionStorage` tab | Supabase Storage privat | Seperti tamu |
| Deteksi + heatmap | `sessionStorage` | Tabel `scans` + Storage | `sessionStorage` |
| Insight | `sessionStorage` | `scans.insight` | `sessionStorage` |
| Chat | `sessionStorage` | `chats`, `chat_messages` | `sessionStorage` |
| IP | Hash SHA-256 + salt di `usage_counters` (kuota) | Tidak dipakai | Tidak dipakai |
| Log server | Tanpa gambar, tanpa isi chat, tanpa IP mentah | Sama | Sama |

`sessionStorage` hilang saat tab ditutup. Tidak ada `localStorage` untuk data scan.

Gambar contoh ("Coba contoh") bukan data pengguna: X-ray publik berlisensi CC BY dari Wikimedia Commons dan Mendeley Data, tanpa nama atau identitas pasien yang terlihat. Hasilnya dihitung sekali dan ikut di repo, jadi memilih contoh tidak mengirim apa pun ke Gemini atau API inferensi.

## 2. Pihak ketiga

| Pihak | Menerima | Untuk |
|---|---|---|
| Google Gemini (free tier) | Gambar terkompres | Validasi "apakah ini X-ray gigi" |
| Google Gemini (free tier) | Daftar temuan (teks), ringkasan insight sebelumnya, pesan chat (maks 20 terakhir) | Insight & chat |
| Hugging Face Spaces | Gambar terkompres | Inferensi; tidak disimpan oleh `api/` |
| Supabase | Data akun login | Auth, DB, Storage |
| Vercel | Request HTTP | Hosting web |

Gemini free tier: Google boleh memakai prompt dan respons untuk meningkatkan produknya. **Ini wajib tertulis di halaman Privasi**, beserta saran "jangan upload gambar yang memuat nama atau data pribadi". Halaman upload menautkan ke halaman Privasi.

## 3. Hapus data

- Hapus scan → hapus objek Storage (`original.jpg`, `heatmap-*.png`) → hapus baris `scans` (chat terkait ikut cascade).
- Hapus akun → hapus semua objek di prefix `{user_id}/` → `auth.admin.deleteUser` → cascade ke semua tabel.
- Tidak ada soft delete untuk data kesehatan.

## 4. Ancaman & mitigasi

| Ancaman | Mitigasi |
|---|---|
| User A membaca scan user B | RLS pemilik di semua tabel + policy Storage per prefix + cek kepemilikan di Route Handler; pgTAP |
| Spam scan menghabiskan CPU / kuota Gemini | Kuota harian per user / hash IP (`consume_quota` atomik), antrean 1 inferensi |
| Upload file berbahaya | Cek magic bytes JPEG/PNG, batas ukuran, decode ulang lewat Pillow/OpenCV; file tidak pernah disajikan apa adanya |
| API inferensi dipanggil langsung | Header `X-API-Secret`, dibandingkan dengan `hmac.compare_digest` |
| Prompt injection lewat chat | Pesan user selalu giliran `user`; konteks ditandai sebagai data; output dirender sebagai teks |
| Import hasil tamu dipalsukan | Diterima: data palsu hanya memengaruhi riwayat milik sendiri. Divalidasi skema + batas ukuran |
| Kebocoran secret | Secret hanya di env server (`server-only`), `.env*` di `.gitignore`, scan pola key sebelum commit |
| Hasil disalahartikan sebagai diagnosis | Disclaimer, copy, guardrail ([ai-design.md](ai-design.md)) |

## 5. Header & sesi

- Cookie auth Supabase: `HttpOnly`, `Secure`, `SameSite=Lax` (bawaan `@supabase/ssr`).
- CSP ketat di `next.config` (script dari self, gambar dari self + domain Supabase Storage + `blob:`/`data:`).
- CORS `api/` tertutup: hanya dipanggil server-ke-server.

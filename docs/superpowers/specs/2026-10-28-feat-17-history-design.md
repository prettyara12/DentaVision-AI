# Spec: feat(history): riwayat & hapus data (Issue #17)

## 1. Konteks & Tujuan
Implementasi riwayat scan & chat serta fitur penghapusan data untuk pengguna yang login sesuai dengan:
- **PRD**: US-09 (Riwayat scan & chat), US-11 (Opsi Jangan simpan), US-12 (Hapus data scan/chat/akun), F10.
- **User Flows**: Rute `/history`, `/scans/[id]`, `/chats/[id]`, `/settings`.
- **Architecture**: §4.1 (Route DELETE, POST /api/scans, POST /api/chat, POST /api/insight), §5, §5.1, §5.2.
- **Security & Privacy**: §3 (Hapus data: Storage dulu baru DB, tidak ada soft delete untuk data kesehatan).
- **Design System**: Konsep "Lightbox", token warna & tipografi, aturan anti-AI-slop.

## 2. Di Luar Scope
- Import hasil scan tamu & penegakan kuota harian (Issue #18).
- UI toggle "Jangan simpan" di form upload landing page (Issue #19). Parameter form data `save` di backend tetap didukung dan dihormati.

## 3. Database & TypeScript Types
- Menjalankan `npx supabase gen types typescript --linked` untuk menghasilkan `web/src/lib/supabase/database.types.ts`.
- `createClient()` di `web/src/lib/supabase/server.ts` diketik dengan tipe `Database`.
- Membuat `createAdminClient()` di `web/src/lib/supabase/admin.ts` menggunakan `SUPABASE_SERVICE_ROLE_KEY` untuk operasi administratif (`auth.admin.deleteUser` dan update insight via service role).

## 4. API Endpoints

### 4.1 POST `/api/scans` (Penyimpanan Scan)
- Membaca form data: `image`, `locale`, dan opsi `save` (default `"true"`).
- Jika pengguna login (memiliki sesi auth aktif) dan `save !== "false"`:
  1. Hasilkan `scanId = crypto.randomUUID()`.
  2. Upload `image` (JPEG) ke Supabase Storage bucket `scans` di `{user_id}/{scan_id}/original.jpg`.
  3. Upload setiap heatmap PNG (dari `result.heatmaps`) ke Storage di `{user_id}/{scan_id}/heatmap-{class_id}.png`.
  4. Simpan record ke tabel `public.scans` (`id: scan_id`, `user_id`, `image_path`, `image_width`, `image_height`, `model_version`, `detections`, `heatmap_class_ids`, `source: 'upload'`).
  5. Kirim event hasil dengan properti `scanId`: `{ type: "result", result, scanId }`.
- Jika tamu atau `save === "false"`:
  - Kirim event hasil standar `{ type: "result", result }` tanpa menyimpan ke DB/Storage.

### 4.2 POST `/api/chat` (Penyimpanan Pesan)
- Menerima `chatId?: string` atau `scanId?: string`.
- Jika pengguna login:
  - Jika belum ada chat untuk sesi tersebut: buat record di `public.chats` (`user_id`, `scan_id`, `title`).
  - Simpan pesan pengguna ke `public.chat_messages` (`chat_id`, `role: 'user'`, `content`).
  - Lakukan streaming jawaban Gemini.
  - Saat selesai (`done`): simpan pesan asisten ke `public.chat_messages` (`chat_id`, `role: 'model'`, `content`), dan sertakan `chatId` pada event `{ type: "done", chatId }`.

### 4.3 POST `/api/insight` (Penyimpanan Insight)
- Menerima `scanId?: string`.
- Jika `scanId` dikirim dan dimiliki oleh pengguna login:
  - Pada event `done`: update record `scans` menggunakan admin/service client dengan data `insight`, `insight_locale`, `insight_prompt_version`.

### 4.4 DELETE `/api/scans/[id]`
- Autentikasi: wajib login.
- Validasi kepemilikan scan: query `scans` dengan `id = params.id` dan `user_id = auth.uid()`.
- Hapus file di Storage:
  - List objek pada prefix `{user_id}/{scan_id}/` di bucket `scans`.
  - Hapus semua objek yang ditemukan (termasuk `original.jpg` dan `heatmap-*.png`).
- Hapus row di tabel `public.scans`:
  - Supabase cascade akan otomatis menghapus record di `chats` dan `chat_messages` yang berelasi dengan scan tersebut.
- Response: 204 No Content.

### 4.5 DELETE `/api/chats/[id]`
- Autentikasi: wajib login.
- Validasi kepemilikan: query `chats` dengan `id = params.id` dan `user_id = auth.uid()`.
- Hapus row di tabel `public.chats` (cascade menghapus `chat_messages`).
- Response: 204 No Content.

### 4.6 DELETE `/api/account`
- Autentikasi: wajib login.
- Hapus Storage:
  - List semua file pengguna di bucket `scans` (prefix `{user_id}/`).
  - Hapus semua objek. Jika gagal, gagalkan request dan kembalikan 500 (data DB tidak dihapus).
- Hapus Pengguna Auth:
  - Panggil `supabaseAdmin.auth.admin.deleteUser(user.id)`.
  - Postgres cascade dari `auth.users on delete cascade` akan otomatis menghapus baris di `profiles`, `scans`, `chats`, `chat_messages`.
- Response: 204 No Content.

## 5. Halaman & UI

### 5.1 `/history` (Riwayat Scan & Chat)
- Server Component + Client Tabs:
  - Autentikasi: redirect ke `/[lang]/login?next=/[lang]/history` bila belum login.
  - Tab 1: **Scan Gigi** (`scans`). Menampilkan daftar kartu scan: thumbnail (signed URL 1 jam), tanggal format lokal, badge jumlah temuan perhatian 🔴 (`finding-attention`), tombol "Buka Scan", dan tombol ikon Hapus.
  - Tab 2: **Percakapan** (`chats`). Menampilkan daftar sesi chat: judul percakapan, tanggal pembaruan terakhir, label jenis (Umum atau Per Scan), tombol "Buka Chat", dan tombol ikon Hapus.
  - State kosong (Empty State) yang jelas:
    - Tab Scan kosong: pesan informatif + CTA tombol "Upload X-ray baru".
    - Tab Chat kosong: pesan informatif + CTA tombol "Mulai konsultasi chat".
  - Dialog Konfirmasi Hapus:
    - Modal ringkas konfirmasi sebelum eksekusi `DELETE /api/scans/[id]` atau `DELETE /api/chats/[id]`.

### 5.2 `/scans/[id]` (Hasil Scan Tersimpan)
- Server Component:
  - Memverifikasi login dan mengambil data scan dari database `scans`.
  - Validasi schema `detections` dengan Zod (`analyzeResultSchema.shape.detections`).
  - Membuat signed URL 1 jam untuk `image_path` di bucket `scans`.
  - Mengambil heatmap PNG dari Storage dan menyiapkannya dalam format base64 dictionary untuk `xray-viewer`.
  - Mengambil chat yang berelasi dengan scan tersebut dari `chats` & `chat_messages`.
  - Merender `ResultWorkspace` dengan mode tersimpan (`scanId`, signed image URL, detections, heatmaps, insight tersimpan, riwayat chat). Tanpa inferensi ulang!

### 5.3 `/chats/[id]` (Riwayat Chat Tersimpan)
- Server Component:
  - Memverifikasi login dan mengambil riwayat percakapan dari `chats` dan `chat_messages`.
  - Menyiapkan konteks scan bila chat terkait dengan `scan_id`.
  - Merender antarmuka `GeneralChat` atau `ChatPanel` dengan pesan yang sudah termuat dan kemampuan melanjutkan percakapan.

### 5.4 `/settings` (Pengaturan & Hapus Akun)
- Server Component + Client Form:
  - Memverifikasi login. Menampilkan informasi akun (email, tanggal bergabung).
  - Bagian zona bahaya (Danger Zone): "Hapus Akun & Data".
  - Menjelaskan bahwa seluruh data (scan, gambar X-ray di storage, percakapan) akan dihapus secara permanen tanpa opsi pemulihan.
  - Modal konfirmasi dengan input teks: pengguna harus mengetik "HAPUS" (atau "DELETE" dalam bahasa Inggris) sebelum tombol "Hapus Akun Permanen" aktif.
  - Setelah berhasil dihapus, bersihkan sesi dan redirect ke landing page.

### 5.5 Navigasi SiteHeader
- Untuk pengguna login, tambahkan link "Riwayat" (`/[lang]/history`) dan "Pengaturan" (`/[lang]/settings`) di header.

## 6. Pengujian & Verifikasi
1. **Unit & Integration Test**:
   - `DELETE /api/scans/[id]`, `DELETE /api/chats/[id]`, `DELETE /api/account` (cek autentikasi, otorisasi, urutan hapus storage lalu DB).
   - Validasi Zod `detections` pada query scan.
   - `POST /api/scans` pengujian penyimpanan scan vs opsi "save: false".
2. **Lint, Typecheck, Test, Build**:
   - `cd web && npm run lint && npm run typecheck && npm test && npm run build`.
3. **Pemeriksaan UI**:
   - Responsif 360 px, tablet, desktop.
   - Tema terang dan gelap.
   - Lokalisasi Bahasa Indonesia (`/id`) dan English (`/en`).
   - Aksesibilitas keyboard dan focus indicator.

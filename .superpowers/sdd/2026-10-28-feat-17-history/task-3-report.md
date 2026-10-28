# Task 3 Report: Route Handlers DELETE & Updates to POST Scans / Chat / Insight

## Ringkasan Implementasi
Task 3 telah menyelesaikan implementasi endpoint DELETE untuk scan, chat, dan akun, serta pembaruan endpoint POST (`/api/scans`, `/api/chat`, `/api/insight`) untuk mendukung penyimpanan data pengguna yang login secara aman.

### 1. Endpoint DELETE
- `DELETE /api/scans/[id]`:
  - Mengambil param dinamis via Next.js 16 Promise: `await props.params`.
  - Memeriksa sesi via `currentUser()`. Jika tidak login, merespons `401 unauthorized`.
  - Memanggil `deleteScan(supabase, user.id, id)` yang menghapus file Storage terlebih dahulu sebelum baris DB.
  - Merespons `404 not_found` jika scan tidak ditemukan, `500 storage_error` jika terjadi kegagalan Storage/DB, dan `204 No Content` pada keberhasilan.
- `DELETE /api/chats/[id]`:
  - Mengambil param dinamis via Next.js 16 Promise: `await props.params`.
  - Memeriksa sesi via `currentUser()`. Merespons `401 unauthorized` jika belum login.
  - Memanggil `deleteChat(supabase, user.id, id)`.
  - Merespons `404 not_found` jika chat tidak ditemukan/bukan milik user, `500 database_error` jika gagal, dan `204 No Content` pada keberhasilan.
- `DELETE /api/account`:
  - Memeriksa sesi via `currentUser()`. Merespons `401 unauthorized` jika belum login.
  - Memanggil `deleteAccount(createAdminClient(), supabase, user.id)`:
    - Menghapus seluruh folder `{user_id}/` di bucket Storage `scans`.
    - Jika gagal menghapus objek Storage, proses berhenti dengan `500 storage_error` tanpa menghapus akun auth pengguna.
    - Jika Storage bersih, memanggil `adminClient.auth.admin.deleteUser(user.id)` yang melakukan cascade delete ke semua tabel (`scans`, `chats`, `chat_messages`, `profiles`).
  - Merespons `204 No Content` pada keberhasilan.

### 2. Pembaruan Endpoint POST
- `POST /api/scans`:
  - Membaca field form `save` (default `"true"`).
  - Jika pengguna login (`currentUser()`) dan `save !== "false"`:
    - Membuat UUID `scanId`.
    - Memanggil `saveScanUpload(supabase, user.id, scanId, bytes, outcome.result)`.
    - Mengirim event NDJSON `{ type: "result", result: outcome.result, scanId }`.
  - Jika tamu atau `save === "false"`, mengirim event `{ type: "result", result: outcome.result }` tanpa menyimpan ke server.
- `POST /api/chat`:
  - Memperbarui `chatRequestSchema` di `@/features/chat/chat` untuk menerima `chatId: z.string().uuid().optional()` dan `scanId: z.string().uuid().optional()`.
  - Memperbarui `ChatEvent` dengan `chatId?: string` pada event `done`.
  - Jika pengguna login:
    - Jika `chatId` disertakan: memvalidasi kepemilikan chat (`user_id = user.id`). Jika tidak ditemukan, merespons `404 not_found`.
    - Jika `scanId` disertakan: mencari chat yang sudah ada untuk scan tersebut atau membuat row baru di `chats` (`title: "Chat Scan"`).
    - Jika chat umum: membuat row baru di `chats` (`title: userQuestion.slice(0, 50)`).
    - Menyimpan pesan pengguna ke tabel `chat_messages` (`role: "user"`).
    - Streaming token dari Gemini.
    - Pada penyelesaian stream, menyimpan respons model ke `chat_messages` (`role: "model"`).
    - Mengirim event `{ type: "done", chatId }`.
- `POST /api/insight`:
  - Memperbarui `requestSchema` untuk menerima `scanId: z.string().uuid().optional()`.
  - Jika pengguna login dan `scanId` disertakan:
    - Memvalidasi kepemilikan scan (`user_id = user.id`). Jika tidak ditemukan, merespons `404 not_found`.
    - Saat streaming selesai (`done`), mengupdate kolom `insight`, `insight_locale`, dan `insight_prompt_version` pada tabel `scans` menggunakan `createAdminClient()`.

### 3. File yang Dibuat / Dimodifikasi
- Dibuat:
  - `web/src/app/api/scans/[id]/route.ts`
  - `web/src/app/api/scans/[id]/route.test.ts`
  - `web/src/app/api/chats/[id]/route.ts`
  - `web/src/app/api/chats/[id]/route.test.ts`
  - `web/src/app/api/account/route.ts`
  - `web/src/app/api/account/route.test.ts`
- Dimodifikasi:
  - `web/src/features/chat/chat.ts`
  - `web/src/features/scan/result.ts`
  - `web/src/app/api/scans/route.ts`
  - `web/src/app/api/scans/route.test.ts`
  - `web/src/app/api/chat/route.ts`
  - `web/src/app/api/chat/route.test.ts`
  - `web/src/app/api/insight/route.ts`
  - `web/src/app/api/insight/route.test.ts`

### 4. Hasil Pengujian
- Unit tests: 22 test files passed, 173 tests passed.
- Lint, typecheck, dan build diverifikasi.

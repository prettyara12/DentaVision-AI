# PRD — DentaVision AI

| | |
|---|---|
| Status | Draft v1 |
| Tanggal | 2026-10-25 |
| Pemilik repo | prettyara12 |
| Kolaborator | Adriel Walintukan |
| Repo | `github.com/prettyara12/DentaVision-AI` (public) |

## 1. Masalah

Banyak orang sudah memegang foto rontgen panoramik gigi (OPG) dari klinik, tapi tidak paham isinya. Mereka baru tahu kondisinya saat duduk di kursi dokter gigi, atau tidak pernah bertanya sama sekali.

- Istilah di hasil rontgen (periapical lesion, bone loss, impacted) asing bagi orang awam.
- Orang ingin **kroscek** penjelasan dokter, atau tahu gambaran kasar sebelum konsultasi.
- Alat AI dental yang ada (Pearl, Overjet, Diagnocat) dibuat untuk klinik, bukan untuk pasien.

## 2. Solusi

Web tempat siapa saja meng-upload X-ray panoramik dan mendapat:

1. **Kotak temuan** di atas gambar, dari model deteksi YOLOv8m + backbone ResNet50 (31 kelas).
2. **Pengelompokan yang dimengerti orang awam**: 🔴 perlu perhatian, 🔵 perawatan/alat yang sudah ada, ⚪ anatomi normal ([class-catalog.md](class-catalog.md)).
3. **Heatmap Grad-CAM per kelas**: "di bagian mana AI melihat".
4. **Ringkasan AI** dalam bahasa awam, plus pertanyaan yang bisa dibawa ke dokter gigi.
5. **Chat** tentang hasil scan, dan chat umum tentang kesehatan gigi.

Produk ini **alat bantu pemahaman, bukan diagnosis**. Disclaimer tampil di setiap halaman hasil.

## 3. Tujuan & non-goals

**Tujuan MVP**

1. Pengunjung tanpa X-ray bisa mencoba alur lengkap dalam < 60 detik lewat tombol "Coba contoh".
2. Hasil deteksi + heatmap tampil < 15 detik setelah upload (server sudah bangun, CPU).
3. Biaya operasional **Rp0** (lihat §8).
4. Tampilan setara produk profesional di desktop dan HP 360 px ([design-system.md](design-system.md)).

**Non-goals (MVP)**

- Diagnosis, rencana perawatan, atau rekomendasi obat/dosis.
- Penomoran gigi (FDI). Model tidak dilatih untuk itu.
- Rontgen selain panoramik (periapikal, bitewing, CBCT).
- Fitur untuk dokter/klinik, billing, aplikasi native.
- Melatih ulang model. Checkpoint `best_resnet50.pt` dipakai apa adanya.

## 4. Pengguna & role

| Role | Bisa | Data disimpan |
|---|---|---|
| **Tamu** | Scan, lihat hasil, insight, chat per scan, chat umum | Tidak ada di server. Hasil hidup di tab (`sessionStorage`) |
| **Pengguna login** | Semua fitur tamu + riwayat scan & chat, hapus data, simpan hasil tamu | Scan, gambar, insight, chat di Supabase (privat per akun) |

Tidak ada role admin di aplikasi. Pengelolaan dilakukan lewat dashboard Supabase oleh pemilik repo.

## 5. Scope

### 5.1 MVP

| Kode | Fitur |
|---|---|
| F1 | Landing page |
| F2 | Upload X-ray (JPG/PNG ≤ 10 MB) + "Coba contoh" |
| F3 | Validasi X-ray (pre-filter OpenCV + Gemini Vision) |
| F4 | Halaman hasil: viewer (zoom/pan), kotak temuan, daftar temuan per kelompok |
| F5 | Heatmap Grad-CAM per kelas, toggle per kelas |
| F6 | Insight Gemini otomatis |
| F7 | Chat per scan |
| F8 | Chat umum |
| F9 | Login: Google + email/password |
| F10 | Riwayat scan & chat, hapus per item / semua |
| F11 | Simpan hasil tamu ke akun setelah login |
| F12 | Kuota harian |
| F13 | Bahasa Indonesia / English |
| F14 | Halaman Privasi dan Tentang model |

### 5.2 Fase 2

Laporan PDF, ensiklopedia 31 kondisi, halaman profil/pengaturan, heatmap per kotak temuan.

## 6. User stories & kriteria penerimaan

### Tamu

**US-01 Coba contoh.** Sebagai pengunjung tanpa X-ray, saya ingin mencoba dengan gambar contoh.
- Tombol "Coba contoh" ada di landing dan halaman upload.
- Memilih contoh menjalankan alur yang sama dengan upload asli dan tidak memakai kuota.
- Hasil contoh boleh di-cache (deterministik).

**US-02 Upload & validasi.** Sebagai pengguna, saya ingin meng-upload X-ray panoramik saya.
- Menerima JPG/PNG ≤ 10 MB lewat klik, drag-and-drop, atau kamera/galeri di HP.
- Gambar dikompres di browser (sisi terpanjang 2048 px, JPEG) sebelum dikirim.
- File bukan gambar atau > 10 MB ditolak di browser **dan** server.
- Gambar yang bukan X-ray gigi ditolak dengan pesan jelas dan **tidak memakai kuota**.
- Kalau Gemini tidak tersedia, validasi cukup memakai pre-filter + cek "ada gigi terdeteksi".

**US-03 Lihat hasil.** Sebagai pengguna, saya ingin melihat temuan di atas X-ray saya.
- Kotak temuan berwarna sesuai kelompok, dengan label kelas + confidence.
- Daftar temuan dikelompokkan 🔴 / 🔵 / ⚪. Kelompok ⚪ tertutup secara default.
- Mengarahkan kursor / tap pada item daftar menyorot kotaknya, dan sebaliknya.
- Filter: ambang confidence (default 0,25), tampil/sembunyi per kelompok.
- Kalau tidak ada temuan 🔴, tampilkan "Tidak ada temuan yang perlu perhatian" + pengingat keterbatasan model.
- Viewer bisa zoom & pan (pinch di HP).

**US-04 Heatmap.** Sebagai pengguna, saya ingin tahu bagian mana yang dilihat AI.
- Satu heatmap per kelas yang terdeteksi, dihitung sekali saat scan.
- Memilih kelas di daftar menampilkan heatmap kelas itu. Opacity bisa diatur.
- Heatmap disertai satu kalimat penjelasan cara membacanya.

**US-05 Insight.** Sebagai pengguna, saya ingin penjelasan dengan bahasa sehari-hari.
- Insight muncul otomatis (streaming) setelah hasil tampil, dalam bahasa UI yang dipilih.
- Isi: ringkasan, penjelasan per kelas 🔴/🔵, pertanyaan untuk dokter gigi ([ai-design.md](ai-design.md)).
- Tingkat urgensi ditentukan oleh **kode** dari kelompok kelas, bukan oleh LLM.
- Kalau Gemini gagal: pesan "Ringkasan AI sedang tidak tersedia". Deteksi tetap tampil.

**US-06 Chat per scan.** Sebagai pengguna, saya ingin bertanya tentang hasil saya.
- AI menerima daftar temuan scan ini sebagai konteks (teks, bukan gambar).
- Saran pertanyaan awal (3 chip) dibuat dari temuan.
- Jawaban streaming. Topik di luar gigi/mulut ditolak dengan sopan.

**US-07 Chat umum.** Sebagai pengguna, saya ingin bertanya tentang kesehatan gigi tanpa upload.
- Halaman `/chat` tanpa konteks scan.
- Guardrail sama dengan US-06.

### Pengguna login

**US-08 Login.** Daftar/masuk dengan Google atau email + password (verifikasi email). Reset password lewat email.

**US-09 Riwayat.** Daftar scan (thumbnail, tanggal, jumlah temuan 🔴) dan daftar chat. Membuka scan lama menampilkan halaman hasil lengkap tanpa inferensi ulang.

**US-10 Simpan hasil tamu.** Tamu menekan "Simpan ke riwayat", login, lalu hasil yang sedang dilihat (beserta chat-nya) tersimpan tanpa upload ulang.

**US-11 Jangan simpan.** Toggle "Jangan simpan scan ini" di halaman upload. Scan diperlakukan seperti scan tamu.

**US-12 Hapus data.** Hapus satu scan, satu chat, atau seluruh akun beserta datanya. Penghapusan permanen, termasuk file di Storage.

### Semua

**US-13 Bahasa.** Toggle ID/EN di header mengganti prefix URL (`/id`, `/en`) dan tersimpan di cookie (dan profil bila login). URL tanpa prefix diarahkan ke cookie, lalu `Accept-Language`, lalu `id`.

**US-14 Kuota.** Saat kuota habis, tampil sisa waktu reset dan ajakan login (untuk tamu). Angka ada di §7.

**US-15 Transparansi.** Halaman Privasi (apa disimpan, apa dikirim ke Google) dan Tentang model (dataset, metrik, keterbatasan).

## 7. Aturan bisnis

1. **Kuota harian** (reset 00:00 WITA), angka dari env:

   | | Scan | Pesan chat |
   |---|---|---|
   | Tamu (per hash IP) | `QUOTA_GUEST_SCANS=5` | `QUOTA_GUEST_CHATS=20` |
   | Login (per user) | `QUOTA_USER_SCANS=20` | `QUOTA_USER_CHATS=100` |

   Scan yang ditolak validasi dan scan contoh tidak dihitung. Insight dihitung bersama scan, bukan chat.
2. **Satu scan diproses dalam satu waktu** di server inferensi. Request lain mengantre. Batas tunggu 60 detik, lalu error "server sibuk".
3. **Ambang deteksi**: model dijalankan pada `conf=0.10`, UI menyaring default 0,25. Insight memakai temuan ≥ 0,25.
4. **Riwayat chat dikirim ke Gemini** maksimal 20 pesan terakhir.
5. **Disclaimer** tampil di halaman hasil, chat, dan footer insight.

## 8. Biaya Rp0

| Layanan | Tier | Batas yang relevan |
|---|---|---|
| Vercel | Hobby | Non-komersial; body request/response ±4,5 MB |
| Hugging Face Spaces | CPU basic (Docker) | 2 vCPU, 16 GB RAM; tidur bila lama tidak dipakai |
| Hugging Face Hub | Model repo | Menyimpan `best_resnet50.pt` |
| Supabase | Free | 500 MB DB, 1 GB Storage; project di-pause setelah 7 hari tanpa aktivitas |
| Gemini API | Free tier AI Studio | Rate limit per menit/hari; data free tier boleh dipakai Google |
| GitHub Actions | Repo publik | Gratis |

Batas di atas **Inferensi engineering** dan diverifikasi ulang saat M5 sebelum dicantumkan di README.

## 9. Kualitas model

Metrik validasi dari checkpoint (`best_resnet50.pt`, 50 epoch, `imgsz=640`, ultralytics 8.4.161):

| Precision | Recall | mAP50 | mAP50-95 |
|---|---|---|---|
| 0,539 | 0,386 | 0,329 | 0,170 |

Konsekuensi produk:

- Model **sering melewatkan** temuan (recall 39%) dan kadang salah tebak. Copy UI tidak boleh menyiratkan "tidak ada temuan = gigi sehat".
- Metrik ini ditampilkan di halaman Tentang model.
- Metrik per kelas diukur di M1 bila split validasi tersedia (**Perlu keputusan pengguna**: akses ke dataset).

## 10. Metrik keberhasilan

- ≥ 70% pengunjung yang masuk halaman upload menyelesaikan satu scan (termasuk contoh).
- Error inferensi < 2% scan.
- p50 waktu upload → hasil < 15 detik saat server hangat.
- Lighthouse mobile: Performance ≥ 85, Accessibility ≥ 95 di landing.

## 11. Risiko

| Risiko | Mitigasi |
|---|---|
| Pengguna menganggap hasil sebagai diagnosis | Disclaimer, copy hati-hati, urgensi dari kode, guardrail chat |
| False negative membuat pengguna menunda ke dokter | Pesan keterbatasan saat temuan 🔴 kosong; selalu sarankan kontrol rutin |
| X-ray adalah data kesehatan | Tamu tidak disimpan; login privat + RLS; hapus permanen ([security-privacy.md](security-privacy.md)) |
| HF Space tidur → kunjungan pertama lambat | Status "menyiapkan server" yang jujur + ping saat landing dibuka |
| Kuota Gemini habis | Model cadangan saat 429; deteksi tetap jalan tanpa Gemini |
| Lisensi gambar contoh / dataset | Gambar contoh hanya dari sumber berlisensi jelas (**Perlu keputusan pengguna**, roadmap M2) |
| Supabase ter-pause | Catatan di README; ping terjadwal hanya bila diputuskan nanti |

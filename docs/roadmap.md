# Roadmap

Setiap milestone berakhir dengan sesuatu yang bisa di-demo. Fitur `F*` dan story `US-*` ada di [PRD.md](PRD.md).

| Milestone | Isi | Story / fitur | Demo di akhir |
|---|---|---|---|
| **M0 — Fondasi** | Docs, AGENTS.md, template PR; skeleton `web/` (Next.js 16, Tailwind v4, tokens, font, i18n helper, env Zod), skeleton `api/` (FastAPI `/health`), `supabase/` init; CI 4 job; branch `development` + protection; upload model ke HF Hub | — | PR pertama dengan 4 check hijau |
| **M1 — API inferensi** | Load model dari HF Hub, `/v1/analyze`, pre-filter, Grad-CAM per kelas (spike SPPF vs P3), antrean, Dockerfile, deploy HF Space | F3 (sebagian), F5 | `curl` gambar ke Space → JSON deteksi + heatmap |
| **M2 — Web scan & hasil** | `/scan` dropzone + kompres, `/api/scans` (tanpa simpan), validasi Gemini, `XrayViewer`, `FindingList`, heatmap, filter, gambar contoh, class catalog di kode | F2, F3, F4, F5, US-01..04 | Upload di HP → hasil lengkap di lightbox |
| **M3 — Gemini** | Insight streaming, chat per scan, chat umum, fallback model, eval insight | F6, F7, F8, US-05..07 | Insight + chat dalam ID & EN |
| **M4 — Akun & riwayat** | Auth Google + email, migrasi tabel + RLS + pgTAP, simpan scan, riwayat, import hasil tamu, "jangan simpan", hapus data, kuota | F9..F12, US-08..12, US-14 | Tamu → login → simpan → buka dari HP lain → hapus |
| **M5 — Landing, polish, deploy** | Landing + hero sweep, Privasi, Tentang model, transisi lightbox, audit a11y/performa/kontras, deploy Vercel production + HF Space dari `main`, README final | F1, F13, F14, US-13, US-15 | Link publik untuk portofolio |
| **Fase 2** | PDF, ensiklopedia, profil, heatmap per kotak | — | — |

## Keputusan yang masih terbuka

| Item | Dibutuhkan sebelum | Pemilik |
|---|---|---|
| ~~Nama & visibilitas model repo HF Hub~~ ✅ 2026-10-25: `adrielwalintukan/dentavision-yolov8m-resnet50`, publik, diunggah Adriel atas izin pemilik repo (#5) | M0 selesai | Pemilik repo |
| Sumber + lisensi dataset dan gambar contoh | M2 selesai | Pemilik repo |
| Akses split validasi untuk metrik per kelas | M5 (halaman Tentang model) | Pemilik repo |
| `GEMINI_FALLBACK_MODEL` | M3 | Agent, verifikasi dokumentasi resmi |
| Layer Grad-CAM final (SPPF / P3) | M1 | Agent, berdasarkan spike |
| Review penjelasan 31 kelas | M2 selesai | Pemilik repo |

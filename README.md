# DentaVision AI

Upload X-ray panoramik gigi, lalu lihat apa yang ditandai AI: 31 jenis temuan dengan kotak dan heatmap, penjelasan dalam bahasa sehari-hari, dan chat untuk bertanya.

> Hasil DentaVision AI bukan diagnosis medis. Konsultasikan ke dokter gigi.

## Status

| Milestone | Status |
|---|---|
| M0 Fondasi (docs, skeleton, CI 4 job) | Selesai |
| M1 API inferensi (`/v1/analyze`, Grad-CAM P3, Dockerfile HF Space) | Selesai. Deploy Space dilakukan manual ([architecture §3.4](docs/architecture.md#34-deploy)) |
| M2 Web scan & hasil | Berjalan: upload + validasi Gemini (#9), viewer & daftar temuan (#10), heatmap (#11), gambar contoh (#12). Menunggu review penjelasan 31 kelas oleh pemilik repo |
| M3 Gemini | Berjalan: insight streaming (#13), chat per scan + chat umum `/chat` (#14) |
| M4–M5 | Belum dimulai ([roadmap](docs/roadmap.md)) |

Belum ada deploy production.

## Cara kerja

```text
Browser → web (Next.js, Vercel) → api (FastAPI + YOLOv8m-ResNet50, HF Spaces)
                    ↓                         ↑ checkpoint dari HF Hub
             Supabase (Auth, DB, Storage)
             Gemini (validasi gambar, ringkasan, chat)
```

| Bagian | Stack |
|---|---|
| `web/` | Next.js 16, TypeScript, Tailwind v4, shadcn/ui, Motion |
| `api/` | Python 3.13, FastAPI, ultralytics 8.4.161, PyTorch (CPU) |
| `supabase/` | Postgres + RLS, Auth (Google, email), Storage privat |
| AI | YOLOv8m + backbone ResNet50 (31 kelas), Grad-CAM per kelas, Gemini `gemini-3.5-flash-lite` |

Browser tidak pernah memanggil API inferensi atau Gemini langsung; semuanya lewat Route Handler di `web/`. Detail: [docs/architecture.md](docs/architecture.md).

## Model

| Precision | Recall | mAP50 | mAP50-95 |
|---|---|---|---|
| 0,539 | 0,386 | 0,329 | 0,170 |

Metrik validasi dari checkpoint `best_resnet50.pt` (50 epoch, 640 px). Model sering melewatkan temuan. Daftar kelas: [docs/class-catalog.md](docs/class-catalog.md).

Checkpoint ada di model repo HF Hub publik [`adrielwalintukan/dentavision-yolov8m-resnet50`](https://huggingface.co/adrielwalintukan/dentavision-yolov8m-resnet50) dan tidak pernah di-commit ke repo ini.

## Menjalankan di komputer sendiri

Perintah di bawah untuk **Windows PowerShell**, dijalankan dari folder root proyek. PowerShell 5.1 tidak mendukung `&&`, jadi jalankan perintah satu per baris.

### Prasyarat

- Git, Python 3.13, Node.js 22 (sama dengan CI).
- `GEMINI_API_KEY` dari [Google AI Studio](https://aistudio.google.com/apikey).
- Opsional: `best_resnet50.pt` di folder root. Tanpa file ini, API mengunduh checkpoint dari HF Hub saat start.

### Setup pertama kali

1. Python venv (di folder root) dan dependency API:

   ```powershell
   py -3.13 -m venv .venv
   .venv\Scripts\python -m pip install -r api\requirements.txt -r api\requirements-dev.txt --extra-index-url https://download.pytorch.org/whl/cpu
   ```

2. Dependency web. `web/.npmrc` memaksa registry npmjs, jadi aman walau npm global memakai mirror lain.

   ```powershell
   cd web
   npm ci
   cd ..
   ```

3. Env web: salin contoh (hanya bila `web/.env.local` belum ada, supaya isinya tidak tertimpa), lalu isi.

   ```powershell
   if (-not (Test-Path web\.env.local)) { Copy-Item web\.env.example web\.env.local }
   ```

   - `GEMINI_API_KEY`: key Anda.
   - `INFERENCE_API_URL`: `http://localhost:7860` untuk API lokal.
   - `INFERENCE_API_SECRET` dan `IP_HASH_SALT`: string acak minimal 16 karakter. Buat dengan:

     ```powershell
     .venv\Scripts\python -c "import secrets; print(secrets.token_hex(24))"
     ```

   - Variabel Supabase baru dipakai di M4, tetapi harus terisi karena semua env divalidasi sekaligus. Untuk sekarang cukup `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` dan nilai sembarang untuk dua key Supabase.
   - Biarkan `GEMINI_FALLBACK_MODEL` dikomentari bila tidak dipakai; nilai kosong membuat validasi env gagal.

   Daftar lengkap env: [docs/architecture.md §6](docs/architecture.md#6-environment). Jangan commit `.env.local`.

### Menjalankan (2 terminal)

**Terminal 1: API inferensi.** API tidak membaca file `.env`, jadi secret diambil dari `web/.env.local` agar keduanya sama.

```powershell
cd api
$env:API_SECRET = (Select-String -Path ..\web\.env.local -Pattern '^INFERENCE_API_SECRET=').Line.Split('=', 2)[1]
$env:MODEL_PATH = "..\best_resnet50.pt"
..\.venv\Scripts\python -m uvicorn app.main:app --port 7860
```

Tanpa `best_resnet50.pt` lokal, lewati baris `MODEL_PATH` dan isi `$env:HF_MODEL_REPO = "adrielwalintukan/dentavision-yolov8m-resnet50"`. API siap bila http://localhost:7860/health menjawab `"status":"ready"`.

**Terminal 2: web.**

```powershell
cd web
npm run dev
```

Tunggu sampai muncul `✓ Ready` dan alamat `http://localhost:3000`.

Berhenti: `Ctrl+C` di Terminal 2, lalu di Terminal 1.

### Mengecek di browser

1. Buka http://localhost:3000/id/scan (atau `/en/scan`). Pembukaan pertama bisa 30–60 detik karena halaman dikompilasi.
2. Klik **Pilih gambar** dan pilih X-ray panoramik JPG/PNG (≤ 10 MB). Langkah `01 / 02 Validasi` lalu `02 / 02 Deteksi & heatmap` berjalan, kemudian halaman **Hasil scan** menampilkan jumlah temuan.
3. Coba juga:
   - Foto biasa, screenshot, atau dokumen → ditolak dengan alasan dari Gemini.
   - File selain JPG/PNG atau > 10 MB → ditolak langsung di halaman upload.
   - Tampilan HP: F12 → Toggle device toolbar → lebar 360–375 px.

Gambar dikirim ke Gemini (free tier) untuk validasi, dan Google boleh memakai data free tier. Pakai X-ray yang boleh dibagikan, tanpa nama atau data pribadi di gambar.

### Menjalankan tes (sama dengan CI)

Web:

```powershell
cd web
npm run lint
npm run typecheck
npm test
npm run build
```

Eval prompt (memanggil Gemini sungguhan, tidak dijalankan CI): `npm run eval:insight` (6 request) dan `npm run eval:chat` (5 request). Jalankan saat prompt berubah dan catat hasilnya di PR.

API (dari folder `api`):

```powershell
..\.venv\Scripts\ruff check .
..\.venv\Scripts\ruff format --check .
..\.venv\Scripts\python -m pytest -m "not smoke"
$env:MODEL_PATH = "..\best_resnet50.pt"
..\.venv\Scripts\python -m pytest -m smoke
```

Database (butuh Docker + Supabase CLI): `supabase start`, lalu `supabase test db`.

### Masalah umum

| Gejala | Penyebab dan solusi |
|---|---|
| `The token '&&' is not a valid statement separator` | PowerShell 5.1. Jalankan perintah per baris |
| `Invalid or missing env: ...` di terminal web | Variabel yang disebut kosong atau salah format di `web/.env.local`. Nilai kosong untuk `GEMINI_FALLBACK_MODEL` juga memicu ini |
| Layar "Menyiapkan server" lama | Terminal 1 belum jalan, belum `ready`, atau `INFERENCE_API_URL` salah |
| "Server analisis tidak merespons" | Secret API dan web berbeda (API menjawab 401). Jalankan ulang Terminal 1 dengan perintah di atas |
| `EADDRINUSE` port 3000/7860 | Server lama masih jalan. Tutup terminal lamanya, atau hentikan proses `node`/`python` yang memakai port itu |

## Deploy API ke HF Space

Space tipe Docker dari folder `api/` (`api/Dockerfile`, port 7860). Isi secret `API_SECRET` di Settings Space, lalu upload dari folder `api`:

```powershell
hf auth login
hf upload <owner>/<space> . . --repo-type space --include "Dockerfile" --include ".dockerignore" --include "README.md" --include "requirements.txt" --include "app/*.py"
```

Setelah itu ganti `INFERENCE_API_URL` di `web/.env.local` ke `https://<owner>-<space>.hf.space` dan `INFERENCE_API_SECRET` ke secret Space. Detail: [docs/architecture.md §3.4](docs/architecture.md#34-deploy).

## Struktur repo

```text
api/        FastAPI inferensi (model, pre-filter, Grad-CAM), Dockerfile untuk HF Space
web/        Next.js: halaman, Route Handler /api/*, Gemini, i18n (messages/)
supabase/   Konfigurasi lokal + tes pgTAP
docs/       PRD, arsitektur, desain, dan dokumen lain (tabel di bawah)
.github/    Workflow CI 4 job + template PR
```

## Dokumen

| Dokumen | Isi |
|---|---|
| [AGENTS.md](AGENTS.md) | Aturan kerja agent AI di repo ini |
| [docs/PRD.md](docs/PRD.md) | Scope, user stories, aturan bisnis, kuota, risiko |
| [docs/user-flows.md](docs/user-flows.md) | Rute, alur, state |
| [docs/architecture.md](docs/architecture.md) | Komponen, API, data, RLS, env, testing |
| [docs/ai-design.md](docs/ai-design.md) | Prompt Gemini, skema, guardrail |
| [docs/class-catalog.md](docs/class-catalog.md) | 31 kelas dan pengelompokannya |
| [docs/design-system.md](docs/design-system.md) | Konsep visual, tokens, motion, komponen, copy |
| [docs/security-privacy.md](docs/security-privacy.md) | Data yang disimpan dan dikirim |
| [docs/engineering-standard.md](docs/engineering-standard.md) | Tooling, Git, CI, DoD |
| [docs/roadmap.md](docs/roadmap.md) | Milestone dan keputusan terbuka |

## Kontribusi

`main` ← `development` ← `feat/*`. Setiap perubahan lewat PR ke `development` dengan 4 check CI hijau. Lihat [docs/engineering-standard.md §6](docs/engineering-standard.md#6-git--pr).

## Atribusi gambar contoh

Gambar di `web/public/samples/` diperkecil ke sisi terpanjang 2048 px (thumbnail 480 px). Hasil deteksinya dibuat oleh model proyek ini.

| File | Sumber | Lisensi |
|---|---|---|
| `impacted.jpg` | Coronation Dental Specialty Group, [Basic panoramic radiograph.jpg](https://commons.wikimedia.org/wiki/File:Basic_panoramic_radiograph.jpg), Wikimedia Commons | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) |
| `restorations.jpg` (file 13.jpg), `missing.jpg` (file 80.jpg) | Brahmi, Jdey & Drira, [Panoramic Dental Xray Dataset](https://doi.org/10.17632/73n3kz2k4k.3), Mendeley Data V3 | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

## Tim

- [prettyara12](https://github.com/prettyara12): pemilik repo, model
- Adriel Walintukan: kolaborator

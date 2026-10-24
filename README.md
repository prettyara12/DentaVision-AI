# DentaVision AI

Upload X-ray panoramik gigi, lalu lihat apa yang ditandai AI: 31 jenis temuan dengan kotak dan heatmap, penjelasan dalam bahasa sehari-hari, dan chat untuk bertanya.

> Hasil DentaVision AI bukan diagnosis medis. Konsultasikan ke dokter gigi.

**Status:** M0 (fondasi). Belum ter-deploy.

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

Detail: [docs/architecture.md](docs/architecture.md).

## Model

| Precision | Recall | mAP50 | mAP50-95 |
|---|---|---|---|
| 0,539 | 0,386 | 0,329 | 0,170 |

Metrik validasi dari checkpoint `best_resnet50.pt` (50 epoch, 640 px). Model sering melewatkan temuan. Daftar kelas: [docs/class-catalog.md](docs/class-catalog.md).

## Quickstart

Tersedia setelah M0 selesai. Ringkasnya:

```bash
cd api && python -m venv .venv && .venv/Scripts/pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
```

```bash
cd api && .venv/Scripts/uvicorn app.main:app --reload --port 7860
```

```bash
cd web && npm ci && npm run dev
```

Env var: [docs/architecture.md §6](docs/architecture.md#6-environment). Salin `web/.env.example` → `web/.env.local` dan `api/.env.example` → `api/.env`.

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

## Tim

- [prettyara12](https://github.com/prettyara12): pemilik repo, model
- Adriel Walintukan: kolaborator

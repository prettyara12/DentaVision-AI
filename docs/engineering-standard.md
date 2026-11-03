# Engineering Standard

## 1. Prinsip

1. **Solusi terkecil yang lengkap.** Tidak ada abstraksi, opsi, atau config "untuk nanti". Ekstrak pola setelah muncul tiga kali.
2. **Pakai yang sudah ada**: platform (Next.js, React, Supabase, FastAPI, ultralytics) → dependency terpasang → kode baru. Jangan menambah dependency untuk beberapa baris.
3. **Tidak pernah dipangkas**: validasi di trust boundary, otorisasi, error handling yang mencegah data hilang, privasi, aksesibilitas.

## 2. Tooling

### `web/`

| Area | Pilihan |
|---|---|
| Runtime | Node 22, npm (registry dikunci di `.npmrc`) |
| Framework | Next.js 16 App Router, React 19 |
| Bahasa | TypeScript `strict`, `noUncheckedIndexedAccess` |
| Style | Tailwind v4, shadcn/ui (restyle), Lucide, Motion |
| Lint/format | ESLint (config Next) + Prettier; warning = gagal di CI |
| Validasi | Zod: input route, output Gemini, env (`src/lib/env.ts`, lazy) |
| DB types | `supabase gen types` → `src/lib/supabase/types.ts` (generated) |
| Test | Vitest; Playwright setelah M4 |

### `api/`

| Area | Pilihan |
|---|---|
| Runtime | Python 3.13 |
| Dependency | `requirements.txt` (versi di-pin, termasuk `ultralytics==8.4.161`), `requirements-dev.txt` |
| Torch | Wheel CPU dari `https://download.pytorch.org/whl/cpu` |
| Framework | FastAPI + uvicorn (1 worker) |
| Lint/format | ruff (`ruff check`, `ruff format --check`) |
| Test | pytest; model asli hanya di `tests/smoke/` (marker `smoke`) |

### `supabase/`

Supabase CLI. Satu perubahan skema = satu file `supabase/migrations/<timestamp>_<nama>.sql`, termasuk RLS, disertai tes pgTAP di `supabase/tests/`.

## 3. Struktur & penamaan

- Struktur mengikuti [architecture.md §2](architecture.md#2-struktur-repo).
- `web/`: komponen `PascalCase.tsx`, file lain `kebab-case.ts`, hooks `use-xxx.ts`. Server Components default; `"use client"` hanya untuk komponen interaktif (viewer, chat, dropzone).
- `api/`: modul `snake_case.py`, type hints wajib di fungsi publik.
- Identifier bahasa Inggris. Teks UI hanya di `messages/{id,en}.json`, tidak di-hardcode di komponen.
- Modul yang menyentuh secret: `import "server-only"`.

## 4. Data & keamanan

- Route Handler: autentikasi → otorisasi (kepemilikan) → validasi Zod → kuota → aksi.
- RLS di **semua** tabel. Service role hanya di `src/lib/supabase/admin.ts`, dipakai setelah cek otorisasi di kode.
- Output Gemini divalidasi dan dirender sebagai teks.
- Detail: [security-privacy.md](security-privacy.md).

## 5. Testing

- Setiap logika bercabang baru punya minimal satu tes. Tes menguji perilaku, bukan implementasi.
- Lapisan dan contoh: [architecture.md §7](architecture.md#7-pengujian).
- Tes unit `api/` memakai model palsu (modul kecil dengan output tetap), sehingga tidak butuh checkpoint.
- Smoke test model memakai checkpoint asli dari HF Hub dan jalan di job CI terpisah.
- Fixture gambar hanya dari sumber berlisensi jelas. Sampai lisensi dikonfirmasi, smoke test memakai gambar sintetis dan hanya memeriksa bentuk output.

## 6. Git & PR

```text
main          ← production (Vercel production + HF Space). Hanya merge dari development saat rilis + tag vX.Y.Z
development   ← integrasi (Vercel preview)
feat/… fix/… docs/… chore/… refactor/… test/… ci/…  ← dari development terbaru
```

- 1 issue = 1 branch = 1 PR. Body PR mengikuti `.github/pull_request_template.md` dan mencantumkan `Closes #N`.
- Dilarang commit langsung ke `development` dan `main`.
- Merge branch kerja → `development`: **squash**. `development` → `main`: **merge commit** + tag.
- Branch protection `main` & `development` (diatur pemilik repo): wajib PR, wajib 4 check CI hijau, branch up to date, force push dilarang.
- Commit: Conventional Commits, prefix Inggris + deskripsi Bahasa Indonesia, tanpa footer AI.
- PR kecil (< ~400 baris di luar file generated). Perubahan UI disertai screenshot desktop + 360 px.

### CI (`.github/workflows/ci.yml`)

Berjalan di setiap PR dan push ke `development` / `main`:

| Job | Isi |
|---|---|
| `Web Quality Gate & Build` | `npm ci`, lint, typecheck, test, build (tanpa secret) |
| `API Quality Gate` | ruff check + format check, pytest (tanpa `smoke`) |
| `Model Smoke Test` | Unduh checkpoint dari HF Hub (cache), pytest `-m smoke`, build image `api/Dockerfile` lalu `/health` + `/v1/analyze` lewat container |
| `Database pgTAP & RLS Tests` | `supabase start`, `supabase test db` |

## 7. Performa

| Budget | Target |
|---|---|
| LCP landing (Lighthouse mobile) | < 2,5 dtk |
| JS awal landing | < 170 KB gzip |
| Upload → hasil (server hangat, panoramik 2048 px) | p50 < 15 dtk |
| Respons `/v1/analyze` | < 1,5 MB (heatmap 256 px) |

## 8. Definition of Done

- [ ] Kriteria penerimaan user story terpenuhi.
- [ ] Tes untuk logika baru ada dan lulus; 4 job CI hijau di HEAD.
- [ ] Tidak ada secret di bundle client.
- [ ] UI dicek desktop + 360 px, keyboard, reduced-motion, tema terang & gelap, ID & EN.
- [ ] Copy mengikuti [design-system §2.1](design-system.md#21-aturan-copy).
- [ ] Dokumen terdampak diperbarui.

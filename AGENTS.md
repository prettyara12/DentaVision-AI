# AGENTS.md — Panduan Kerja Agent DentaVision AI

## 1. Tujuan

File ini adalah **entry point kerja agent** (Claude Code, Codex, Copilot, dan sejenisnya) untuk repository **DentaVision AI**: web tempat siapa saja meng-upload X-ray panoramik gigi, lalu mendapat deteksi 31 kelas (YOLOv8m + ResNet50), heatmap Grad-CAM, ringkasan bahasa awam, dan chat dari Gemini. Tujuannya portofolio, dengan biaya Rp0.

`AGENTS.md` mengarahkan agent agar:

- bekerja dari source of truth yang benar (`docs/`);
- membaca dokumen yang relevan sebelum implementasi atau review;
- menjaga scope, Git, database, secret, dan **data kesehatan pengguna**;
- memverifikasi hasil sebelum menyatakan selesai;
- tidak mengklaim completion melebihi evidence.

`AGENTS.md` **tidak menduplikasi** detail yang sudah ada di `docs/`. Kalau sudah ditetapkan di sana, **ikuti dokumen tersebut**.

Urutan prioritas instruksi: sistem/developer → instruksi eksplisit pengguna terbaru → `AGENTS.md` → dokumen `docs/` → kebiasaan umum agent.

Gunakan **Bahasa Indonesia** untuk komunikasi, laporan, dokumentasi, deskripsi commit, dan body PR. Identifier kode memakai bahasa Inggris.

---

## 2. Quick Start

Untuk task non-trivial:

```text
Task
→ Verifikasi branch / HEAD / sinkron dengan development
→ Identifikasi milestone (roadmap) + Issue + User Story (US-*) / fitur (F*)
→ Baca dokumen relevan di docs/
→ Baca current code + tests
→ Plan seperlunya
→ Implementasi di branch kerja baru
→ Verifikasi (§12)
→ Sinkronkan dokumen yang terdampak
→ Final diff review
→ Commit → push → PR ke development (body lengkap, §13) → CI hijau
```

Jangan mulai implementasi hanya berdasarkan judul task, komentar PR lama, memory percakapan, satu file kode, test yang belum dijalankan, atau branch/HEAD lama.

---

## 3. Folder `docs/` adalah Pusat Referensi

| Dokumen | Digunakan untuk |
|---|---|
| `README.md` (root) | Gambaran produk, stack, quickstart, env var, indeks dokumen |
| `docs/PRD.md` | Scope MVP vs fase 2, fitur F1–F14, user stories `US-*` + kriteria penerimaan, aturan bisnis, kuota, kualitas model, risiko |
| `docs/user-flows.md` | Rute/layar, alur scan, state browser, simpan hasil tamu, kasus khusus |
| `docs/architecture.md` | web ↔ api ↔ Supabase ↔ Gemini ↔ HF Hub, kontrak API, Grad-CAM, skema DB, RLS, Storage, env, pengujian |
| `docs/ai-design.md` | Prompt validasi/insight/chat (berversi), skema output, guardrail, eval |
| `docs/class-catalog.md` | 31 kelas: id, key, kelompok, teks ID/EN |
| `docs/design-system.md` | Konsep "Lightbox", anti-AI-slop & aturan copy, tokens, motion, komponen, responsif, a11y |
| `docs/security-privacy.md` | Apa disimpan di mana, pihak ketiga, hapus data, ancaman & mitigasi |
| `docs/engineering-standard.md` | Tooling web/api/supabase, konvensi, testing, Git & PR, CI, performa, DoD |
| `docs/roadmap.md` | Milestone M0–M5, keputusan yang masih terbuka |
| `docs/decisions/*.md` | ADR: keputusan yang sulit dibalik (dibuat bila diperlukan, §10) |

---

## 4. Dokumen Minimum per Jenis Task

### Feature (full-stack)

```text
roadmap (milestone) → PRD (fitur + US-* + aturan bisnis §7) → user-flows
→ architecture → design-system (bila ada UI) → code + tests
```

### UI / Frontend

```text
PRD (US-* terkait) → design-system (WAJIB) → user-flows §1 (rute)
→ class-catalog (bila menampilkan temuan) → komponen/halaman yang ada
```

### API inferensi / Model / Grad-CAM

```text
architecture §3 → PRD §9 (kualitas model) → api/ code + tests
→ smoke test dengan checkpoint asli
```

### Gemini / Prompt

```text
ai-design → architecture §4.3 → security-privacy §2 → src/lib/gemini.ts + tes + eval
```

### Database / Migration / RLS

```text
architecture §5 → security-privacy → migrasi yang ada (supabase/migrations)
→ pgTAP (supabase/tests)
```

### Review PR

```text
refresh HEAD → identifikasi milestone/issue/story → baca dokumen relevan
→ review delta → review source + tests → cek review threads
→ cek CI pada exact HEAD → klasifikasikan finding → verdict
```

---

## 5. Source of Truth

| Pertanyaan | Pemilik jawaban |
|---|---|
| Apa yang dibangun, scope, aturan bisnis, kriteria penerimaan | PRD |
| Alur, state, layar | user-flows |
| Struktur, kontrak API, data, RLS, env | architecture |
| Prompt, skema output, guardrail | ai-design |
| Nama, kelompok, teks kelas | class-catalog (setelah M2: `web/src/features/scan/class-catalog.ts`) |
| Tampilan, copy & interaksi | design-system |
| Data & privasi | security-privacy |
| Urutan pengerjaan | roadmap |
| Keputusan permanen | ADR (`docs/decisions/`) |

Kode dan tes membuktikan **status implementasi**, bukan requirement baru. Kalau implementasi berbeda dari dokumen:

1. identifikasi perbedaannya;
2. cek dokumen pemiliknya;
3. jangan mengubah dokumen supaya cocok dengan kode tanpa keputusan pengguna;
4. laporkan dan minta keputusan.

Repo skripsi `prettyara12/Dental-Panoramic-Project` hanya **referensi perilaku** (kelas, pola validasi Gemini). Jangan menyalin kode, struktur, atau gayanya.

---

## 6. Jangan Mengarang

Agent tidak boleh mengarang:

- role atau akses baru (MVP hanya **tamu** dan **pengguna login**);
- kelas, urutan `class_id`, atau kelompok kelas di luar class-catalog;
- angka kuota, ambang confidence, atau aturan bisnis di luar PRD;
- field atau tabel database di luar `architecture.md §5`;
- metrik model. Satu-satunya angka resmi ada di PRD §9 (dari checkpoint);
- nama model Gemini, endpoint, atau versi library. **Verifikasi ke dokumentasi resmi** dan ambil dari env;
- penjelasan medis yang lebih kuat dari class-catalog / ai-design;
- status milestone, CI, merge, atau deploy.

Kalau belum pasti, beri label:

- **Dikonfirmasi dokumen**
- **Terverifikasi implementasi/uji**
- **Inferensi engineering**
- **Perlu keputusan pengguna**

---

## 7. Stack & Aturan Kode

Detail ada di `docs/engineering-standard.md` dan `docs/architecture.md`. Ringkasnya:

- **`web/`**: Next.js 16 (App Router) + TypeScript strict + `noUncheckedIndexedAccess`, Tailwind v4, shadcn/ui (di-restyle), Motion, npm. Deploy Vercel.
- **`api/`**: FastAPI, Python 3.13, `ultralytics==8.4.161` (di-pin, sama dengan versi training), torch CPU. Deploy HF Spaces (Docker). Hanya urusan ML, tanpa user/kuota/Gemini.
- **Supabase**: Auth + Postgres + Storage privat. RLS di **semua** tabel. Satu perubahan skema = satu file di `supabase/migrations/` + tes pgTAP di `supabase/tests/`.
- **Gemini** hanya lewat `web/src/lib/gemini.ts` (`server-only`). Model dari env (`GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`).
- **Env** divalidasi lazy di `web/src/lib/env.ts` (Zod), sehingga build CI tidak butuh secret.
- **Checkpoint** `best_resnet50.pt` tidak pernah di-commit. Sumbernya model repo HF Hub.
- **Solusi terkecil yang lengkap.** Jangan menambah abstraksi, dependency, atau config "untuk nanti". Shortcut yang punya batas diberi komentar `shortcut: <batas>, <kapan upgrade>`.

Next.js 16 punya breaking changes. Sebelum memakai API Next.js yang belum pernah dipakai di repo ini, baca panduan di `web/node_modules/next/dist/docs/` (jika tersedia) atau dokumentasi resmi.

---

## 8. Aturan Domain yang Tidak Boleh Dilanggar

1. **Bukan diagnosis.** Copy UI dan output AI memakai "AI menandai…", tidak pernah "Anda menderita…". Disclaimer selalu tampil di hasil dan chat.
2. **Data tamu tidak pernah disimpan di server.** Gambar diproses di memori lalu dibuang; hasil hanya di `sessionStorage` tab.
3. **Data login disimpan privat dan bisa dihapus permanen.** Setiap tabel atau objek Storage baru yang berisi data pengguna harus ikut cascade dan ikut terhapus saat hapus akun.
4. **Ke Gemini: gambar hanya untuk validasi.** Insight dan chat hanya menerima teks (daftar temuan + pesan). Perubahan ini butuh keputusan pengguna dan update `security-privacy.md`.
5. **Urgensi dan kelompok ditentukan kode** dari class-catalog, bukan oleh LLM.
6. **Browser tidak pernah memanggil `api/` atau Gemini langsung.** Semua lewat Route Handler yang memegang secret, memeriksa auth, dan kuota.
7. **Otorisasi selalu di server:** autentikasi → kepemilikan → validasi Zod → kuota → aksi. RLS adalah lapisan kedua.
8. **Output LLM tidak dipercaya**: divalidasi, dirender sebagai teks, tidak pernah lewat `dangerouslySetInnerHTML`.
9. **UI mengikuti `docs/design-system.md`**, termasuk larangan AI-slop dan aturan copy §2. Cek desktop + 360 px + keyboard + reduced-motion + tema terang/gelap + ID/EN.

---

## 9. Task Lifecycle

```text
DISCOVER → ALIGN → PLAN → IMPLEMENT → VERIFY → DOCUMENT → REVIEW → COMPLETE
```

- **DISCOVER:** cek branch/HEAD, baca issue, dependency, kode, dan tes yang ada.
- **ALIGN:** cocokkan task dengan dokumen. Kalau ada konflik material, berhenti dan tanya.
- **PLAN:** untuk task substansial, tentukan tujuan, scope, non-goal, AC, file terdampak, risiko (privasi/auth/data), tes, dan dokumen yang perlu disinkronkan. Jangan over-plan task kecil.
- **IMPLEMENT:** ikuti dokumen.
- **VERIFY:** jalankan perintah di §12 sesuai risiko. Membaca kode tes bukan bukti tes lulus.
- **DOCUMENT:** sinkronkan dokumen yang terdampak (§10).
- **REVIEW:** baca seluruh diff; cek regresi, keamanan, privasi, perubahan yang tidak terkait, dan secret.
- **COMPLETE:** gunakan Definition of Done di §16.

---

## 10. Sinkronisasi Dokumen

| Dokumen | Update bila |
|---|---|
| `roadmap.md` | Item milestone selesai, keputusan terbuka terjawab, atau urutan berubah |
| `PRD.md` | AC terbukti berbeda atau perlu klarifikasi (**dengan persetujuan pengguna**) |
| `user-flows.md` | Rute, alur, atau state berubah |
| `architecture.md` | Struktur, kontrak API, tabel, RLS, Storage, env, atau temuan spike berubah |
| `ai-design.md` | Prompt, skema, atau guardrail berubah (naikkan versi prompt) |
| `class-catalog.md` | Teks atau kelompok kelas berubah |
| `design-system.md` | Token atau komponen reusable baru/berubah |
| `security-privacy.md` | Data baru disimpan atau dikirim ke pihak ketiga |
| ADR baru di `docs/decisions/` | Keputusan yang sulit dibalik dan punya trade-off. **Tawarkan dulu, jangan buat otomatis** |
| `README.md` (root) | Env var, quickstart, atau status berubah |

Izin implementasi **tidak** mencakup mengubah requirement, menghapus AC, menurunkan DoD, atau menambah scope.

Bedakan selalu status berikut; satu tidak berarti yang lain:

```text
Implemented ≠ Verified ≠ Merged ≠ Deployed
```

---

## 11. Git, Branch & Workspace

Repo: `github.com/prettyara12/DentaVision-AI` (public). Pemilik: **prettyara12**. Kolaborator: **Adriel Walintukan**.

```text
main          ← production. Hanya menerima merge dari development saat rilis (+ tag vX.Y.Z)
development   ← integrasi selama pengembangan
feat/… fix/… docs/… chore/… refactor/… test/… ci/…  ← branch kerja, dibuat dari development terbaru
```

- **Wajib branch baru** untuk setiap task, dari `development` terbaru. Dilarang commit langsung ke `development` atau `main`.
- **1 issue = 1 branch = 1 PR.** Sertakan `Closes #N` di body PR. Karena default branch `main`, issue tidak tertutup otomatis saat merge ke `development`; penutupan dilakukan pengguna.
- **Setiap PR wajib CI hijau** (4 job, [engineering-standard §6](docs/engineering-standard.md#ci-githubworkflowsciyml)). Kode baru yang belum tercakup CI harus ditambah job/tesnya di PR yang sama.
- Merge branch kerja → `development`: **squash**. `development` → `main`: **merge commit** + tag.
- **Jangan memakai git worktree** kecuali diminta.
- **Jangan merusak working tree:** jangan reset perubahan pengguna, jangan overwrite/hapus/pindah file tanpa izin. File asing: baca dulu, lalu tanyakan.
- **Artefak QA** (screenshot, log, output smoke test) disimpan di luar repo.

### Izin di repo ini

| Aksi | Status |
|---|---|
| Buat branch kerja, commit, push branch kerja, buka PR ke `development` | Termasuk dalam permintaan implementasi task |
| Update body PR milik task sendiri, memperbaiki CI yang gagal di PR sendiri | Diizinkan |
| Membuat issue | Hanya setelah daftar issue disetujui pengguna |
| **Merge PR**, PR/merge ke `main`, tag rilis | **Hanya oleh pengguna**, atau dengan instruksi eksplisit |
| Approve, request changes, resolve thread, komentar di PR orang lain | Hanya dengan instruksi eksplisit |
| Mengubah setting repo (branch protection, secrets, visibility) | Hanya oleh pemilik repo |

### Layanan eksternal

- **Supabase hosted, HF Space, HF Hub, Vercel**: jangan menjalankan perintah yang mengubah data/skema/deploy di layanan hosted tanpa izin pengguna. Migrasi hosted dijalankan pengguna.
- Tes database berjalan di Supabase **lokal** (CI). Fixture hanya data sintetis.
- Jangan pernah menjalankan `supabase login` atau meminta/menampilkan access token. Berikan perintahnya ke pengguna untuk dijalankan di terminal mereka.
- Smoke test ke provider sungguhan: hemat kuota, jangan mencetak nilai key, laporkan nama variabel dan status saja.
- **Jangan meng-upload X-ray pasien sungguhan** ke layanan mana pun saat menguji. Pakai gambar contoh berlisensi atau sintetis.

### Secret

Jangan commit atau publish: `.env*` (kecuali `.env.example`), key Supabase service role, `GEMINI_API_KEY`, `HF_TOKEN`, `INFERENCE_API_SECRET`/`API_SECRET`, `IP_HASH_SALT`, checkpoint `*.pt`, gambar X-ray pengguna.

Sebelum commit, pindai diff staged untuk pola key (`AIza`, `hf_`, `sb_secret_`, `eyJhbGci`, `service_role`).

---

## 12. Verifikasi

Perintah wajib sebelum push (sama dengan CI, tersedia setelah M0):

```bash
cd web && npm run lint && npm run typecheck && npm test && npm run build
```

```bash
cd api && ruff check . && ruff format --check . && pytest -m "not smoke"
```

Tambahan sesuai risiko:

- **Model / Grad-CAM:** `pytest -m smoke` dengan checkpoint lokal (`MODEL_PATH`) atau dari HF Hub.
- **Migrasi/RLS:** tambah/ubah tes pgTAP di `supabase/tests/`, lalu tunggu job `Database pgTAP & RLS Tests` hijau.
- **Prompt:** `npm run eval:insight` (setelah M3), catat hasilnya di PR.
- **UI:** cek di browser pada 360–375 px, tablet, dan desktop; tidak ada overflow horizontal, tidak ada error console, keyboard + reduced-motion berfungsi, tema terang/gelap, ID/EN.

Jangan menyatakan "CI hijau" kalau CI yang diperiksa bukan untuk HEAD saat ini.

---

## 13. Commit & Pull Request

### Commit

- **Conventional Commits.** Prefix bahasa Inggris (`feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`), scope opsional, **deskripsi Bahasa Indonesia**.

  ```text
  feat(scan): tampilkan kotak temuan per kelompok di viewer
  fix(api): buang padding letterbox sebelum resize heatmap
  test(db): tambah pgTAP RLS untuk tabel scans
  ```

- **Jangan menambahkan footer AI** (`Co-Authored-By: Claude …`, "Generated with …", atau sejenisnya) di pesan commit.
- Satu commit = satu concern logis. Commit body menjelaskan alasan atau constraint yang tidak terlihat dari diff.
- Stage file secara eksplisit kalau working tree berisi perubahan yang tidak terkait.

### Body PR wajib lengkap

Body PR mengikuti `.github/pull_request_template.md`. Setiap bagian diisi; bagian yang tidak relevan diisi "Tidak ada" + alasannya:

1. **Ringkasan**: apa yang berubah dan mengapa, 2–4 kalimat.
2. **Konteks**: milestone, Issue (`#N`), User Story (`US-*`) / fitur (`F*`), ADR, dokumen acuan.
3. **Perubahan**: per area (UI, web server, API inferensi, database, Gemini, CI, dokumen), dengan path file kunci.
4. **Keputusan & trade-off**.
5. **Di luar scope / ditunda**.
6. **Cara uji**: perintah + hasil (jumlah tes, build) + langkah uji manual.
7. **Bukti**: status CI pada HEAD; screenshot desktop + mobile untuk UI; hasil smoke test (tanpa secret).
8. **Database & env**: migrasi baru (sudah/belum di hosted), env var baru, langkah setup pengguna.
9. **Risiko & rollback**.
10. **Checklist DoD** (§16).

Jangan menambahkan footer AI di body PR. Saat HEAD berubah berarti, **perbarui body PR**.

### Review PR

- Severity: **Blocker / Major / Minor / Tech Debt**.
- Komentar reviewer (manusia maupun AI) adalah hipotesis sampai diverifikasi terhadap HEAD, requirement, source, tes, dan bukti runtime.

---

## 14. Scope & Anti-Overengineering

Jangan:

- memperluas scope "sekalian", termasuk menarik fitur Fase 2 (PRD §5.2) ke MVP tanpa izin;
- refactor lintas modul tanpa kebutuhan;
- menambah dependency untuk beberapa baris kode;
- membuat abstraksi generik untuk satu kasus;
- mengubah kontrak API secara oportunistis.

Masalah yang tidak terkait: laporkan beserta dampaknya. Jangan diperbaiki otomatis, kecuali diperlukan agar task aman atau pengguna mengizinkan.

---

## 15. Delegasi / Subagent

Root agent tetap bertanggung jawab atas hasil akhir. Subagent dipakai hanya bila bermanfaat nyata (review independen, eksplorasi luas). Output subagent adalah evidence tambahan, bukan source of truth.

---

## 16. Definition of Done Agent

```text
[ ] Branch kerja dibuat dari development terbaru; HEAD diverifikasi
[ ] Milestone / Issue / User Story / fitur terkait diidentifikasi
[ ] Dokumen relevan dibaca; aturan domain §8 dipatuhi
[ ] Otorisasi & validasi di server; RLS + pgTAP untuk tabel baru
[ ] Perintah §12 lulus secara lokal
[ ] UI dicek 360 px + tablet + desktop + keyboard + reduced-motion + terang/gelap + ID/EN (bila ada UI)
[ ] Tidak ada secret / .env / checkpoint / X-ray / artefak QA di diff
[ ] Seluruh diff dibaca ulang; tidak ada perubahan yang tidak terkait
[ ] Dokumen terdampak disinkronkan (§10)
[ ] PR ke development dengan body lengkap (§13)
[ ] CI hijau pada HEAD PR
[ ] Blocker / langkah manual pengguna (migrasi, env, HF, Vercel) dilaporkan
[ ] Implemented / Verified / Merged / Deployed tidak dicampur
```

Kalau ada item wajib yang belum terpenuhi, pakai status jujur: `in progress`, `partial`, `blocked`, `not ready for merge`.

---

## 17. Prinsip Akhir

```text
TASK → BACA DOKUMEN → BRANCH BARU → IMPLEMENTASI → VERIFIKASI → SINKRON DOKUMEN → DIFF REVIEW → PR LENGKAP + CI HIJAU
```

`AGENTS.md` mengatur **cara kerja agent**. `docs/` mengatur **requirement, arsitektur, domain, desain, dan urutan kerja**. Ikuti source of truth, dan jangan mengklaim completion melebihi evidence.

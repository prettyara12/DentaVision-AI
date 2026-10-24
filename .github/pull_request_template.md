<!-- Isi semua bagian. Bagian yang tidak relevan: tulis "Tidak ada" + alasannya. Lihat AGENTS.md §13. -->

## Ringkasan

<!-- 2–4 kalimat: apa yang berubah dan mengapa. -->

Closes #

## Konteks

- **Milestone:** <!-- M0–M5, docs/roadmap.md -->
- **User Story / fitur:** <!-- US-xx / Fxx -->
- **ADR / dokumen acuan:** <!-- docs/... -->

## Perubahan

### UI

### Web server (Route Handlers)

### API inferensi

### Database

### Gemini / prompt

### CI / Tooling

### Dokumen

## Keputusan & trade-off

## Di luar scope / ditunda

## Cara uji

```bash
cd web && npm ci && npm run lint && npm run typecheck && npm test && npm run build
```

```bash
cd api && ruff check . && ruff format --check . && pytest -m "not smoke"
```

<!-- Hasil: jumlah tes lulus, status build. Lalu langkah uji manual. -->

## Bukti

- **CI pada HEAD:**
- **Screenshot (desktop + 360 px, terang/gelap):**
- **Smoke test model / provider (tanpa secret):**

## Database & environment

- **Migrasi baru:** <!-- path + sudah/belum dijalankan di Supabase hosted -->
- **Env var baru:**
- **Langkah setup untuk pemilik repo:**

## Risiko & rollback

## Checklist

- [ ] Branch dari `development` terbaru
- [ ] Otorisasi & validasi Zod di server; RLS + pgTAP untuk tabel baru
- [ ] Perintah verifikasi lulus lokal
- [ ] UI dicek desktop + 360 px + keyboard + reduced-motion + terang/gelap + ID/EN
- [ ] Tidak ada secret / `.env` / `*.pt` / X-ray / artefak QA di diff
- [ ] Dokumen terdampak disinkronkan
- [ ] CI hijau pada HEAD

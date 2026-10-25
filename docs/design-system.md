# Design System — "Lightbox"

## 1. Konsep

Metafora: **negatoskop**, kotak lampu tempat dokter menjepit film rontgen.

- **Ruang terang** (landing, upload, chat umum, riwayat, auth, privasi). Terasa seperti lembar laporan klinis yang rapi: latar tulang (bone) yang dingin, tipografi sans yang tegas, anotasi mono kecil, garis tipis, banyak ruang kosong.
- **Ruang gelap / lightbox** (halaman hasil). Lampu ruangan "dimatikan" dan X-ray menjadi satu-satunya sumber cahaya. Kotak temuan dan label berbentuk callout seperti anotasi radiologi.

Identitas visual datang dari **anotasi**: garis penunjuk (leader line), label mono kecil, angka confidence tabular, dan sweep garis scan. Bukan dari gradien, blob, atau ilustrasi.

Referensi yang dipelajari (dibuka di browser saat M2 dan M5 untuk detail):

| Produk | Yang diambil |
|---|---|
| Pearl Second Opinion | Kotak temuan berlabel langsung di atas rontgen ([dentalcompare](https://www.dentalcompare.com/News/577443-Pearl-Receives-Patent-for-AI-Technology/)) |
| Diagnocat (iF Design) | Overlay temuan yang bisa di-konfirmasi/disembunyikan, panel per gigi ([iF](https://ifdesign.com/en/winner-ranking/project/diagnocat-dental-analysis-system/580877)) |
| Linear, Vercel | Kerapian workspace gelap: hairline, kontras permukaan, tipografi kecil yang tetap terbaca |

## 2. Aturan anti-AI-slop

**Dilarang**

- Gradien ungu-biru, aurora/blob, glow neon, glassmorphism.
- Emoji sebagai ikon UI. Ilustrasi 3D clay / gigi kartun tersenyum.
- Grid kartu seragam 3 kolom ikon + judul + 2 baris teks.
- Hero "Revolutionize your dental health with AI ✨". Kata "AI-powered", "cutting-edge", "seamless", "unlock", "empower".
- Paragraf pembuka yang mengulang judul. Section "Why choose us". Testimoni palsu, angka statistik palsu ("10.000+ pengguna").
- Animasi fade-in-up yang sama untuk semua elemen saat scroll.
- Radius besar + shadow blur di semua elemen.
- Warna jet/rainbow untuk heatmap.

**Dianjurkan**

- X-ray asli sebagai elemen visual utama di landing.
- Anotasi mono: `CARIES · 0.71`, koordinat, nomor langkah `01 / 03`.
- Hairline 1 px, permukaan dibedakan dengan warna, bukan shadow.
- Satu aksen (`--accent`) yang dipakai hemat.

### 2.1 Aturan copy

- **Setiap kalimat harus membawa informasi.** Kalau dihapus dan halaman tetap jelas, hapus.
- Judul menyebut isi ("Upload X-ray panoramik"), bukan slogan.
- Maksimal 1 kalimat di bawah judul section. Tombol 1–3 kata, kata kerja di depan ("Upload X-ray", "Coba contoh").
- Tanpa tanda pisah (—) di tengah kalimat. Tanpa tanda seru.
- Bahasa Indonesia memakai "Anda". Bahasa Inggris memakai "you". Keduanya pendek dan aktif.
- Hasil AI selalu "AI menandai…" / "The AI marked…", tidak pernah "Anda menderita…".
- Pesan error: apa yang terjadi + apa yang bisa dilakukan. Tanpa kode error mentah.
- Tanpa istilah internal (nama model, provider, milestone) di UI, kecuali di halaman Tentang model.

## 3. Tokens

CSS variables di `@theme` Tailwind v4. Tema terang/gelap mengikuti sistem dengan toggle manual (`data-theme`). Ruang gelap (`[data-room="lightbox"]`) selalu memakai palet gelap, apa pun temanya.

### 3.1 Warna

| Token | Terang | Gelap / lightbox | Peran |
|---|---|---|---|
| `--bg` | `#F2F3EF` | `#0A0D0E` | Latar |
| `--surface` | `#E8EAE4` | `#121718` | Panel |
| `--surface-2` | `#DDE0D9` | `#1A2022` | Panel bersarang, input |
| `--ink` | `#0D1214` | `#E6EBEA` | Teks utama |
| `--ink-2` | `#4C5558` | `#8E9A9B` | Teks sekunder, label mono |
| `--rule` | `#CFD4CC` | `#263033` | Hairline, border |
| `--accent` | `#0B7A57` | `#7DF0C2` | CTA, fokus, sweep scan. Hemat |
| `--accent-ink` | `#F2F3EF` | `#06231A` | Teks di atas aksen |
| `--finding-attention` | `#C8363B` | `#FF6B6F` | Kelompok perlu perhatian |
| `--finding-treatment` | `#2E59C9` | `#7FA2FF` | Kelompok perawatan |
| `--finding-anatomy` | `#6B7376` | `#8E9A9B` | Kelompok anatomi |
| `--warn` | `#A86A00` | `#F2B54A` | Kuota hampir habis, kualitas rendah |

Semua pasangan teks/latar wajib lolos WCAG 2.2 AA (cek di M0 lewat skrip kontras). Warna kelompok selalu didampingi label teks atau bentuk, tidak hanya warna.

**Heatmap colormap**: ramp perseptual "inferno" (hitam → ungu → oranye → kuning muda), alpha naik bersama intensitas, opacity default 0,55.

### 3.2 Tipografi

| Peran | Font | Catatan |
|---|---|---|
| Display + UI | **Geist** | Judul tracking `-0.02em` |
| Data & anotasi | **Geist Mono** | Label temuan, confidence, langkah, koordinat; `font-variant-numeric: tabular-nums` |

Dimuat lewat `next/font` (self-hosted), `display: swap`.

| Token | Ukuran |
|---|---|
| `display` | `clamp(40px, 6vw, 88px)` / 1.0, weight 600 |
| `h1` | 32→44 px |
| `h2` | 22→28 px |
| `body` | 16 px / 1.6 |
| `small` | 14 px |
| `label` | 12 px mono, uppercase, tracking 0.06em |

### 3.3 Spacing, radius, elevasi

- Spacing basis 4 px. Ritme section 64 / 96 / 144.
- Radius: `sm` 4 px (input, tombol, chip), `md` 8 px (panel). Kotak temuan di viewer: 2 px.
- Elevasi: hairline + beda permukaan. Satu shadow untuk elemen mengambang (popover, sheet): `0 16px 32px -20px rgb(0 0 0 / .45)`.

## 4. Motion

Library: **Motion** (`motion/react`). Gerak menjelaskan perubahan state atau menunjukkan cara kerja produk.

| Token | Durasi | Easing | Pemakaian |
|---|---|---|---|
| `instant` | 120 ms | `ease-out` | hover, toggle |
| `quick` | 200 ms | `cubic-bezier(.2,.8,.2,1)` | tooltip, chip, heatmap crossfade |
| `base` | 320 ms | `cubic-bezier(.2,.8,.2,1)` | panel, sheet |
| `room` | 700 ms | `cubic-bezier(.65,0,.35,1)` | transisi terang → lightbox |
| `sweep` | 1600 ms | `linear` | garis scan |

**Momen bertanda tangan**

1. **Hero sweep.** Panoramik contoh di hero. Garis scan `--accent` menyapu kiri → kanan. Saat dilewati, kotak temuan digambar (stroke-dashoffset) dan callout mono muncul dengan leader line. Berulang pelan setiap 8 detik; berhenti saat tab tidak terlihat.
2. **Lampu dimatikan.** Masuk ke hasil: latar terang menyusut menjadi gelap lewat `clip-path: circle()` yang berpusat di gambar.
3. **Analisis nyata.** Selama `analyzing`, sweep berjalan di atas gambar milik pengguna, dan label langkah (`01 VALIDASI`, `02 DETEKSI & HEATMAP`) maju mengikuti tahap server yang sebenarnya. Deteksi dan heatmap satu panggilan ke API inferensi, jadi tidak dibuat dua langkah (keputusan pengguna 2026-10-25, #9).
4. **Hover sinkron.** Hover item daftar temuan → kotak di viewer menebal dan kotak lain meredup (opacity 0,25). Berlaku dua arah.
5. **Insight streaming.** Teks muncul per kalimat (bukan per karakter), kartu temuan masuk stagger 60 ms.

Aturan:

- `prefers-reduced-motion: reduce` → sweep, clip-path, dan stagger mati; langsung ke state akhir.
- Hanya animasikan `transform`, `opacity`, `clip-path`, `stroke-dashoffset`.

## 5. Komponen kunci

Basis shadcn/ui (Radix + Lucide), semua di-restyle dengan tokens. Tampilan default shadcn tidak boleh lolos.

| Komponen | Isi | State |
|---|---|---|
| `XrayViewer` | Gambar + layer kotak (SVG) + layer heatmap (canvas); zoom/pan/pinch | loading, ready, heatmap on/off |
| `FindingBox` | Kotak 2 px warna kelompok + callout mono `LABEL · 0.00` | default, hover, dimmed, hidden |
| `FindingList` | Daftar dikelompokkan, header kelompok + jumlah, item = nama + confidence + jumlah kotak | collapsed (anatomy default), empty |
| `HeatmapControl` | Pilih kelas + slider opacity + 1 kalimat cara membaca | off, on(class) |
| `ConfidenceFilter` | Slider ambang 0,10–0,90, default 0,25 | — |
| `InsightPanel` | Ringkasan, kartu per temuan, pertanyaan untuk dokter, disclaimer | streaming, done, unavailable |
| `ChatPanel` | Chip saran, daftar pesan (format percakapan sederhana, bukan bubble generik), input | idle, streaming, quota, error |
| `Dropzone` | Area drop + tombol pilih file + "Coba contoh" + toggle "Jangan simpan" (login) | idle, dragover, invalid, preparing |
| `ScanProgress` | Sweep + langkah bernomor mengikuti tahap server | waking, analyzing, rejected, error |
| `Disclaimer` | 1 kalimat + tautan Tentang model | inline, footer |
| `QuotaNotice` | Sisa kuota / waktu reset / ajakan login | warn, exceeded |

## 6. Layout responsif

| Breakpoint | Ruang terang | Lightbox (hasil) |
|---|---|---|
| < 640 | Satu kolom; nav atas ringkas + menu sheet | Viewer penuh lebar di atas (tinggi 55vh). Di bawahnya tab **Temuan / Ringkasan / Chat**. Chat sebagai bottom sheet di atas keyboard |
| 640–1024 | Dua kolom fleksibel | Viewer atas, panel tab di bawah |
| ≥ 1024 | Grid 12 kolom | Viewer kiri (8 kolom), panel kanan (4 kolom) dengan tab Temuan / Ringkasan / Chat |

- Hormati `env(safe-area-inset-*)`. Target sentuh ≥ 44 px.
- Uji di 360×640: tidak ada overflow horizontal, viewer bisa pinch-zoom tanpa menggulir halaman.

## 7. Aksesibilitas

- Kontras AA; fokus terlihat (outline 2 px `--accent`, offset 2 px).
- Viewer: kotak temuan juga tersedia sebagai daftar yang bisa dinavigasi keyboard; `FindingBox` dekoratif (`aria-hidden`), daftar adalah sumber yang dibaca screen reader.
- Panah keyboard menggeser viewer, `+`/`-` zoom, `H` toggle heatmap.
- Streaming insight/chat memakai `aria-live="polite"`.
- Atribut `lang` mengikuti locale.

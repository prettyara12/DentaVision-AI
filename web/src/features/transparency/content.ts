import type { Locale } from "@/lib/i18n";

// Long-form copy for /privacy and /about-model (PRD US-15). Facts come from
// docs/security-privacy.md (privacy) and docs/PRD.md §9 + architecture §3.2 (model).
// Keep both in sync with those documents.

export type Block = { title: string; lede?: string; points: string[] };

export const privacy: Record<Locale, { title: string; lede: string; blocks: Block[] }> = {
  id: {
    title: "Privasi",
    lede: "Apa yang disimpan, apa yang dikirim ke pihak lain, dan cara menghapusnya.",
    blocks: [
      {
        title: "Tanpa akun",
        points: [
          "X-ray diproses di memori server lalu dibuang.",
          "Hasil, ringkasan, dan chat hanya ada di tab browser ini dan hilang saat tab ditutup.",
          "Untuk kuota harian, alamat IP disimpan sebagai hash, bukan alamat aslinya.",
        ],
      },
      {
        title: "Dengan akun",
        points: [
          "X-ray, hasil deteksi, heatmap, ringkasan, dan chat disimpan privat di akun Anda. Hanya Anda yang bisa membukanya.",
          'Aktifkan "Jangan simpan" di halaman upload, maka scan itu diperlakukan seperti scan tanpa akun.',
          "Log aplikasi kami tidak mencatat gambar, isi chat, atau alamat IP asli.",
        ],
      },
      {
        title: "Dikirim ke pihak lain",
        lede: "Hanya yang dibutuhkan untuk tiap langkah.",
        points: [
          "Google Gemini menerima gambar terkompres untuk memeriksa apakah itu X-ray gigi.",
          "Untuk ringkasan dan chat, Google Gemini hanya menerima daftar temuan, ringkasan sebelumnya, dan maksimal 20 pesan terakhir. Gambar tidak ikut dikirim.",
          "Kami memakai Gemini versi gratis. Pada versi ini Google boleh memakai prompt dan respons untuk meningkatkan produknya.",
          "Layanan deteksi kami di Hugging Face Spaces menerima gambar terkompres, memprosesnya di memori, dan tidak menyimpannya.",
          "Supabase menyimpan data akun. Vercel menjalankan situs ini dan menerima request HTTP.",
        ],
      },
      {
        title: "Sebelum upload",
        points: [
          "Jangan upload gambar yang memuat nama atau data pribadi Anda. Potong bagian itu lebih dulu.",
          "Gambar contoh adalah X-ray publik berlisensi CC BY. Memilih contoh tidak mengirim apa pun ke Gemini atau server deteksi.",
        ],
      },
      {
        title: "Menghapus data",
        points: [
          "Hapus satu scan atau chat dari Riwayat. Chat milik scan itu ikut terhapus.",
          "Hapus akun dari Pengaturan untuk menghapus semua gambar, hasil, dan chat Anda.",
          "Penghapusan bersifat permanen, bukan disembunyikan.",
        ],
      },
    ],
  },
  en: {
    title: "Privacy",
    lede: "What is stored, what is sent to other services, and how to delete it.",
    blocks: [
      {
        title: "Without an account",
        points: [
          "The X-ray is processed in server memory and then discarded.",
          "Results, the summary, and the chat live only in this browser tab and disappear when you close it.",
          "For the daily limit, your IP address is stored as a hash, never the address itself.",
        ],
      },
      {
        title: "With an account",
        points: [
          "The X-ray, detections, heatmaps, summary, and chat are stored privately in your account. Only you can open them.",
          'Turn on "Don\'t save" on the upload page and that scan is handled like a scan without an account.',
          "Our application logs record no images, no chat text, and no raw IP addresses.",
        ],
      },
      {
        title: "Sent to other services",
        lede: "Only what each step needs.",
        points: [
          "Google Gemini receives the compressed image to check that it is a dental X-ray.",
          "For the summary and chat, Google Gemini receives only the list of findings, the previous summary, and at most the last 20 messages. The image is not sent.",
          "We use the free tier of Gemini. On this tier Google may use prompts and responses to improve its products.",
          "Our detection service on Hugging Face Spaces receives the compressed image, processes it in memory, and does not keep it.",
          "Supabase stores account data. Vercel hosts this site and receives HTTP requests.",
        ],
      },
      {
        title: "Before you upload",
        points: [
          "Do not upload images that show your name or other personal details. Crop them out first.",
          "The sample images are public X-rays licensed CC BY. Choosing a sample sends nothing to Gemini or the detection server.",
        ],
      },
      {
        title: "Deleting data",
        points: [
          "Delete a single scan or chat from History. A scan's chat is deleted with it.",
          "Delete your account in Settings to remove all your images, results, and chats.",
          "Deletion is permanent, not hidden.",
        ],
      },
    ],
  },
};

/** Validation metrics of the checkpoint (PRD §9, the only official numbers). */
export const metrics = [
  { key: "precision", value: 0.539 },
  { key: "recall", value: 0.386 },
  { key: "map50", value: 0.329 },
  { key: "map5095", value: 0.17 },
] as const;

type MetricKey = (typeof metrics)[number]["key"];

export const aboutModel: Record<
  Locale,
  {
    title: string;
    lede: string;
    model: Block;
    metricsTitle: string;
    metricsLede: string;
    metricLabels: Record<MetricKey, { name: string; meaning: string }>;
    metricsNote: string;
    limits: Block;
    dataset: Block;
    classesTitle: string;
    classesLede: string;
    samplesTitle: string;
  }
> = {
  id: {
    title: "Tentang model",
    lede: "Cara kerja deteksi, seberapa akurat, dan batasannya.",
    model: {
      title: "Model",
      points: [
        "Detektor YOLOv8m dengan backbone ResNet50, dilatih 50 epoch pada gambar 640 px dengan Ultralytics 8.4.161.",
        "Model mengenali 31 kelas temuan dan membuat heatmap Grad-CAM per kelas.",
        "Model menjalankan deteksi dari confidence 0,10. Halaman hasil menyembunyikan temuan di bawah 0,25, dan Anda bisa mengubah ambang itu.",
        "Ringkasan dan chat ditulis Google Gemini dari daftar temuan, bukan dari gambar.",
      ],
    },
    metricsTitle: "Metrik evaluasi pada data validasi",
    metricsLede: "Diukur pada checkpoint yang dipakai situs ini. Nilai maksimum 1.",
    metricLabels: {
      precision: {
        name: "Precision",
        meaning: "Dari semua kotak yang ditandai, sekitar 54% benar.",
      },
      recall: {
        name: "Recall",
        meaning: "Dari semua temuan yang ada, model menemukan sekitar 39%.",
      },
      map50: {
        name: "mAP50",
        meaning: "Skor gabungan ketepatan kotak, dengan syarat tumpang tindih 50%.",
      },
      map5095: {
        name: "mAP50-95",
        meaning: "Skor yang sama, dirata-rata pada syarat tumpang tindih 50% sampai 95%.",
      },
    },
    metricsNote: "Metrik per kelas belum tersedia.",
    limits: {
      title: "Batasan",
      points: [
        "AI menandai area yang mirip temuan. Ini bukan diagnosis. Bawa hasilnya ke dokter gigi.",
        "Model melewatkan sebagian besar temuan pada data validasi. Tidak ada temuan bukan berarti gigi Anda sehat.",
        "Model hanya dilatih pada X-ray panoramik. Foto gigi, X-ray lain, atau gambar buram memberi hasil yang tidak bisa dipercaya.",
        "Heatmap menunjukkan area yang paling memengaruhi model, bukan bukti adanya kelainan.",
        "Ringkasan dan jawaban chat ditulis model bahasa dan bisa keliru.",
      ],
    },
    dataset: {
      title: "Dataset training",
      points: ["Sumber dan lisensi dataset training belum dipublikasikan oleh pemilik model."],
    },
    classesTitle: "31 kelas",
    classesLede: "Dikelompokkan menurut tindak lanjut yang biasanya dibutuhkan.",
    samplesTitle: "Gambar contoh",
  },
  en: {
    title: "About the model",
    lede: "How detection works, how accurate it is, and where it falls short.",
    model: {
      title: "Model",
      points: [
        "A YOLOv8m detector with a ResNet50 backbone, trained for 50 epochs on 640 px images with Ultralytics 8.4.161.",
        "It recognizes 31 classes of findings and draws a Grad-CAM heatmap per class.",
        "The model detects from a confidence of 0.10. The result page hides findings under 0.25, and you can change that threshold.",
        "The summary and chat are written by Google Gemini from the list of findings, not from the image.",
      ],
    },
    metricsTitle: "Evaluation metrics on validation data",
    metricsLede: "Measured on the checkpoint this site uses. The maximum is 1.",
    metricLabels: {
      precision: { name: "Precision", meaning: "Of all boxes it marks, about 54% are correct." },
      recall: { name: "Recall", meaning: "Of all findings present, the model finds about 39%." },
      map50: { name: "mAP50", meaning: "A combined score of box accuracy, requiring 50% overlap." },
      map5095: {
        name: "mAP50-95",
        meaning: "The same score, averaged over overlap requirements from 50% to 95%.",
      },
    },
    metricsNote: "Per-class metrics are not available yet.",
    limits: {
      title: "Limitations",
      points: [
        "The AI marks areas that look like findings. This is not a diagnosis. Take the result to a dentist.",
        "The model misses most findings on the validation data. No findings does not mean your teeth are healthy.",
        "It was trained on panoramic X-rays only. Photos of teeth, other X-rays, or blurry images give results you cannot rely on.",
        "A heatmap shows the area that influenced the model most, not proof of a problem.",
        "The summary and chat answers are written by a language model and can be wrong.",
      ],
    },
    dataset: {
      title: "Training dataset",
      points: [
        "The source and license of the training dataset have not been published by the model owner.",
      ],
    },
    classesTitle: "31 classes",
    classesLede: "Grouped by the follow-up they usually need.",
    samplesTitle: "Sample images",
  },
};

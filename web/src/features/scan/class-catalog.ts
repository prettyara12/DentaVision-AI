import type { Locale } from "@/lib/i18n";

// Source of truth for the 31 classes (moved here from docs/class-catalog.md in #10).
// `id` is the index in the model's `model.names`; never reorder. Groups and urgency are decided here, not by an LLM.
export type FindingGroup = "attention" | "treatment" | "anatomy";

export type ClassInfo = {
  id: number;
  modelName: string;
  key: string;
  group: FindingGroup;
  name: Record<Locale, string>;
  description: Record<Locale, string>;
};

export const GROUPS: readonly FindingGroup[] = ["attention", "treatment", "anatomy"];

export const groupInfo: Record<
  FindingGroup,
  { label: Record<Locale, string>; color: string; visibleByDefault: boolean }
> = {
  attention: {
    label: { id: "Perlu perhatian", en: "Needs attention" },
    color: "var(--finding-attention)",
    visibleByDefault: true,
  },
  treatment: {
    label: { id: "Perawatan & alat", en: "Treatment & appliances" },
    color: "var(--finding-treatment)",
    visibleByDefault: true,
  },
  anatomy: {
    label: { id: "Anatomi normal", en: "Normal anatomy" },
    color: "var(--finding-anatomy)",
    visibleByDefault: false,
  },
};

export const classCatalog: readonly ClassInfo[] = [
  {
    id: 0,
    modelName: "Caries",
    key: "caries",
    group: "attention",
    name: { id: "Gigi berlubang (karies)", en: "Cavity (caries)" },
    description: {
      id: "Kerusakan email/dentin akibat bakteri, tampak lebih gelap di rontgen.",
      en: "Tooth decay that shows as a darker area on the X-ray.",
    },
  },
  {
    id: 1,
    modelName: "Crown",
    key: "crown",
    group: "treatment",
    name: { id: "Mahkota gigi", en: "Crown" },
    description: {
      id: "Penutup buatan yang menyelubungi gigi.",
      en: "An artificial cap covering a tooth.",
    },
  },
  {
    id: 2,
    modelName: "Filling",
    key: "filling",
    group: "treatment",
    name: { id: "Tambalan", en: "Filling" },
    description: {
      id: "Bahan pengisi gigi yang pernah berlubang.",
      en: "Material placed where a cavity was treated.",
    },
  },
  {
    id: 3,
    modelName: "Implant",
    key: "implant",
    group: "treatment",
    name: { id: "Implan", en: "Implant" },
    description: {
      id: "Sekrup logam di tulang rahang sebagai akar gigi buatan.",
      en: "A metal post in the jawbone acting as an artificial root.",
    },
  },
  {
    id: 4,
    modelName: "Malaligned",
    key: "malaligned",
    group: "attention",
    name: { id: "Gigi tidak rata", en: "Misaligned tooth" },
    description: {
      id: "Posisi gigi miring atau keluar dari lengkung.",
      en: "A tooth tilted or out of the dental arch.",
    },
  },
  {
    id: 5,
    modelName: "Mandibular Canal",
    key: "mandibular_canal",
    group: "anatomy",
    name: { id: "Saluran saraf rahang bawah", en: "Mandibular canal" },
    description: {
      id: "Saluran normal tempat saraf dan pembuluh darah rahang bawah.",
      en: "A normal channel carrying the lower jaw's nerve and vessels.",
    },
  },
  {
    id: 6,
    modelName: "Missing teeth",
    key: "missing_teeth",
    group: "attention",
    name: { id: "Gigi hilang", en: "Missing tooth" },
    description: {
      id: "Celah tempat gigi yang sudah tidak ada.",
      en: "A gap where a tooth is no longer present.",
    },
  },
  {
    id: 7,
    modelName: "Periapical lesion",
    key: "periapical_lesion",
    group: "attention",
    name: { id: "Lesi di ujung akar", en: "Periapical lesion" },
    description: {
      id: "Area gelap di ujung akar, sering terkait infeksi.",
      en: "A dark area at the root tip, often linked to infection.",
    },
  },
  {
    id: 8,
    modelName: "Retained root",
    key: "retained_root",
    group: "attention",
    name: { id: "Sisa akar", en: "Retained root" },
    description: {
      id: "Akar gigi yang tertinggal setelah mahkotanya hilang.",
      en: "A root left behind after the crown of the tooth is gone.",
    },
  },
  {
    id: 9,
    modelName: "Root Canal Treatment",
    key: "root_canal_treatment",
    group: "treatment",
    name: { id: "Perawatan saluran akar", en: "Root canal treatment" },
    description: {
      id: "Saluran akar yang sudah dibersihkan dan diisi.",
      en: "A root canal that has been cleaned and filled.",
    },
  },
  {
    id: 10,
    modelName: "Root Piece",
    key: "root_piece",
    group: "attention",
    name: { id: "Potongan akar", en: "Root fragment" },
    description: {
      id: "Fragmen akar kecil yang tertinggal di tulang.",
      en: "A small root fragment left in the bone.",
    },
  },
  {
    id: 11,
    modelName: "impacted tooth",
    key: "impacted_tooth",
    group: "attention",
    name: { id: "Gigi impaksi", en: "Impacted tooth" },
    description: {
      id: "Gigi yang tertahan dan tidak tumbuh sempurna, sering gigi bungsu.",
      en: "A tooth that cannot fully erupt, often a wisdom tooth.",
    },
  },
  {
    id: 12,
    modelName: "maxillary sinus",
    key: "maxillary_sinus",
    group: "anatomy",
    name: { id: "Sinus maksila", en: "Maxillary sinus" },
    description: {
      id: "Rongga udara normal di atas gigi rahang atas.",
      en: "A normal air space above the upper back teeth.",
    },
  },
  {
    id: 13,
    modelName: "Bone Loss",
    key: "bone_loss",
    group: "attention",
    name: { id: "Penurunan tulang", en: "Bone loss" },
    description: {
      id: "Tulang penyangga gigi berkurang, sering terkait penyakit gusi.",
      en: "Reduced supporting bone, often linked to gum disease.",
    },
  },
  {
    id: 14,
    modelName: "Fracture teeth",
    key: "fracture_teeth",
    group: "attention",
    name: { id: "Gigi retak/patah", en: "Fractured tooth" },
    description: {
      id: "Garis retak atau patahan pada gigi.",
      en: "A crack or break in a tooth.",
    },
  },
  {
    id: 15,
    modelName: "Permanent Teeth",
    key: "permanent_teeth",
    group: "anatomy",
    name: { id: "Gigi permanen", en: "Permanent teeth" },
    description: {
      id: "Gigi dewasa.",
      en: "Adult teeth.",
    },
  },
  {
    id: 16,
    modelName: "Supra Eruption",
    key: "supra_eruption",
    group: "attention",
    name: { id: "Gigi terlalu tumbuh (supra erupsi)", en: "Over-erupted tooth" },
    description: {
      id: "Gigi yang tumbuh melewati bidang gigitan, biasanya karena lawannya hilang.",
      en: "A tooth that has grown past the bite line, usually when its opposite is missing.",
    },
  },
  {
    id: 17,
    modelName: "TAD",
    key: "tad",
    group: "treatment",
    name: { id: "Mini-implan ortodonti (TAD)", en: "Temporary anchorage device" },
    description: {
      id: "Sekrup kecil sementara untuk membantu perawatan behel.",
      en: "A small temporary screw that supports braces treatment.",
    },
  },
  {
    id: 18,
    modelName: "abutment",
    key: "abutment",
    group: "treatment",
    name: { id: "Abutment", en: "Abutment" },
    description: {
      id: "Penghubung antara implan dan mahkota.",
      en: "The connector between an implant and its crown.",
    },
  },
  {
    id: 19,
    modelName: "attrition",
    key: "attrition",
    group: "attention",
    name: { id: "Gigi aus", en: "Tooth wear" },
    description: {
      id: "Permukaan gigi terkikis, sering karena menggertakkan gigi.",
      en: "Worn tooth surfaces, often from grinding.",
    },
  },
  {
    id: 20,
    modelName: "bone defect",
    key: "bone_defect",
    group: "attention",
    name: { id: "Defek tulang", en: "Bone defect" },
    description: {
      id: "Bagian tulang rahang yang bentuknya tidak normal atau hilang.",
      en: "An area of jawbone that is missing or irregular.",
    },
  },
  {
    id: 21,
    modelName: "gingival former",
    key: "gingival_former",
    group: "treatment",
    name: { id: "Pembentuk gusi", en: "Healing abutment" },
    description: {
      id: "Tutup sementara di implan untuk membentuk gusi.",
      en: "A temporary cap on an implant that shapes the gum.",
    },
  },
  {
    id: 22,
    modelName: "metal band",
    key: "metal_band",
    group: "treatment",
    name: { id: "Cincin logam behel", en: "Orthodontic band" },
    description: {
      id: "Cincin logam di gigi geraham sebagai bagian behel.",
      en: "A metal ring on a molar, part of braces.",
    },
  },
  {
    id: 23,
    modelName: "orthodontic brackets",
    key: "orthodontic_brackets",
    group: "treatment",
    name: { id: "Braket behel", en: "Braces brackets" },
    description: {
      id: "Braket yang ditempel di gigi untuk behel.",
      en: "Brackets bonded to teeth for braces.",
    },
  },
  {
    id: 24,
    modelName: "permanent retainer",
    key: "permanent_retainer",
    group: "treatment",
    name: { id: "Retainer cekat", en: "Fixed retainer" },
    description: {
      id: "Kawat tipis di belakang gigi agar posisi tetap setelah behel.",
      en: "A thin wire behind the teeth that holds them after braces.",
    },
  },
  {
    id: 25,
    modelName: "post - core",
    key: "post_core",
    group: "treatment",
    name: { id: "Pasak & inti", en: "Post and core" },
    description: {
      id: "Pasak di saluran akar untuk menopang mahkota.",
      en: "A post in the root canal that supports a crown.",
    },
  },
  {
    id: 26,
    modelName: "plating",
    key: "plating",
    group: "treatment",
    name: { id: "Plat fiksasi", en: "Bone plate" },
    description: {
      id: "Plat logam di rahang, biasanya setelah operasi atau patah tulang.",
      en: "A metal plate on the jaw, usually after surgery or fracture.",
    },
  },
  {
    id: 27,
    modelName: "wire",
    key: "wire",
    group: "treatment",
    name: { id: "Kawat", en: "Wire" },
    description: {
      id: "Kawat ortodonti atau fiksasi rahang.",
      en: "An orthodontic or jaw fixation wire.",
    },
  },
  {
    id: 28,
    modelName: "Cyst",
    key: "cyst",
    group: "attention",
    name: { id: "Kista", en: "Cyst" },
    description: {
      id: "Rongga berisi cairan di tulang rahang.",
      en: "A fluid-filled cavity in the jawbone.",
    },
  },
  {
    id: 29,
    modelName: "Root resorption",
    key: "root_resorption",
    group: "attention",
    name: { id: "Resorpsi akar", en: "Root resorption" },
    description: {
      id: "Akar gigi memendek karena terkikis dari dalam atau luar.",
      en: "A root that has shortened as it is worn away.",
    },
  },
  {
    id: 30,
    modelName: "Primary teeth",
    key: "primary_teeth",
    group: "anatomy",
    name: { id: "Gigi susu", en: "Baby teeth" },
    description: {
      id: "Gigi anak yang nantinya diganti gigi permanen.",
      en: "Children's teeth that are later replaced.",
    },
  },
];

import type { Locale } from "@/lib/i18n";

// Sample X-rays (US-01). Images live in public/samples/{key}.jpg (longest side 2048, like an upload);
// the model's result for each is precomputed in ./samples/{key}.json, so a sample costs no inference or quota.
export type SampleKey = "impacted" | "restorations" | "missing";

export type Sample = {
  key: SampleKey;
  label: Record<Locale, string>;
  credit: string;
  license: { name: string; url: string };
  source: string;
};

const MENDELEY = {
  credit: "Brahmi, Jdey & Drira, Panoramic Dental Xray Dataset (Mendeley Data, V3)",
  license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  source: "https://doi.org/10.17632/73n3kz2k4k.3",
};

export const samples: readonly Sample[] = [
  {
    key: "impacted",
    label: { id: "Gigi bungsu", en: "Wisdom teeth" },
    credit: "Coronation Dental Specialty Group, Basic panoramic radiograph.jpg (Wikimedia Commons)",
    license: { name: "CC BY 3.0", url: "https://creativecommons.org/licenses/by/3.0/" },
    source: "https://commons.wikimedia.org/wiki/File:Basic_panoramic_radiograph.jpg",
  },
  {
    key: "restorations",
    label: { id: "Mahkota & perawatan", en: "Crowns & treatment" },
    ...MENDELEY,
  },
  { key: "missing", label: { id: "Gigi hilang", en: "Missing teeth" }, ...MENDELEY },
];

export const findSample = (key: string) => samples.find((s) => s.key === key);

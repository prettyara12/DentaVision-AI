import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { privacy } from "@/features/transparency/content";
import { BlockSection, DocPage } from "@/features/transparency/doc-page";
import { isLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${privacy[lang].title} · DentaVision AI` } : {};
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const page = privacy[lang];

  return (
    <DocPage title={page.title} lede={page.lede}>
      {page.blocks.map((block) => (
        <BlockSection key={block.title} block={block} />
      ))}
    </DocPage>
  );
}

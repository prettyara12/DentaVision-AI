import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ResetForm } from "@/features/auth/auth-forms";
import { AuthPage } from "@/features/auth/auth-page";
import { isLocale, t } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/reset-password">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${t(lang, "auth.reset.title")} · DentaVision AI` } : {};
}

export default async function ResetPasswordPage({ params }: PageProps<"/[lang]/reset-password">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <AuthPage title={t(lang, "auth.reset.title")} lede={t(lang, "auth.reset.lede")}>
      <ResetForm lang={lang} />
    </AuthPage>
  );
}

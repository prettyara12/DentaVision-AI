import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegisterForm } from "@/features/auth/auth-forms";
import { AuthPage } from "@/features/auth/auth-page";
import { isLocale, t } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/register">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${t(lang, "auth.register.title")} · DentaVision AI` } : {};
}

export default async function RegisterPage({ params }: PageProps<"/[lang]/register">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <AuthPage title={t(lang, "auth.register.title")} lede={t(lang, "auth.register.lede")}>
      <RegisterForm lang={lang} />
    </AuthPage>
  );
}

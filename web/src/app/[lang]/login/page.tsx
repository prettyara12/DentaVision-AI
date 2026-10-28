import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LoginForm } from "@/features/auth/auth-forms";
import { AuthPage } from "@/features/auth/auth-page";
import { isLocale, t } from "@/lib/i18n";

export async function generateMetadata({ params }: PageProps<"/[lang]/login">): Promise<Metadata> {
  const { lang } = await params;
  return isLocale(lang) ? { title: `${t(lang, "auth.login.title")} · DentaVision AI` } : {};
}

export default async function LoginPage({ params }: PageProps<"/[lang]/login">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <AuthPage title={t(lang, "auth.login.title")} lede={t(lang, "auth.login.lede")}>
      <LoginForm lang={lang} />
    </AuthPage>
  );
}

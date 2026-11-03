import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ThemeScript } from "@/components/theme-toggle";
import { isLocale, locales, t } from "@/lib/i18n";
import "../globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// The on-screen keyboard shrinks the layout, so the chat sheet stays above it.
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  return { title: "DentaVision AI", description: t(lang, "meta.description") };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    // suppressHydrationWarning: themeScript sets data-theme on <html> before React hydrates.
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans">
        {/* First in <body>: parser-blocking, so the saved theme applies before anything paints. */}
        <ThemeScript />
        <SiteHeader lang={lang} />
        {children}
        <SiteFooter lang={lang} />
      </body>
    </html>
  );
}

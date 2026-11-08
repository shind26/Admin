import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { VietnameseFormValidation } from "@/components/vietnamese-form-validation";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kiêu Giang | Quản lý nhà trọ",
  description: "Hệ thống quản trị vận hành nhà trọ Kiêu Giang",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const t = localStorage.getItem('kg_theme');
                const darkMedia = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const isDark = t === 'dark' || (!t && darkMedia) || (t === 'system' && darkMedia);
                const effective = isDark ? 'dark' : 'light';
                document.documentElement.setAttribute('data-theme', effective);
                document.documentElement.style.colorScheme = effective;
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <VietnameseFormValidation />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

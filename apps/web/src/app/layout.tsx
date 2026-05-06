import type { Metadata } from "next";
import { IBM_Plex_Mono, Geist_Mono } from "next/font/google";
import "@hermes/ui/globals.css";

/**
 * IBM Plex Mono is the house typeface — characterful, humanist, with the
 * bar-heavy numerals and distinctive zero we want for a terminal aesthetic.
 * Geist Mono stays loaded as a fallback for code blocks where Streamdown
 * wants an extra-tight mono rhythm.
 */
const plex = IBM_Plex_Mono({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hermes AI",
  description: "The messenger between your tools.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // Dark by default; `suppressHydrationWarning` on <html> covers the theme
      // swap if we add next-themes later.
      className={`dark ${plex.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}

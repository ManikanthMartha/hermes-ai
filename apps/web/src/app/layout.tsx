import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "@hermes/ui/globals.css";

/**
 * IBM Plex Mono is the house typeface — characterful, humanist, with the
 * bar-heavy numerals and distinctive zero we want for a terminal aesthetic.
 * Geist Mono stays loaded as a fallback for code blocks where Streamdown
 * wants an extra-tight mono rhythm.
 */
const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
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
      className={`${geist.variable} ${instrumentSerif.variable} ${geistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Public_Sans, Spectral, Newsreader, Lora } from "next/font/google";
import "./globals.css";
import { connection } from "next/server";

const publicSans = Public_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-google",
});

const spectral = Spectral({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-spectral-google",
});

const newsreader = Newsreader({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  variable: "--font-newsreader-google",
});

const lora = Lora({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
  variable: "--font-lora-google",
});

export const metadata: Metadata = {
  title: "Elektronické hlasovanie vlastníkov",
  description: "Elektronické hlasovanie vlastníkov bytov a nebytových priestorov podľa zákona č. 182/1993 Z. z.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();
  return (
    <html
      lang="sk"
      className={`${publicSans.variable} ${spectral.variable} ${newsreader.variable} ${lora.variable}`}
      style={{ height: "100%" }}
    >
      <body style={{ height: "100%", margin: 0 }}>{children}</body>
    </html>
  );
}

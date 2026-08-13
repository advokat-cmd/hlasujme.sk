import type { Metadata } from "next";
import "./globals.css";
import { connection } from "next/server";

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
    <html lang="sk" style={{ height: "100%" }}>
      <body style={{ height: "100%", margin: 0 }}>{children}</body>
    </html>
  );
}

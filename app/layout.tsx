import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lovygo — blíž, i když daleko",
  description: "Soukromý prostor pro dva, kteří jsou od sebe daleko.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className={`${geist.variable} antialiased`}>{children}</body>
    </html>
  );
}

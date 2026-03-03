import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Research7",
  description:
    "Discover, vectorize, and semantically search research papers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TranscriptRAG",
  description: "Search and retrieve knowledge from video transcripts",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

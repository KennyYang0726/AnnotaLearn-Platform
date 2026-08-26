import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AnnotaLearn",
  description: "PDF閱讀、重點標記與盲點提問教學平台",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}

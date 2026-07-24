import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sports AI",
  description: "KBO 경기 데이터와 AI 예측을 한눈에 확인하는 분석 서비스",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

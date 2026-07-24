import type { Metadata } from "next";
import "./globals.css";

const siteUrl = "https://sports-ai-alpha.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Sports AI | KBO · MLB · NPB AI 야구 분석",
    template: "%s | Sports AI",
  },

  description:
    "KBO, MLB, NPB 경기 분석과 AI 승부예측을 제공합니다. 선발투수 비교, 최근 경기 기록, 맞대결, 불펜 피로도와 팀 전력 정보를 한눈에 확인하세요.",

  keywords: [
    "Sports AI",
    "KBO 분석",
    "MLB 분석",
    "NPB 분석",
    "야구 분석",
    "야구 예측",
    "AI 야구 분석",
    "승부 예측",
    "선발투수 분석",
    "야구 통계",
  ],

  applicationName: "Sports AI",
  authors: [{ name: "Sports AI" }],
  creator: "Sports AI",
  publisher: "Sports AI",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: "Sports AI",
    title: "Sports AI | KBO · MLB · NPB AI 야구 분석",
    description:
      "KBO, MLB, NPB 경기 분석, 선발투수 비교, 최근 기록, 맞대결과 AI 승부예측 정보를 확인하세요.",
  },

  twitter: {
    card: "summary_large_image",
    title: "Sports AI | KBO · MLB · NPB AI 야구 분석",
    description:
      "KBO, MLB, NPB 경기 분석과 AI 승부예측 정보를 한눈에 확인하세요.",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  category: "sports",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import "./globals.css";

const siteUrl = "https://장군분석.kr";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "장군 AI | KBO · MLB · NPB AI 야구 분석",
    template: "%s | 장군 AI",
  },

  description:
    "KBO, MLB, NPB 경기 분석과 AI 승부예측을 제공합니다. 선발투수 비교, 최근 경기 기록, 맞대결, 불펜 피로도와 팀 전력 정보를 한눈에 확인하세요.",

  keywords: [
    "장군 AI",
    "장군",
    "장군 야구분석",
    "장군 AI 야구분석",
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

  applicationName: "장군 AI",
  authors: [{ name: "장군 AI" }],
  creator: "장군 AI",
  publisher: "장군 AI",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: siteUrl,
    siteName: "장군 AI",
    title: "장군 AI | KBO · MLB · NPB AI 야구 분석",
    description:
      "KBO, MLB, NPB 경기 분석, 선발투수 비교, 최근 기록, 맞대결과 AI 승부예측 정보를 확인하세요.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "장군 AI 야구 분석" }],
  },

  twitter: {
    card: "summary_large_image",
    title: "장군 AI | KBO · MLB · NPB AI 야구 분석",
    description:
      "KBO, MLB, NPB 경기 분석과 AI 승부예측 정보를 한눈에 확인하세요.",
    images: ["/opengraph-image"],
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

const brandJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "장군 AI",
      alternateName: ["장군", "장군 야구분석"],
      url: siteUrl,
      logo: `${siteUrl}/opengraph-image`,
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "장군 AI",
      alternateName: "장군 야구분석",
      inLanguage: "ko-KR",
      publisher: { "@id": `${siteUrl}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(brandJsonLd) }}
        />
        <link rel="alternate" type="application/rss+xml" title="장군 AI 경기 분석 RSS" href="/rss.xml" />
        <meta
          name="naver-site-verification"
          content="c2a0a0d6a7e04ab4613aa0eec44375d3aba7ae1d"
        />
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4211269647736996"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-XHP41FCMNQ" />
        <Script id="ga4">{`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-XHP41FCMNQ');`}</Script>
        {children}
        <Analytics />
      </body>
    </html>
  );
}

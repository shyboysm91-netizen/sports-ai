import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import Link from "next/link";
import AdSenseSafeLoader from "./AdSenseSafeLoader";
import "./globals.css";

const siteUrl = "https://장군분석.kr";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "장군 AI | KBO · MLB · NPB AI 야구 분석",
    template: "%s | 장군 AI",
  },

  description:
    "KBO, MLB, NPB 경기의 선발투수, 최근 기록, 맞대결, 불펜 피로도와 팀 전력을 데이터로 비교합니다.",

  keywords: [
    "장군 AI",
    "장군",
    "장군 야구분석",
    "장군 AI 야구분석",
    "KBO 분석",
    "MLB 분석",
    "NPB 분석",
    "야구 분석",
    "AI 야구 분석",
    "야구 기록",
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
      "KBO, MLB, NPB 경기 분석, 선발투수 비교, 최근 기록과 맞대결 정보를 확인하세요.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "장군 AI 야구 분석" }],
  },

  twitter: {
    card: "summary_large_image",
    title: "장군 AI | KBO · MLB · NPB AI 야구 분석",
    description:
      "KBO, MLB, NPB 선수 기록과 경기 데이터 분석을 한눈에 확인하세요.",
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
          content="f641b1723e56622a70a6e827f2e80dd133b8a0d5"
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <AdSenseSafeLoader />
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-XHP41FCMNQ" />
        <Script id="ga4">{`window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-XHP41FCMNQ');`}</Script>
        {children}
        <footer className="mt-auto border-t border-slate-800 bg-slate-950 px-5 py-10 text-slate-400">
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-[1.4fr_1fr_1fr]">
            <div><p className="text-lg font-black text-white">장군 AI</p><p className="mt-3 max-w-xl text-sm leading-6">공개된 야구 기록을 정리해 선발, 타선, 불펜과 최근 흐름을 비교합니다. 자동 분석은 참고 정보이며 경기 결과나 금전적 이익을 보장하지 않습니다.</p></div>
            <div><p className="font-black text-white">분석 정보</p><div className="mt-3 grid gap-2 text-sm"><Link href="/players">KBO·MLB·NPB 선수 기록</Link><Link href="/guide">야구 분석 가이드</Link><Link href="/guide/how-it-works">분석 방법과 한계</Link><Link href="/guide/bullpen-fatigue">불펜 피로도 기준</Link><Link href="/about">서비스 소개</Link></div></div>
            <div><p className="font-black text-white">운영 정책</p><div className="mt-3 grid gap-2 text-sm"><Link href="/contact">문의·오류 제보</Link><Link href="/privacy">개인정보처리방침</Link><Link href="/terms">이용약관</Link></div></div>
          </div>
          <p className="mx-auto mt-8 max-w-6xl border-t border-slate-800 pt-5 text-xs">데이터 출처: KBO·MLB Stats API·NPB 공식 기록·MyKBO Stats 및 공개 시장 정보. 갱신 시점에 따라 실제 정보와 차이가 있을 수 있습니다.</p>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}

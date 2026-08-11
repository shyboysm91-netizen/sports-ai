"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const SAFE_PREFIXES = ["/players", "/player/", "/guide", "/about", "/contact", "/privacy", "/terms"];

export default function AdSenseSafeLoader() {
  const pathname = usePathname();
  const safe = pathname === "/" || SAFE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix));
  if (!safe) return null;
  return <Script id="adsense" async strategy="afterInteractive" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4211269647736996" crossOrigin="anonymous" />;
}

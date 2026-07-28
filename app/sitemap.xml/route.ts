import { NextResponse } from "next/server";
export const dynamic = "force-static";
const BASE_URL = "https://sports-ai-alpha.vercel.app";
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <sitemap><loc>${BASE_URL}/sitemap-pages.xml</loc></sitemap>\n  <sitemap><loc>${BASE_URL}/sitemap-analysis.xml</loc></sitemap>\n</sitemapindex>`;
const headers = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" } as const;
export function GET() { return new NextResponse(xml, { status: 200, headers }); }
export function HEAD() { return new NextResponse(null, { status: 200, headers }); }

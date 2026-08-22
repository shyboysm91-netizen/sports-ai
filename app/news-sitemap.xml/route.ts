import { NextResponse } from "next/server";
import { listNews } from "../lib/news-db";
export const dynamic="force-dynamic"; const SITE=process.env.NEXT_PUBLIC_SITE_URL||"https://장군분석.kr";
function x(v:string){return v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&apos;");}
export async function GET(){let articles:Awaited<ReturnType<typeof listNews>>=[];try{articles=await listNews({status:"published",limit:1000});}catch{}const urls=articles.map(a=>`<url><loc>${x(`${SITE}/news/${a.slug}`)}</loc><lastmod>${a.updatedAt}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`).join("");return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,{headers:{"Content-Type":"application/xml; charset=utf-8","Cache-Control":"public, s-maxage=900, stale-while-revalidate=3600"}});}

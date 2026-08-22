const queries = [
  ["MLB", "MLB when:1d"],
  ["축구", "Premier League football when:1d"],
  ["NBA", "NBA when:1d"],
  ["NPB", "NPB 일본프로야구 when:1d"],
];
const decode = (value) => value.replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');
for (const [category, query] of queries) {
  const english = category === "MLB" || category === "축구" || category === "NBA";
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${english ? "en-US" : "ko"}&gl=${english ? "US" : "KR"}&ceid=${english ? "US:en" : "KR:ko"}`;
  const xml = await (await fetch(url)).text();
  console.log(`### ${category}`);
  for (const match of [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 12)) {
    const item = match[1];
    const title = decode(item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "");
    const source = decode(item.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || "");
    const published = decode(item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "");
    const link = decode(item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "");
    console.log(JSON.stringify({ title, source, published, link }));
  }
}

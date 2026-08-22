import fs from "node:fs";
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/).filter(line=>line&&!line.startsWith("#")&&line.includes("=")).map(line=>{const i=line.indexOf("=");return [line.slice(0,i).trim(),line.slice(i+1).trim().replace(/^['"]|['"]$/g,"")]}));
const response=await fetch("https://www.xn--6e0by81a7uc94i.kr/api/cron/news",{method:"POST",headers:{Authorization:`Bearer ${env.CRON_SECRET}`}});
const text=await response.text();
if(!response.ok)throw new Error(`${response.status} ${text}`);
console.log(text);

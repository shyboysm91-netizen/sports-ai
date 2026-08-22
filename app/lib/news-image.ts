import "server-only";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function imagePrompt(title:string, category:string, summary:string){
  return `Create an original premium editorial sports illustration for a Korean sports analysis website.\nCategory: ${category}\nStory: ${title}\nContext: ${summary}\nIf the story names a real athlete, coach or other public sports figure, make that named person recognizable and clearly central to the image. If no person is named, focus on the relevant sport, team situation or venue instead of inventing a celebrity. Use a wide 16:9 composition with a realistic stadium or arena atmosphere. Make it clearly an original AI editorial illustration, not a copied press photograph. No team logos, league marks, brands, text, captions, signatures or watermarks.`;
}

function knownPersonImage(title:string){
  if(title.includes("탐슨")) return "/news-klay-thompson-trade-20260822.png";
  if(title.includes("손흥민")) return "/news-son-heung-min-epl-20260822.png";
  if(title.includes("이정후")&&(title.includes("연속 안타")||title.includes("실책성 플레이"))) return "/news-lee-jung-hoo-defense-20260822.png";
  if(title.includes("이정후")) return "/news-lee-jung-hoo-boston-20260822.png";
  return null;
}

async function uploadImage(bytes:Uint8Array, slug:string){
  if(!supabaseUrl||!serviceKey) return null;
  const path=`news-images/${slug}.png`;
  const response=await fetch(`${supabaseUrl}/storage/v1/object/${path}`,{method:"POST",headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"image/png","x-upsert":"true"},body:bytes.buffer as ArrayBuffer,cache:"no-store"});
  if(!response.ok) return null;
  return `${supabaseUrl}/storage/v1/object/public/${path}`;
}

export async function generateNewsImage(input:{title:string;category:string;summary:string;slug:string}){
  const personFallback=knownPersonImage(input.title);
  const token=process.env.OPENAI_API_KEY||process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN;
  if(process.env.NEWS_IMAGE_GENERATION==="false"||!token) return personFallback||"/news-ai-daily-sports.png";
  try{
    const apiBase=process.env.OPENAI_API_KEY?"https://api.openai.com/v1":"https://ai-gateway.vercel.sh/v1";
    const response=await fetch(`${apiBase}/responses`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.NEWS_OPENAI_MODEL||process.env.OPENAI_MODEL||"gpt-5-mini",input:imagePrompt(input.title,input.category,input.summary),tools:[{type:"image_generation",size:"1536x1024",quality:"low"}]}),cache:"no-store"});
    if(!response.ok) return personFallback||"/news-ai-daily-sports.png";
    const json=await response.json();
    const base64=json.output?.find((item:{type?:string})=>item.type==="image_generation_call")?.result;
    if(!base64) return personFallback||"/news-ai-daily-sports.png";
    return await uploadImage(Uint8Array.from(Buffer.from(base64,"base64")),input.slug)||personFallback||"/news-ai-daily-sports.png";
  }catch{return personFallback||"/news-ai-daily-sports.png";}
}

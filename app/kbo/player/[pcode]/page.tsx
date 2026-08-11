import { permanentRedirect } from "next/navigation";
export default async function LegacyKboPlayerPage({ params }: { params: Promise<{ pcode: string }> }) { const { pcode } = await params; permanentRedirect(`/player/kbo/${encodeURIComponent(pcode)}`); }

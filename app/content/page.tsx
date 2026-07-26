import { Suspense } from "react";
import ContentClient from "./ContentClient";

export default function ContentPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-950 p-10 text-white">콘텐츠 제작기를 불러오는 중입니다.</main>}>
      <ContentClient />
    </Suspense>
  );
}

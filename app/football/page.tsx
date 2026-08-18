import type { Metadata } from "next";
import FootballClient from "./FootballClient";

export const metadata: Metadata = { title:"축구 경기 일정 | 장군 AI", description:"프리미어리그, 라리가, 분데스리가, 세리에 A, K리그1 경기 일정을 한국시간으로 확인하세요." };
export default function FootballPage(){ return <FootballClient/>; }

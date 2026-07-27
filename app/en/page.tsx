import type { Metadata } from "next";
import Home from "../page";

export const metadata: Metadata = {
  title: "Sports AI | KBO, MLB & NPB Baseball Predictions",
  description: "AI-powered KBO, MLB and NPB game analysis with starting pitcher comparisons, recent form, head-to-head records, bullpen fatigue and win probabilities.",
  alternates: {
    canonical: "/en",
    languages: { "ko-KR": "/", "en-US": "/en" },
  },
  openGraph: {
    locale: "en_US",
    title: "Sports AI | Baseball Predictions",
    description: "KBO, MLB and NPB AI baseball analysis and predictions.",
    url: "/en",
  },
};

export default Home;

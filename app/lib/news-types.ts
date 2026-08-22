export const NEWS_CATEGORIES = ["KBO", "MLB", "NPB", "축구", "NBA", "기타"] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];
export type NewsStatus = "draft" | "scheduled" | "published" | "private";

export type NewsContent = {
  whatHappened: string[];
  keyPoints: string[];
  analysis: string[];
  data: Array<{ label: string; value: string; source?: string }>;
  outlook: string[];
};

export type NewsArticle = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: NewsContent;
  category: NewsCategory;
  imageUrl: string;
  sourceUrls: string[];
  sourceNames: string[];
  players: string[];
  teams: string[];
  sourcePublishedAt?: string | null;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  status: NewsStatus;
  seoTitle: string;
  seoDescription: string;
  contentHash: string;
  normalizedTitle: string;
  readingMinutes: number;
};

export type NewsCandidate = {
  title: string;
  summary: string;
  url: string;
  sourceName: string;
  publishedAt: string;
  category: NewsCategory;
  score: number;
};

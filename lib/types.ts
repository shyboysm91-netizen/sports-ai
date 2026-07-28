export type Category = 'health' | 'pregnancy';
export type CardItem = { title: string; body: string };
export type ContentDraft = {
  id: string;
  category: Category;
  topic: string;
  title: string;
  cards: CardItem[];
  caption: string;
  hashtags: string[];
  scheduledDate: string;
  scheduledTime: string;
  status: 'draft' | 'telegram_sent' | 'published' | 'cancelled';
  telegramMessageId?: number;
};

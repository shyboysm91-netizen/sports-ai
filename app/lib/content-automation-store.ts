import { readSportsCache, writeSportsCache } from "@/app/lib/sports-db-cache";

export type ApprovalRecord = {
  approvalId: string;
  league: string;
  date: string;
  away: string;
  home: string;
  title: string;
  description: string;
  hashtags: string;
  platforms: string[];
  privacyStatus?: "private" | "unlisted" | "public";
  status: "waiting" | "uploading" | "published" | "cancelled" | "failed";
  telegramFileId?: string;
  fileName?: string;
  mimeType?: string;
  youtubeVideoId?: string;
  youtubeUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const APPROVAL_TTL = 60 * 60 * 24 * 30;
const TOKEN_TTL = 60 * 60 * 24 * 180;

function approvalKey(id: string) {
  return `content-approval:${id}`;
}

export async function saveApproval(record: ApprovalRecord) {
  return writeSportsCache(approvalKey(record.approvalId), record, APPROVAL_TTL);
}

export async function readApproval(id: string): Promise<ApprovalRecord | null> {
  const row = await readSportsCache(approvalKey(id));
  return (row?.payload as ApprovalRecord | undefined) || null;
}

export async function updateApproval(id: string, patch: Partial<ApprovalRecord>) {
  const current = await readApproval(id);
  if (!current) return false;
  return saveApproval({ ...current, ...patch, updatedAt: new Date().toISOString() });
}

export async function saveYoutubeToken(encryptedToken: string) {
  return writeSportsCache("content-youtube-token", { encryptedToken }, TOKEN_TTL);
}

export async function readYoutubeToken(): Promise<string | null> {
  const row = await readSportsCache("content-youtube-token");
  const payload = row?.payload as { encryptedToken?: string } | undefined;
  return payload?.encryptedToken || null;
}

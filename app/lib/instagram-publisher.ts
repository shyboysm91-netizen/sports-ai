export const INSTAGRAM_GRAPH_VERSION = "v25.0";

function env() {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_ACCOUNT_ID || process.env.INSTAGRAM_USER_ID;
  if (!accessToken || !accountId) {
    throw new Error("INSTAGRAM_ACCESS_TOKEN과 INSTAGRAM_ACCOUNT_ID가 필요합니다.");
  }
  return { accessToken, accountId };
}

async function graphJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const text = await response.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!response.ok || json?.error) {
    const message = json?.error?.message || json?.error?.error_user_msg || text || `Instagram API 오류 (${response.status})`;
    throw new Error(message);
  }
  return json;
}

function formBody(values: Record<string, string>) {
  const form = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => form.set(key, value));
  return form;
}

async function waitForContainer(containerId: string, accessToken: string) {
  const deadline = Date.now() + 150_000;
  let lastStatus = "IN_PROGRESS";
  while (Date.now() < deadline) {
    const url = new URL(`https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${containerId}`);
    url.searchParams.set("fields", "status_code,status");
    url.searchParams.set("access_token", accessToken);
    const result = await graphJson(url.toString());
    lastStatus = String(result?.status_code || result?.status || "IN_PROGRESS").toUpperCase();
    if (lastStatus === "FINISHED") return;
    if (["ERROR", "EXPIRED"].includes(lastStatus)) {
      throw new Error(`Instagram 영상 처리 실패 (${lastStatus})`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error(`Instagram 영상 처리가 제한 시간 안에 끝나지 않았습니다. 마지막 상태: ${lastStatus}`);
}

export async function publishInstagramReel(options: {
  videoUrl: string;
  caption: string;
}) {
  const { accessToken, accountId } = env();
  const createUrl = `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${accountId}/media`;
  const created = await graphJson(createUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({
      media_type: "REELS",
      video_url: options.videoUrl,
      caption: options.caption.slice(0, 2200),
      share_to_feed: "true",
      access_token: accessToken,
    }),
  });
  const creationId = String(created?.id || "");
  if (!creationId) throw new Error("Instagram 릴스 컨테이너 ID를 받지 못했습니다.");

  await waitForContainer(creationId, accessToken);

  const publishUrl = `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${accountId}/media_publish`;
  const published = await graphJson(publishUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody({ creation_id: creationId, access_token: accessToken }),
  });
  const mediaId = String(published?.id || "");
  if (!mediaId) throw new Error("Instagram 게시물 ID를 받지 못했습니다.");

  const detailUrl = new URL(`https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${mediaId}`);
  detailUrl.searchParams.set("fields", "id,permalink");
  detailUrl.searchParams.set("access_token", accessToken);
  const detail = await graphJson(detailUrl.toString()).catch(() => ({}));
  return {
    mediaId,
    url: String(detail?.permalink || `https://www.instagram.com/${process.env.INSTAGRAM_USERNAME || "irisxue91"}/`),
  };
}

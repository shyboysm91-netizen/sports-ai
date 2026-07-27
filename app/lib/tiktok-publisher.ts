const API_BASE = "https://open.tiktokapis.com";

type CreatorInfo = {
  creator_username?: string;
  creator_nickname?: string;
  privacy_level_options?: string[];
  comment_disabled?: boolean;
  duet_disabled?: boolean;
  stitch_disabled?: boolean;
  max_video_post_duration_sec?: number;
};

function accessToken() {
  const token = process.env.TIKTOK_ACCESS_TOKEN;
  if (!token) throw new Error("TIKTOK_ACCESS_TOKEN이 필요합니다.");
  return token;
}

async function tiktokJson(path: string, token: string, body?: object) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await response.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  const code = json?.error?.code;
  if (!response.ok || (code && code !== "ok")) {
    throw new Error(json?.error?.message || json?.error_description || text || `TikTok API 오류 (${response.status})`);
  }
  return json;
}

async function queryCreatorInfo(token: string): Promise<CreatorInfo> {
  const result = await tiktokJson("/v2/post/publish/creator_info/query/", token);
  return result?.data || {};
}

function choosePrivacy(options: string[]) {
  const requested = process.env.TIKTOK_PRIVACY_LEVEL || "PUBLIC_TO_EVERYONE";
  if (options.includes(requested)) return requested;
  if (options.includes("SELF_ONLY")) return "SELF_ONLY";
  return options[0] || "SELF_ONLY";
}

async function waitForStatus(token: string, publishId: string) {
  const deadline = Date.now() + 180_000;
  let lastStatus = "PROCESSING_UPLOAD";
  while (Date.now() < deadline) {
    const result = await tiktokJson("/v2/post/publish/status/fetch/", token, { publish_id: publishId });
    const data = result?.data || {};
    lastStatus = String(data?.status || "PROCESSING_UPLOAD");
    if (["PUBLISH_COMPLETE", "SEND_TO_USER_INBOX"].includes(lastStatus)) {
      return { status: lastStatus, publicPostId: String(data?.publicaly_available_post_id?.[0] || data?.public_post_id || "") };
    }
    if (["FAILED", "PUBLISH_FAILED"].includes(lastStatus)) {
      throw new Error(`TikTok 게시 처리 실패: ${data?.fail_reason || lastStatus}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  return { status: lastStatus, publicPostId: "" };
}

export async function publishTikTokVideo(options: {
  video: Buffer;
  caption: string;
}) {
  const token = accessToken();
  const creator = await queryCreatorInfo(token);
  const privacyOptions = Array.isArray(creator.privacy_level_options) ? creator.privacy_level_options : [];
  const privacyLevel = choosePrivacy(privacyOptions);
  const size = options.video.length;
  if (!size) throw new Error("TikTok에 올릴 영상이 비어 있습니다.");

  const initialized = await tiktokJson("/v2/post/publish/video/init/", token, {
    post_info: {
      title: options.caption.slice(0, 2200),
      privacy_level: privacyLevel,
      disable_duet: Boolean(creator.duet_disabled),
      disable_comment: Boolean(creator.comment_disabled),
      disable_stitch: Boolean(creator.stitch_disabled),
      video_cover_timestamp_ms: 1000,
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: size,
      chunk_size: size,
      total_chunk_count: 1,
    },
  });

  const publishId = String(initialized?.data?.publish_id || "");
  const uploadUrl = String(initialized?.data?.upload_url || "");
  if (!publishId || !uploadUrl) throw new Error("TikTok 업로드 주소를 받지 못했습니다.");

  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: new Uint8Array(options.video),
  });
  if (!uploaded.ok) throw new Error(`TikTok 영상 전송 실패 (${uploaded.status}): ${await uploaded.text()}`);

  const status = await waitForStatus(token, publishId);
  return {
    publishId,
    status: status.status,
    postId: status.publicPostId,
    privacyLevel,
    username: creator.creator_username || "",
    url: status.publicPostId ? `https://www.tiktok.com/@${creator.creator_username || "me"}/video/${status.publicPostId}` : "",
  };
}

import { getValidTikTokToken, TikTokTokenData } from "@/app/lib/tiktok-oauth";

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

async function uploadBytes(uploadUrl: string, video: Buffer) {
  const size = video.length;
  const uploaded = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Range": `bytes 0-${size - 1}/${size}`,
    },
    body: new Uint8Array(video),
  });
  if (!uploaded.ok) throw new Error(`TikTok 영상 전송 실패 (${uploaded.status}): ${await uploaded.text()}`);
}

function hasScope(token: TikTokTokenData, scope: string) {
  return String(token.scope || "").split(",").map((value) => value.trim()).includes(scope);
}

export async function publishTikTokVideo(options: { video: Buffer; caption: string }) {
  const tokenData = await getValidTikTokToken();
  if (!tokenData) throw new Error("서버에 저장된 TikTok 연결 정보가 없습니다. 콘텐츠 화면에서 TikTok 계정을 연결해 주세요.");
  const token = tokenData.access_token;
  const size = options.video.length;
  if (!size) throw new Error("TikTok에 올릴 영상이 비어 있습니다.");

  // Direct Post(video.publish)가 승인된 앱이면 바로 게시합니다.
  if (hasScope(tokenData, "video.publish")) {
    const creator = await queryCreatorInfo(token);
    const privacyOptions = Array.isArray(creator.privacy_level_options) ? creator.privacy_level_options : [];
    const privacyLevel = choosePrivacy(privacyOptions);
    const initialized = await tiktokJson("/v2/post/publish/video/init/", token, {
      post_info: {
        title: options.caption.slice(0, 2200),
        privacy_level: privacyLevel,
        disable_duet: Boolean(creator.duet_disabled),
        disable_comment: Boolean(creator.comment_disabled),
        disable_stitch: Boolean(creator.stitch_disabled),
        video_cover_timestamp_ms: 1000,
      },
      source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
    });
    const publishId = String(initialized?.data?.publish_id || "");
    const uploadUrl = String(initialized?.data?.upload_url || "");
    if (!publishId || !uploadUrl) throw new Error("TikTok 업로드 주소를 받지 못했습니다.");
    await uploadBytes(uploadUrl, options.video);
    const status = await waitForStatus(token, publishId);
    return {
      publishId,
      status: status.status,
      postId: status.publicPostId,
      privacyLevel,
      username: creator.creator_username || "",
      mode: "direct" as const,
      url: status.publicPostId ? `https://www.tiktok.com/@${creator.creator_username || "me"}/video/${status.publicPostId}` : "",
    };
  }

  // 현재 승인된 video.upload 권한이면 TikTok 받은편지함에 초안으로 전송합니다.
  if (!hasScope(tokenData, "video.upload")) {
    throw new Error("TikTok 토큰에 video.upload 또는 video.publish 권한이 없습니다. TikTok 계정을 다시 연결해 주세요.");
  }
  const initialized = await tiktokJson("/v2/post/publish/inbox/video/init/", token, {
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
  });
  const publishId = String(initialized?.data?.publish_id || "");
  const uploadUrl = String(initialized?.data?.upload_url || "");
  if (!publishId || !uploadUrl) throw new Error("TikTok 초안 업로드 주소를 받지 못했습니다.");
  await uploadBytes(uploadUrl, options.video);
  const status = await waitForStatus(token, publishId);
  return {
    publishId,
    status: status.status,
    postId: "",
    privacyLevel: "TIKTOK_INBOX",
    username: "",
    mode: "draft" as const,
    url: "",
  };
}

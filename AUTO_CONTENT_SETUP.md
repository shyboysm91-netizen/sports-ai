# Sports AI 완전 자동 릴스 설정

## Vercel 환경변수

- `AUTO_CONTENT_SECRET`: 임의의 긴 비밀번호
- `AUTO_CONTENT_MAX_PER_RUN`: 1 권장
- 기존 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CONTENT_APPROVAL_SECRET`, `NEXT_PUBLIC_SITE_URL`
- 음성을 사용하려면 `GOOGLE_TTS_API_KEY`
- Supabase 캐시용 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## 매시간 실행

Vercel Hobby Cron은 하루 1회만 허용되므로 Supabase Dashboard의 **Integrations → Cron → Create job**에서 HTTP Request를 사용합니다.

- Method: POST
- URL: `https://sports-ai-alpha.vercel.app/api/cron/content-auto`
- Header: `Authorization: Bearer AUTO_CONTENT_SECRET값`
- Schedule: `0 * * * *`

매시간 확인하지만 같은 경기는 `sports_cache`에 기록하여 다시 만들지 않습니다. 새 경기가 있을 때만 텔레그램으로 영상과 승인 버튼이 옵니다.

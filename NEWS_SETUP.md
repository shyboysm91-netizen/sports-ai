# 장군분석 스포츠 뉴스 설정

## 1. Supabase

Supabase SQL Editor에서 `supabase-news-schema.sql`을 한 번 실행합니다. 기존 테이블은 수정하거나 삭제하지 않습니다.

## 2. Vercel 환경변수

- `OPENAI_API_KEY`: 뉴스 재작성에 사용하는 OpenAI API 키
- `NEWS_OPENAI_MODEL`: 기본값 `gpt-5-mini`
- `NEWS_ADMIN_SECRET`: `/admin-news` 관리자 전용 비밀키
- `NEWS_IMAGE_GENERATION=true`: 기사별 AI 대표 이미지 자동 생성
- `CRON_SECRET`: Vercel Cron 인증값(기존 값 유지)
- `SUPABASE_URL`: 기존 Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: 기존 서버 전용 서비스 역할 키
- `NEXT_PUBLIC_SITE_URL`: `https://장군분석.kr`

서비스 역할 키와 관리자 비밀키는 `NEXT_PUBLIC_` 접두사를 붙이지 않습니다.

## 3. 자동 게시 시간

`vercel.json`은 한국시간 07:30에 `/api/cron/news`를 한 번 호출합니다. 중복이 아닌 중요한 기사 최대 7개를 미리 생성하고, `published_at`을 이용해 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 21:00에 한 개씩 자동 공개합니다. 중요한 후보가 부족하면 억지로 7개를 채우지 않습니다.

## 4. 관리자

`/admin-news`에서 `NEWS_ADMIN_SECRET`을 입력하면 목록, 미리보기, 제목·요약 수정, 발행, 비공개, 삭제, 초안 수동 생성, 자동 생성 ON/OFF를 사용할 수 있습니다.

## 5. 배포 전 점검

1. SQL 실행
2. Vercel 환경변수 등록
3. `/admin-news`에서 초안 1개 수동 생성
4. 출처와 사실관계를 검토한 뒤 발행
5. `/news`, `/news/rss.xml`, `/news-sitemap.xml` 확인

AI 대표 이미지는 가상의 인물과 일반 경기장 장면으로 생성하며 실제 선수 얼굴, 구단 로고, 언론사 사진을 복제하지 않습니다. 생성 이미지는 Supabase Storage의 공개 `news-images` 버킷에 저장됩니다.

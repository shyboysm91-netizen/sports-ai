# TikTok 자동 발행 설정

코드는 텔레그램 승인 후 YouTube, Instagram, TikTok을 함께 발행하도록 연결되어 있습니다.
기존 KBO/MLB/NPB 경기 분석 파일과 계산 로직은 수정하지 않았습니다.

## Vercel 환경변수

- `TIKTOK_ACCESS_TOKEN`: TikTok OAuth로 발급받은 사용자 access token
- `TIKTOK_PRIVACY_LEVEL`: 기본값 `PUBLIC_TO_EVERYONE`
  - 앱 심사 전에는 TikTok 정책상 실제 게시물이 `SELF_ONLY`로 제한될 수 있습니다.

## TikTok 개발자 설정

1. TikTok for Developers에서 앱을 생성합니다.
2. Login Kit와 Content Posting API를 추가합니다.
3. Direct Post를 활성화합니다.
4. `video.publish` scope 승인을 신청합니다.
5. 본인 TikTok 계정으로 앱을 승인해 access token을 발급받습니다.
6. 해당 token을 Vercel의 `TIKTOK_ACCESS_TOKEN`에 저장하고 재배포합니다.

## 작동 방식

텔레그램의 발행 승인 버튼을 누르면 같은 MP4 파일을 TikTok Content Posting API의 FILE_UPLOAD 방식으로 전송합니다.
TikTok 앱이 아직 audit를 통과하지 않았다면 게시물 공개 범위는 비공개로 제한될 수 있습니다.

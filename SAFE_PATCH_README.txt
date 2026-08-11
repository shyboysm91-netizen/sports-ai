장군 AI 안전 수정 패치 v1

기존 프로젝트 전체를 덮어쓰는 압축이 아닙니다.
아래 네 파일만 추가 또는 교체합니다.

1. app/game/GameClient.tsx
   - 선발 비교 문장과 AI 점수에서 같은 상대전적 ERA 기준을 사용
   - 최근 흐름 비교 시 단순 승수 대신 승/패 기준 승률 사용

2. app/results/page.tsx
   - 기존 Supabase 예측 기록을 읽어 실제 적중 결과를 공개하는 새 페이지

3. app/page.tsx
   - 푸터에 예측 결과 링크만 추가

4. app/sitemap-main.xml/route.ts
   - 새 /results 페이지만 사이트맵에 추가

수정하지 않은 항목
- 기존 API
- 자동 콘텐츠 및 업로드
- 텔레그램, 유튜브, 틱톡 연동
- 광고 설정
- 환경변수
- Supabase 스키마
- 기존 경기 분석 화면 구조

검증
- 수정 전 npm run build 성공
- 수정 후 npm run build 성공
- 원본 app.zip과 해시 비교 결과 위 네 파일 외 변경 없음

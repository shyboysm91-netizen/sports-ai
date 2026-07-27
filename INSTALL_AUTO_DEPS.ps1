Write-Host "Sports AI 자동 릴스 패키지를 설치합니다..."
npm install ffmpeg-static@5.2.0 sharp@0.34.3
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "설치 완료. 이제 npx vercel --prod 를 실행하세요."

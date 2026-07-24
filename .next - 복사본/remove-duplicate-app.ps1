$ErrorActionPreference = "Stop"

$project = Get-Location
$nestedApp = Join-Path $project "app\app"

if (-not (Test-Path (Join-Path $project "package.json"))) {
    Write-Host "오류: sports-ai 프로젝트 폴더에서 실행해야 합니다." -ForegroundColor Red
    exit 1
}

if (Test-Path $nestedApp) {
    Write-Host "중복 폴더 삭제 중: app\app" -ForegroundColor Yellow
    Remove-Item $nestedApp -Recurse -Force
} else {
    Write-Host "app\app 중복 폴더가 이미 없습니다." -ForegroundColor Cyan
}

# 이전 일회성 수정 스크립트 정리
Get-ChildItem $project -Filter "fix-*.ps1" -File -ErrorAction SilentlyContinue |
    Remove-Item -Force -ErrorAction SilentlyContinue

# Next 빌드 캐시 제거
$nextDir = Join-Path $project ".next"
if (Test-Path $nextDir) {
    Remove-Item $nextDir -Recurse -Force
}

Write-Host "중복 구조 제거 완료. 전체 빌드를 확인합니다..." -ForegroundColor Green
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "빌드가 아직 실패했습니다. 이제부터는 마지막 오류 1개만 보내주세요." -ForegroundColor Yellow
    exit $LASTEXITCODE
}

git add -A
git commit -m "Remove duplicated nested app folder"

if ($LASTEXITCODE -ne 0) {
    Write-Host "커밋할 변경 사항이 없을 수 있습니다." -ForegroundColor Yellow
}

git push

if ($LASTEXITCODE -ne 0) {
    Write-Host "git push 실패. 터미널 화면을 보내주세요." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "완료: 중복 app 폴더 제거, 빌드 성공, GitHub 반영 완료" -ForegroundColor Green

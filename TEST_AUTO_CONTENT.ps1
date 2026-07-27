$secret = Read-Host "Vercel AUTO_CONTENT_SECRET 값을 입력하세요"
$url = "https://sports-ai-alpha.vercel.app/api/cron/content-auto"
Invoke-RestMethod -Method Post -Uri $url -Headers @{ Authorization = "Bearer $secret" }

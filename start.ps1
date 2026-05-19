# Node.js 설치 확인
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "Node.js가 설치되어 있지 않습니다."
  Write-Host "https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해주세요."
  Write-Host ""
  exit 1
}

Write-Host "패키지를 설치합니다..."
npm install

Write-Host ""
Write-Host "서버를 시작합니다..."
Write-Host "브라우저에서 http://localhost:3000 을 열어주세요."
Write-Host "(종료하려면 Ctrl+C 를 누르세요)"
Write-Host ""
npm run dev

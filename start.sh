#!/bin/bash
set -e

# Node.js 설치 확인
if ! command -v node &> /dev/null; then
  echo ""
  echo "Node.js가 설치되어 있지 않습니다."
  echo "https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행해주세요."
  echo ""
  exit 1
fi

echo "패키지를 설치합니다..."
npm install

echo ""
echo "서버를 시작합니다..."
echo "브라우저에서 http://localhost:3000 을 열어주세요."
echo "(종료하려면 Ctrl+C 를 누르세요)"
echo ""
npm run dev

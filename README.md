# 상품 등록 도구

모델명으로 **다나와**·**빌리고** 두 사이트에서 제품 스펙과 이미지를 동시에 수집하는 내부 도구입니다.

## 주요 기능

- 모델명 검색 → 다나와 / 빌리고 병렬 크롤링
- 스펙 테이블 표시 및 JSON 다운로드
- 이미지 선택 후 ZIP 다운로드
- 빌리고 렌탈사별 월 렌탈료 비교표

## 기술 스택

- Next.js 15 (App Router) + TypeScript
- Playwright (서버사이드 크롤링)
- Tailwind CSS + shadcn/ui

## 로컬 실행

```bash
# 의존성 설치
npm install

# Chromium 설치 (최초 1회)
npx playwright install chromium --with-deps

# 개발 서버 실행
npm run dev
```

http://localhost:3000 접속

## 크롤링 대상

| 사이트 | 수집 데이터 |
|--------|------------|
| 다나와 | 스펙, 썸네일/슬라이드/상세 이미지 |
| 빌리고 | 스펙, 렌탈사별 가격표, 썸네일/상세 이미지 |

## 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                    # 메인 UI
│   ├── api/crawl/route.ts          # 크롤링 API
│   ├── api/download/images/        # 이미지 ZIP 다운로드 API
│   └── components/                 # UI 컴포넌트
└── lib/crawlers/
    ├── danawa.ts                   # 다나와 크롤러
    └── biligo.ts                   # 빌리고 크롤러
```

## 배포

마켓플레이스 배포 시 `rentre.config.json` 참조.  
빌드 단계에서 Playwright Chromium이 자동 설치됩니다.

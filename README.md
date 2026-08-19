# 상품 등록 도구

모델명으로 **다나와**·**빌리고** 두 사이트에서 제품 스펙과 이미지를 동시에 수집하는 내부 도구입니다.

## 주요 기능

- 모델명 검색 → 다나와 / 빌리고 병렬 크롤링 (각 30초 타임아웃, 한쪽 실패 무관)
- 스펙 테이블 표시 및 JSON 다운로드 (클라이언트 사이드)
- 이미지 선택 후 ZIP 다운로드 (서버 프록시)
- 빌리고 렌탈사·계약기간별 월 렌탈료 / 카드할인가 비교표
- 빌리고 상품 태그 표시

## 기술 스택

- Next.js 16 (App Router) + React 19 + TypeScript
- 크롤링: `fetch` + `cheerio` (서버사이드, 브라우저 없음)
- ZIP: JSZip
- UI: Tailwind CSS 4 + shadcn/ui + Sonner

## 로컬 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

http://localhost:3000 접속

> 별도의 브라우저 설치 단계는 필요하지 않습니다. (Playwright 의존성 제거됨)

## 크롤링 대상

| 사이트 | 진입 경로 | 수집 데이터 |
|--------|----------|------------|
| 다나와 | `search.danawa.com` 검색 → `prod.danawa.com` 상세 → 스펙 AJAX | 상품명, 스펙 테이블, 썸네일/상세 이미지 |
| 빌리고 | `xn--299ar6vqrd.com` 검색 API → 상세 HTML | 상품명, 스펙, 렌탈사별 가격표, 태그, 이미지 |

## 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # 메인 검색 UI
│   ├── api/
│   │   ├── crawl/route.ts          # POST — 다나와 + 빌리고 병렬 크롤
│   │   └── download/images/route.ts # POST — 이미지 URL → ZIP
│   └── components/
│       ├── SearchForm.tsx
│       ├── SourceCard.tsx
│       ├── SpecTable.tsx
│       ├── ImageGrid.tsx
│       ├── RentalTable.tsx         # 빌리고 렌탈가 비교
│       └── DownloadBar.tsx
├── components/ui/                  # shadcn/ui 컴포넌트
└── lib/
    ├── utils.ts
    └── crawlers/
        ├── types.ts
        ├── danawa.ts               # cheerio 기반
        └── biligo.ts               # cheerio + JSON API
```

## 배포

마켓플레이스 배포 시 `rentre.config.json` 참조.
빌드 산출물은 `output: 'standalone'`으로 생성되며 `node .next/standalone/server.js`로 기동합니다.

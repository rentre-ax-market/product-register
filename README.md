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
│   └── public/product-register/    # 마켓 SSO 면제 존 (/proxy/{slug}/public/...)
│       ├── page.tsx                # 메인 검색 UI
│       ├── api/
│       │   ├── crawl/route.ts          # POST — 다나와 + 빌리고 병렬 크롤
│       │   └── download/images/route.ts # POST — 이미지 URL → ZIP
│       └── components/
│           ├── SearchForm.tsx
│           ├── SourceCard.tsx
│           ├── SpecTable.tsx
│           ├── ImageGrid.tsx
│           ├── RentalTable.tsx     # 빌리고 렌탈가 비교
│           └── DownloadBar.tsx
├── components/ui/                  # shadcn/ui 컴포넌트
└── lib/
    ├── utils.ts
    ├── apiKey.ts                   # x-api-key 검증 (timingSafeEqual)
    └── crawlers/
        ├── types.ts
        ├── danawa.ts               # cheerio 기반
        └── biligo.ts               # cheerio + JSON API
```

## 마켓 SSO 면제 (/public)

이 앱은 마켓 SSO 없이 접근해야 하는 요구로 전체 UI/API를 `app/public/product-register/` 아래로 배치했습니다.
SSO 면제는 slug가 아니라 `/proxy/{slug}/public/...` 경로 단위로 적용되기 때문입니다.

`/public` 하위는 마켓 SSO만 면제될 뿐 인터넷에 그대로 노출되므로, 두 API 라우트(`crawl`, `download/images`)는
`x-api-key` 헤더 + `crypto.timingSafeEqual` 상수시간 비교로 자체 인증을 강제합니다 (`src/lib/apiKey.ts`).

**필수 환경변수** (마켓 `/submit` 등록 폼에 입력):

| 변수 | 설명 |
|------|------|
| `NEXT_PUBLIC_PRODUCT_REGISTER_API_KEY` | 클라이언트(`x-api-key` 헤더 전송)와 서버(검증) 양쪽에서 쓰는 공유 키. 미설정 시 API가 500을 반환합니다. |

> `NEXT_PUBLIC_` 접두사라 클라이언트 번들에 포함됩니다 — 이 키는 봇/스캐너의 무단 호출을 막는 최소 게이트(simple key)이지,
> 페이지를 직접 여는 사용자로부터 값을 숨기기 위한 것이 아닙니다.

## 배포

마켓플레이스 배포 시 `rentre.config.json` 참조.
빌드 산출물은 `output: 'standalone'`으로 생성되며 `node .next/standalone/server.js`로 기동합니다.
등록된 서비스이므로 `next.config.ts` / `package.json`은 이번 변경에서 건드리지 않았습니다(이미 basePath·standalone 설정 완료 상태).

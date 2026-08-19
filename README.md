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
│   ├── page.tsx                    # "/" → "/public" 리다이렉트
│   └── public/                     # 마켓 SSO 면제 구간 (/proxy/{slug}/public)
│       ├── page.tsx                # 메인 검색 UI
│       ├── api/
│       │   ├── crawl/route.ts          # POST — 다나와 + 빌리고 병렬 크롤
│       │   └── download/images/route.ts # POST — 이미지 URL → ZIP (호스트 allowlist 적용)
│       └── components/
│           ├── SearchForm.tsx
│           ├── SourceCard.tsx
│           ├── SpecTable.tsx
│           ├── ImageGrid.tsx
│           ├── RentalTable.tsx     # 빌리고 렌탈가 비교
│           └── DownloadBar.tsx
├── components/ui/                  # shadcn/ui 컴포넌트
├── proxy.ts                        # /public/api/** 전체에 X-Api-Key 검증 (Next.js Proxy, 구 middleware)
└── lib/
    ├── utils.ts
    ├── client-headers.ts           # 클라이언트: X-Api-Key 헤더 생성
    └── crawlers/
        ├── types.ts
        ├── danawa.ts               # cheerio 기반
        └── biligo.ts               # cheerio + JSON API
```

## 환경변수

| 이름 | 용도 |
|------|------|
| `API_KEY` | `src/proxy.ts`가 `/public/api/**` 요청 헤더 `X-Api-Key`와 대조하는 서버 측 키 |
| `NEXT_PUBLIC_API_KEY` | 프론트엔드가 같은 값을 `X-Api-Key`로 보내기 위해 빌드에 내장하는 값 (반드시 `API_KEY`와 동일하게 설정) |

⚠️ `NEXT_PUBLIC_*` 값은 브라우저에 내려가는 JS 번들에 그대로 노출됩니다. 이 키는
무차별 스캐너/봇을 걸러내는 최소 문턱일 뿐, 페이지 소스를 열어보는 사용자까지 막지는 못합니다.

마켓플레이스 `/submit` 등록 시 위 두 값을 envVars 폼에 입력하세요.

`/api/download/images`는 클라이언트가 넘긴 URL을 서버에서 그대로 `fetch`하므로(SSRF 위험),
호스트가 `danawa.com`/`xn--299ar6vqrd.com`(빌리고)/`biligo.co.kr` 및 그 서브도메인이 아니면 조용히 건너뜁니다.

## 배포

마켓플레이스 배포 시 `rentre.config.json` 참조.
빌드 산출물은 `output: 'standalone'`으로 생성되며 `node .next/standalone/server.js`로 기동합니다.
`/proxy/{slug}/public` 하위는 마켓 SSO가 면제되어 외부 인터넷에 노출됩니다 — API 인증은 위 환경변수로 처리됩니다.

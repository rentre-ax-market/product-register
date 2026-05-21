# product-register 개발 가이드라인

## 프로젝트 개요

모델명을 검색하면 **다나와 / 빌리고** 두 사이트에서 제품 스펙과 이미지를 크롤링해 보여주고, JSON(스펙)과 ZIP(이미지)으로 다운로드할 수 있는 내부 도구용 웹앱.

빌리고에서는 렌탈사·계약기간별 월 렌탈료 비교표와 상품 태그도 함께 수집한다.

---

## 기술 스택

| 역할 | 선택 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| 런타임 | React 19 |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS 4 + shadcn/ui |
| HTTP / 파싱 | `fetch` (Node) + `cheerio` |
| ZIP 생성 | JSZip |
| 아이콘 | Lucide React |
| 토스트 | Sonner |

> 이전에 사용하던 Playwright(Chromium)는 제거되었다. 두 사이트 모두 SSR/JSON으로 데이터를 받아올 수 있어 헤드리스 브라우저가 필요 없다.

---

## 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # 메인 검색 UI (상태 허브)
│   ├── globals.css
│   ├── api/
│   │   ├── crawl/
│   │   │   └── route.ts                # POST — 다나와 + 빌리고 병렬 크롤
│   │   └── download/
│   │       └── images/
│   │           └── route.ts            # POST — 이미지 URL → ZIP
│   └── components/
│       ├── SearchForm.tsx              # 모델명 입력 + 검색 버튼
│       ├── SourceCard.tsx              # 사이트별 결과 카드 (스펙+이미지+렌탈)
│       ├── SpecTable.tsx               # Record<string,string> → 테이블
│       ├── ImageGrid.tsx               # 이미지 목록 + 체크박스 선택
│       ├── RentalTable.tsx             # 빌리고 렌탈사별 가격 비교표
│       └── DownloadBar.tsx             # JSON / ZIP 다운로드 버튼
├── components/ui/                      # shadcn/ui (button, card, input, badge, skeleton)
└── lib/
    ├── utils.ts
    └── crawlers/
        ├── types.ts                    # 공통 타입
        ├── danawa.ts                   # 다나와 크롤러 (cheerio)
        └── biligo.ts                   # 빌리고 크롤러 (cheerio + JSON API)
```

> 경로 alias는 `@/*` → `src/*`. 크롤러는 `@/lib/crawlers/...`로 import 한다.

---

## 공통 타입 (`src/lib/crawlers/types.ts`)

```ts
export interface RentalRow {
  company: string    // 렌탈사 이름
  period: string     // 계약기간 (60개월, 48개월, 36개월 등)
  price: string      // 월 렌탈료 ("39,900원")
  cardPrice: string  // 카드 할인가 (없으면 "-")
}

export interface CrawlResult {
  source: 'danawa' | 'biligo'
  productName: string
  specs: Record<string, string>
  images: string[]                 // 절대 URL 배열
  productUrl: string               // 크롤한 상세 페이지 URL
  rentalPrices?: RentalRow[]       // 빌리고 전용
  tags?: string[]                  // 빌리고 전용 (#태그)
}

export interface CrawlResponse {
  danawa: CrawlResult | { error: string }
  biligo: CrawlResult | { error: string }
}

export function isCrawlResult(
  v: CrawlResult | { error: string }
): v is CrawlResult {
  return !('error' in v)
}
```

---

## API Routes

### `POST /api/crawl`

**요청**
```json
{ "model": "LG OLED65C3KNA" }
```

**처리 흐름**
```
Promise.allSettled([
  withTimeout(crawlDanawa(model)),
  withTimeout(crawlBiligo(model)),
])  // 각 30초 타임아웃, 한쪽 실패해도 나머지 반환
```

**응답** — `CrawlResponse`

### `POST /api/download/images`

**요청**
```json
{ "model": "LG OLED65C3KNA", "urls": ["https://...", "https://..."] }
```

**처리 흐름**
```
서버에서 각 URL fetch (Referer 헤더 포함)
→ JSZip에 danawa_01.jpg, biligo_01.jpg 형태로 추가
→ zip.generateAsync({ type: 'nodebuffer' })
→ Response(buffer, Content-Disposition: attachment; filename=모델명_images.zip)
```

> 클라이언트 다이렉트 다운로드 대신 서버 프록시를 쓰는 이유: 사이트 Referer 정책 및 CORS 제한 우회.

---

## 크롤러 구현

공통 원칙:

- **헤드리스 브라우저 없음.** `fetch` + `cheerio` 조합.
- User-Agent / Accept-Language / Referer 헤더는 실제 데스크톱 Chrome처럼 설정한다.
- 응답이 비정상이면 즉시 `throw` — 상위 API 라우트가 `Promise.allSettled`로 받는다.
- `data:` URL, `noImg` 자리표시 이미지, 에너지 효율 라벨 등은 이미지 수집에서 제외한다.
- 절대 URL 정규화: `//...` → `https:`, `/...` → 사이트 BASE 결합.

### 다나와 (`src/lib/crawlers/danawa.ts`)

```
1. GET https://search.danawa.com/dsearch.php?query={model}&tab=goods
2. cheerio.load → .prod_main_info 첫 번째 항목에서
   - a[href*="prod.danawa.com/info/?pcode="] → pcode 추출
   - .prod_name a / img[alt] 에서 상품명 후보 수집
   - img[src] 썸네일 수집
3. productUrl = https://prod.danawa.com/info/?pcode={pcode}
   GET → <title>에서 상품명 보강 (": 다나와 가격비교" 접미사 제거)
4. POST https://prod.danawa.com/info/ajax/getProductDescription.ajax.php
     body: pcode={pcode}
     headers: X-Requested-With: XMLHttpRequest, Referer: productUrl
   → .spec_tbl tr 의 th.tit / td.dsc 쌍을 specs로 변환
   → th[colspan="4"] (구분 헤더 행) 및 "인증" 키 제외
5. 이미지 추가: .detail_cont img, .detail_export img
6. specs/images 모두 비면 throw '스펙 없음'
```

### 빌리고 (`src/lib/crawlers/biligo.ts`)

> 빌리고는 한글 도메인(빌리고.com)의 punycode `xn--299ar6vqrd.com`을 사용한다.
> 검색은 JSON API, 상세는 SSR HTML이므로 둘 다 cheerio/JSON으로 처리 가능하다.

```
1. GET https://xn--299ar6vqrd.com/api/v2/models/search
     ?ss_tx={model}&filter_section=rental&section=models
   헤더: Accept: application/json, X-Requested-With: XMLHttpRequest, Referer: BASE
   → { Counts, Lists: [{ model, model_name, model_url, model_thumnail_url }] }
   → Counts === 0 또는 Lists 없음이면 throw '검색 결과 없음'
2. 첫 번째 Lists 항목의 model_url로 상세 HTML GET
3. cheerio.load 후:
   - 상품명: meta[property="og:title"] (파이프 뒤 텍스트 제거)
              fallback → h2.ff_NSR 중 "렌탈사 비교/상품 상세/상품 요약" 제외한 첫 텍스트
              fallback → API의 model_name
   - 스펙: .txtBox dl 의 dt/dd 쌍
     비어 있고 API에 model 값이 있으면 specs['모델명'] 만 채움
   - 이미지: og:image + .dtlImg_area / .ma_dtlImg_area / .gallery-big
            / .photo_slide / .big.slick-slide 의 img[src|data-src]
            (`/img/energy_img` 경로는 에너지효율 라벨이라 제외)
   - 렌탈가표: .compare_tbl ul > li 의
       .titNm h3 → company
       .compare_prc_check_box 반복 →
         .opt_name → period
         .option_prc dd em → price (+ "원")
         .option_card dd em → cardPrice (없으면 "-")
   - 태그: .prd_tag ul li span 텍스트(선행 # 제거)
4. rentalPrices / tags 는 비면 undefined로 둔다.
```

---

## 프론트엔드 상태 (`src/app/page.tsx`)

```ts
const [isLoading, setIsLoading] = useState(false)
const [query, setQuery] = useState('')
const [result, setResult] = useState<CrawlResponse | null>(null)
const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
```

검색 호출은 `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/crawl` 로 보낸다 — basePath 환경변수가 설정된 배포에서도 동작하도록.

로딩 중에는 두 칸짜리 skeleton 카드를 띄우고, 결과가 도착하면 `SourceCard × 2 + DownloadBar` 로 교체된다.

---

## 다운로드 흐름

### 스펙 JSON — 클라이언트 사이드
서버 왕복 없이 메모리의 데이터를 직접 Blob으로 만들어 `<a download>`를 트리거한다. 두 소스의 specs를 병합한 형태로 저장한다.

### 이미지 ZIP — 서버 사이드
선택된 이미지 URL을 `POST /api/download/images`로 보내고, 응답 blob을 `<a download>`로 트리거한다.

---

## `next.config.ts`

```ts
import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
}
export default nextConfig
```

- `basePath`: 마켓플레이스 등에서 서브패스 배포할 때 사용. 클라이언트의 fetch URL도 동일 prefix를 붙여야 한다.
- `output: 'standalone'`: 배포 산출물을 `.next/standalone/`에 자족형으로 생성. 기동 명령은 `node .next/standalone/server.js`.
- Playwright가 빠졌으므로 `serverExternalPackages` 설정은 더 이상 필요하지 않다.

---

## 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 페이지/컴포넌트 | PascalCase | `SearchForm.tsx`, `RentalTable.tsx` |
| 유틸 / 크롤러 모듈 | camelCase | `danawa.ts`, `biligo.ts` |
| 상수 | UPPER_SNAKE_CASE | `TIMEOUT_MS`, `BASE` |
| 타입 / 인터페이스 | PascalCase | `CrawlResult`, `RentalRow` |
| 이벤트 핸들러 | `handle` + 동사 | `handleSearch`, `handleToggleImage` |
| boolean | `is/has/show` 접두 | `isLoading`, `hasError` |

---

## 구현 순서 (참고)

1. `src/lib/crawlers/types.ts` — 타입부터 확정.
2. `danawa.ts` — 검색 → pcode → AJAX 스펙 흐름. 단독 호출로 specs 키 셋 확인.
3. `biligo.ts` — JSON 검색 API → 상세 HTML 파싱. DOM 셀렉터는 실제 페이지에서 확인 후 확정.
4. `POST /api/crawl` — 두 크롤러를 `Promise.allSettled` + 30s 타임아웃으로 묶기.
5. UI — `SearchForm` → `SourceCard`(`SpecTable` + `ImageGrid` + `RentalTable`) → `DownloadBar`.
6. `POST /api/download/images` — JSZip 스트리밍.
7. 실제 모델명(예: `LG OLED65C3KNA`) E2E 확인.

---

## 트러블슈팅 메모

- **빌리고 검색이 비는 경우** — API의 `filter_section=rental&section=models` 파라미터가 정확해야 결과가 잡힌다. `ss_tx`는 반드시 `encodeURIComponent`로 감싼다.
- **다나와 스펙이 비는 경우** — 일부 상품은 `getProductDescription.ajax.php` 응답에 `.spec_tbl`이 없고 가격 비교 행만 있는 경우가 있다. 이때는 별도 fallback 없이 `'스펙 없음'`을 던지고 UI에서 에러 카드로 표시한다.
- **이미지 ZIP 다운로드 실패** — 원본 호스트가 Referer를 강제하는 경우가 있으므로 서버 fetch 시 해당 사이트의 base URL을 Referer로 보낸다.
- **basePath 배포** — 클라이언트 `fetch('/api/...')`는 자동으로 basePath가 붙지 않으니, `process.env.NEXT_PUBLIC_BASE_PATH`를 직접 prepend 해야 한다.

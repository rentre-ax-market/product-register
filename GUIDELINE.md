# product-register 개발 가이드라인

## 프로젝트 개요

모델명을 검색하면 다나와 / 빌리고 두 사이트에서 제품 스펙과 이미지를 크롤링해 보여주고, JSON(스펙)과 ZIP(이미지)으로 다운로드할 수 있는 내부 도구용 웹앱.

---

## 기술 스택

| 역할 | 선택 |
|------|------|
| 프레임워크 | Next.js 15 (App Router) |
| 언어 | TypeScript (strict) |
| 스타일 | Tailwind CSS 4 + shadcn/ui |
| 크롤링 | Playwright (chromium) |
| ZIP 생성 | JSZip |
| 아이콘 | Lucide React |
| 토스트 | Sonner |

---

## 디렉토리 구조

```
src/
└── app/
    ├── layout.tsx
    ├── page.tsx                        # 메인 검색 UI (상태 관리 허브)
    ├── api/
    │   ├── crawl/
    │   │   └── route.ts                # POST — 다나와 + 빌리고 병렬 크롤링
    │   └── download/
    │       └── images/
    │           └── route.ts            # POST — 이미지 URL → ZIP 스트림
    └── components/
        ├── SearchForm.tsx              # 모델명 입력 + 검색 버튼
        ├── ResultPanel.tsx             # 두 소스 결과 좌/우 나열
        ├── SourceCard.tsx              # 사이트별 결과 카드 (스펙 + 이미지)
        ├── SpecTable.tsx               # Record<string, string> → 테이블
        ├── ImageGrid.tsx               # 이미지 목록 + 체크박스 선택
        └── DownloadBar.tsx             # JSON / ZIP 다운로드 버튼

lib/
└── crawlers/
    ├── types.ts                        # 공통 타입 정의
    ├── danawa.ts                       # 다나와 크롤러
    └── biligo.ts                       # 빌리고 크롤러
```

---

## 공통 타입 (`lib/crawlers/types.ts`)

```ts
export interface CrawlResult {
  source: 'danawa' | 'biligo'
  productName: string
  specs: Record<string, string>   // { "제조사": "삼성", "크기": "65인치", ... }
  images: string[]                // 절대 URL 배열
  productUrl: string              // 크롤링한 상세 페이지 URL
}

export interface CrawlResponse {
  danawa: CrawlResult | { error: string }
  biligo:  CrawlResult | { error: string }
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
Promise.allSettled([crawlDanawa(model), crawlBiligo(model)])
  → 각 30초 타임아웃
  → 한 쪽 실패해도 나머지 결과 반환
```

**응답**
```json
{
  "danawa": {
    "source": "danawa",
    "productName": "...",
    "specs": { "화면 크기": "65인치", ... },
    "images": ["https://img.danawa.com/..."],
    "productUrl": "https://prod.danawa.com/info/?pcode=12345"
  },
  "biligo": { "error": "검색 결과 없음" }
}
```

### `POST /api/download/images`

**요청**
```json
{ "model": "LG OLED65C3KNA", "urls": ["https://...", "https://..."] }
```

**처리 흐름**
```
서버에서 각 URL fetch (Referer 헤더 포함)
→ JSZip에 danawa_01.jpg, biligo_01.jpg 형식으로 추가
→ zip.generateAsync({ type: 'nodebuffer' })
→ Response(buffer, Content-Disposition: attachment; filename=모델명_images.zip)
```

> 이미지 다이렉트 다운로드 대신 서버 프록시를 쓰는 이유: 사이트 Referer 정책 및 CORS 제한 우회

---

## 크롤러 구현

### 다나와 (`lib/crawlers/danawa.ts`)

기존 `sangjo/scripts/crawl-specs.ts` 로직을 함수로 추출한 버전.

```
1. chromium.launch({ headless: true })
2. userAgent: Chrome 120 Mac 설정
3. page.goto(`https://search.danawa.com/dsearch.php?query=${model}&tab=goods`)
   waitUntil: 'domcontentloaded', timeout: 15_000
4. 1.5초 대기 (JS 렌더링)
5. pcode 추출
   → .prod_main_info a[href*="pcode="] 에서 정규식 /pcode=(\d+)/ 매칭
6. page.goto(`https://prod.danawa.com/info/?pcode=${pcode}`)
   2초 대기
7. 스펙 파싱
   → .spec_tbl tr → th(key) + td(value)
   → "인증" 항목, "상세 스펙 비교" 값 제외
8. 이미지 수집
   → .thumb_image img[src]       (대표 썸네일)
   → .photo_slide img[src]       (슬라이드)
   → .detail_cont img[src]       (상세 이미지)
9. browser.close()
```

**rate limit**: 요청 간 1초 대기 (`waitForTimeout(1000)`)

### 빌리고 (`lib/crawlers/biligo.ts`)

> DOM 셀렉터는 첫 실행 시 `page.content()` 로그로 확인 후 확정 필요.

```
1. chromium.launch({ headless: true })
2. page.goto(`https://biligo.co.kr/search?q=${model}`)
3. 첫 번째 제품 링크 추출 → 상세 페이지 이동
4. 스펙 파싱 (dl/dt/dd 또는 테이블 구조 — 실제 DOM 확인 필요)
5. 이미지 수집 (메인 이미지 + 갤러리)
6. browser.close()
```

---

## 프론트엔드 상태 구조 (`page.tsx`)

```ts
const [query, setQuery] = useState('')
const [isLoading, setIsLoading] = useState(false)
const [result, setResult] = useState<CrawlResponse | null>(null)
const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
```

---

## 다운로드 흐름

### 스펙 JSON — 클라이언트 사이드

서버 왕복 없이 메모리의 데이터를 직접 처리:

```ts
const blob = new Blob([JSON.stringify(mergedSpecs, null, 2)], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = `${model}_specs.json`
a.click()
URL.revokeObjectURL(url)
```

### 이미지 ZIP — 서버 사이드

```ts
// 클라이언트
const res = await fetch('/api/download/images', {
  method: 'POST',
  body: JSON.stringify({ model, urls: [...selectedImages] })
})
const blob = await res.blob()
// → <a download> 트리거
```

---

## next.config.ts 필수 설정

```ts
const nextConfig = {
  serverExternalPackages: ['playwright'],  // Next.js 15
}
```

---

## 네이밍 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 페이지/컴포넌트 | PascalCase | `SearchForm.tsx`, `SpecTable.tsx` |
| 유틸리티/크롤러 | camelCase | `danawa.ts`, `biligo.ts` |
| 상수 | UPPER_SNAKE_CASE | `CRAWL_TIMEOUT_MS` |
| 타입/인터페이스 | PascalCase | `CrawlResult`, `CrawlResponse` |
| 이벤트 핸들러 | handle + 동사 | `handleSearch`, `handleDownload` |
| boolean | is/has/show 접두어 | `isLoading`, `hasError` |

---

## 구현 순서 (권장)

1. `create-next-app` 셋업 + shadcn/ui 초기화
2. `lib/crawlers/types.ts` 타입 정의
3. `lib/crawlers/danawa.ts` 구현 + 단독 실행 테스트 (`npx tsx`)
4. `lib/crawlers/biligo.ts` — 빌리고 DOM 탐색 후 셀렉터 확정
5. `POST /api/crawl` 라우트
6. UI: SearchForm → SpecTable → ImageGrid → DownloadBar
7. `POST /api/download/images` 라우트
8. E2E 테스트 (실제 모델명으로 전체 플로우 확인)

export interface RentalRow {
  company: string   // 렌탈사 이름
  period: string    // 계약기간 (60개월, 48개월, 36개월)
  price: string     // 월 렌탈료
  cardPrice: string // 카드 할인시 (없으면 '-')
}

export interface CrawlResult {
  source: 'danawa' | 'biligo'
  productName: string
  specs: Record<string, string>
  images: string[]
  productUrl: string
  rentalPrices?: RentalRow[]  // 빌리고 전용
  tags?: string[]             // 빌리고 전용 (#태그)
}

export interface CrawlResponse {
  danawa: CrawlResult | { error: string }
  biligo: CrawlResult | { error: string }
}

export function isCrawlResult(v: CrawlResult | { error: string }): v is CrawlResult {
  return !('error' in v)
}

import { chromium } from 'playwright'
import type { CrawlResult } from './types'

const BASE = 'https://xn--299ar6vqrd.com'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function crawlBiligo(model: string): Promise<CrawlResult> {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ userAgent: UA })
    const page = await context.newPage()

    // 1. 검색: /model/search.php?ss_tx=모델명
    await page.goto(
      `${BASE}/model/search.php?ss_tx=${encodeURIComponent(model)}`,
      { waitUntil: 'domcontentloaded', timeout: 15_000 }
    )
    await page.waitForTimeout(2000)

    // 2. 첫 번째 상품 링크 추출
    // 목록 구조: a[href*="/model/compare.php?model_idx="] 안에 span.model(모델명), h3(상품명)
    const productUrl = await page.evaluate((base: string) => {
      const link = document.querySelector(
        'a[href*="/model/compare.php?model_idx="]'
      ) as HTMLAnchorElement | null
      if (!link) return null
      return link.href.startsWith('http') ? link.href : base + link.getAttribute('href')
    }, BASE)

    if (!productUrl) throw new Error('검색 결과 없음')

    // 3. 상세 페이지 (/model/compare.php?model_idx=xxxxx&ca_id=xxx)
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    await page.waitForTimeout(2000)

    // 4. 스펙 + 이미지 + 렌탈가격 + 태그 추출
    const { productName, specs, images, rentalPrices, tags } = await page.evaluate(() => {
      // 상품명: h2.ff_NSR
      const productName =
        (document.querySelector('h2.ff_NSR') as HTMLElement)?.innerText?.trim() ?? ''

      // 스펙: .txtBox dl → dt(key) + dd(value)
      const specs: Record<string, string> = {}
      document.querySelectorAll('.txtBox dl').forEach((dl) => {
        const key = (dl.querySelector('dt') as HTMLElement)?.innerText?.trim()
        const val = (dl.querySelector('dd') as HTMLElement)?.innerText?.trim()
        if (key && val) specs[key] = val
      })

      // 렌탈사별 가격표: .compare_tbl ul li
      // 구조: .titNm h3 (렌탈사), .compare_prc_check_box 반복 (.opt_name, .option_prc em, .option_card em)
      const rentalPrices: { company: string; period: string; price: string; cardPrice: string }[] = []
      document.querySelectorAll('.compare_tbl ul > li').forEach((li) => {
        const company = (li.querySelector('.titNm h3') as HTMLElement)?.innerText?.trim() ?? ''
        li.querySelectorAll('.compare_prc_check_box').forEach((box) => {
          const period = (box.querySelector('.opt_name') as HTMLElement)?.innerText?.trim() ?? ''
          const price = (box.querySelector('.option_prc dd em') as HTMLElement)?.innerText?.trim() ?? ''
          const cardPrice = (box.querySelector('.option_card dd em') as HTMLElement)?.innerText?.trim() ?? '-'
          if (company && period && price) {
            rentalPrices.push({ company, period, price: price + '원', cardPrice: cardPrice !== '-' ? cardPrice + '원' : '-' })
          }
        })
      })

      // 이미지 수집
      const imageSet = new Set<string>()

      // 썸네일 슬라이더: .big.slick-slide img
      document.querySelectorAll<HTMLImageElement>('.big.slick-slide img').forEach((img) => {
        const src = img.src || img.dataset.src
        if (src && !src.startsWith('data:')) imageSet.add(src)
      })

      // 상세 이미지: .dtlImg_area img (에너지효율 안내 이미지 제외)
      document.querySelectorAll<HTMLImageElement>('.dtlImg_area img').forEach((img) => {
        const src = img.src || img.dataset.src
        if (src && !src.startsWith('data:') && !src.includes('/img/energy_img')) {
          imageSet.add(src)
        }
      })

      // 태그: .prd_tag ul li span (# 제거)
      const tags: string[] = []
      document.querySelectorAll<HTMLElement>('.prd_tag ul li span').forEach((span) => {
        const text = span.innerText?.trim().replace(/^#/, '')
        if (text) tags.push(text)
      })

      return { productName, specs, images: [...imageSet], rentalPrices, tags }
    })

    if (Object.keys(specs).length === 0) throw new Error('스펙 없음')

    return { source: 'biligo', productName, specs, images, productUrl, rentalPrices, tags }
  } finally {
    await browser.close()
  }
}

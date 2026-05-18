import { chromium } from 'playwright'
import type { CrawlResult } from './types'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function crawlDanawa(model: string): Promise<CrawlResult> {
  const browser = await chromium.launch({ headless: true })
  try {
    const context = await browser.newContext({ userAgent: UA })
    const page = await context.newPage()

    // 1. 검색
    await page.goto(
      `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(model)}&tab=goods`,
      { waitUntil: 'domcontentloaded', timeout: 15_000 }
    )
    await page.waitForTimeout(1500)

    // 2. pcode 추출
    const pcode = await page.evaluate(() => {
      const link = document.querySelector(
        '.prod_main_info a[href*="pcode="]'
      ) as HTMLAnchorElement | null
      if (!link) return null
      const match = link.href.match(/pcode=(\d+)/)
      return match ? match[1] : null
    })

    if (!pcode) throw new Error('검색 결과 없음')

    // 3. 상세 페이지
    const productUrl = `https://prod.danawa.com/info/?pcode=${pcode}`
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 15_000 })
    await page.waitForTimeout(2000)

    // 4. 스펙 + 이미지 추출
    const { productName, specs, images } = await page.evaluate(() => {
      const productName =
        (document.querySelector('.prod_tit') as HTMLElement)?.innerText?.trim() ?? ''

      const specs: Record<string, string> = {}
      document.querySelectorAll('.spec_tbl tr').forEach((row) => {
        // colspan="4" 인 섹션 헤더 행 건너뜀 (건조기능, 에너지등급 등)
        if (row.querySelector('th[colspan="4"]')) return

        // 한 행에 th.tit + td.dsc 쌍이 최대 2개 존재 (4열 구조)
        const ths = row.querySelectorAll<HTMLElement>('th.tit')
        const tds = row.querySelectorAll<HTMLElement>('td.dsc')

        ths.forEach((th, i) => {
          const key = th.innerText?.trim()
          const val = tds[i]?.innerText?.trim()
          if (key && val && !key.includes('인증')) {
            specs[key] = val
          }
        })
      })

      const imageSet = new Set<string>()
      const addImg = (sel: string) => {
        document.querySelectorAll<HTMLImageElement>(sel).forEach((img) => {
          const src = img.src || img.dataset.src
          if (src && !src.startsWith('data:')) imageSet.add(src)
        })
      }
      addImg('.thumb_image img')
      addImg('.photo_slide img')
      addImg('.detail_cont img')

      return { productName, specs, images: [...imageSet] }
    })

    if (Object.keys(specs).length === 0) throw new Error('스펙 없음')

    return { source: 'danawa', productName, specs, images, productUrl }
  } finally {
    await browser.close()
  }
}

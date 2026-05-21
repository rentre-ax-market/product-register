import * as cheerio from 'cheerio'
import type { CrawlResult } from './types'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const UA_MOBILE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

interface ProductOption {
  type: 'title' | 'list'
  groupName?: string
  attributeName?: string
  attributeValue?: string
}

interface DetailInfoResponse {
  result?: {
    data?: {
      productOptionList?: ProductOption[]
      webInfo?: {
        webContentsInfo?: {
          otherWebInfoList?: { htmlDescription?: string }[]
        }
      }
    }
  }
}

async function fetchText(url: string, ua: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function absolutize(src: string): string {
  if (src.startsWith('//')) return `https:${src}`
  if (src.startsWith('http://')) return src.replace(/^http:\/\//, 'https://')
  return src
}

export async function crawlDanawa(model: string): Promise<CrawlResult> {
  const searchUrl = `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(
    model
  )}&tab=goods`
  const searchHtml = await fetchText(searchUrl, UA)
  const $s = cheerio.load(searchHtml)

  let pcode: string | null = null
  const thumbImages = new Set<string>()

  $s('.prod_main_info').each((_, el) => {
    if (pcode) return
    const $el = $s(el)
    const standardHref = $el
      .find('a[href*="prod.danawa.com/info/?pcode="]')
      .first()
      .attr('href')
    if (!standardHref) return

    const match = standardHref.match(/pcode=(\d+)/)
    if (!match) return
    pcode = match[1]

    $el.find('img').each((__, img) => {
      const src = $s(img).attr('src')
      if (src && !src.startsWith('data:') && !src.includes('noImg')) {
        thumbImages.add(absolutize(src))
      }
    })
  })

  if (!pcode) throw new Error('검색 결과 없음')

  const productUrl = `https://prod.danawa.com/info/?pcode=${pcode}`
  const detailHtml = await fetchText(productUrl, UA)
  const $d = cheerio.load(detailHtml)

  const productName =
    $d('.prod_tit .title').first().text().trim() ||
    $d('.prod_tit').first().text().trim() ||
    $d('title')
      .text()
      .replace(/\s*:\s*다나와 가격비교\s*$/, '')
      .trim()

  const apiUrl = `https://m.danawa.com/product/productDetailInfo.json?productCode=${pcode}`
  const res = await fetch(apiUrl, {
    headers: {
      'User-Agent': UA_MOBILE,
      Accept: 'application/json',
      Referer: 'https://m.danawa.com/',
    },
  })
  if (!res.ok) throw new Error(`스펙 API HTTP ${res.status}`)
  const json = (await res.json()) as DetailInfoResponse
  const options = json.result?.data?.productOptionList ?? []

  const specs: Record<string, string> = {}
  for (const opt of options) {
    if (opt.type !== 'list') continue
    const key = opt.attributeName?.trim()
    const val = opt.attributeValue?.trim()
    if (!key || !val) continue
    specs[key] = val
  }

  const images = new Set<string>(thumbImages)
  const htmlDesc =
    json.result?.data?.webInfo?.webContentsInfo?.otherWebInfoList?.[0]?.htmlDescription
  if (htmlDesc) {
    const $h = cheerio.load(`<div>${htmlDesc}</div>`)
    $h('img').each((_, img) => {
      const src = $h(img).attr('src')
      if (src && !src.startsWith('data:') && !src.includes('noImg')) {
        images.add(absolutize(src))
      }
    })
  }

  if (Object.keys(specs).length === 0 && images.size === 0) {
    throw new Error('스펙 없음')
  }

  return {
    source: 'danawa',
    productName,
    specs,
    images: [...images],
    productUrl,
  }
}

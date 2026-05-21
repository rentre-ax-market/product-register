import * as cheerio from 'cheerio'
import type { CrawlResult } from './types'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function parseSpecList(text: string): Record<string, string> {
  const specs: Record<string, string> = {}
  let bareIndex = 1
  const segments = text
    .replace(/\s+/g, ' ')
    .split(' / ')
    .map((s) => s.trim())
    .filter(Boolean)

  for (let seg of segments) {
    seg = seg.replace(/^\[[^\]]+\]\s*/, '').trim()
    if (!seg) continue

    const colon = seg.match(/^([^:]+?):\s*(.+)$/)
    if (colon) {
      const key = colon[1].trim()
      const val = colon[2].trim()
      if (key && val) specs[key] = val
    } else {
      specs[`특징${bareIndex++}`] = seg
    }
  }
  return specs
}

export async function crawlDanawa(model: string): Promise<CrawlResult> {
  const searchUrl = `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(
    model
  )}&tab=goods`
  const searchHtml = await fetchText(searchUrl)
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
        thumbImages.add(src.startsWith('//') ? `https:${src}` : src)
      }
    })
  })

  if (!pcode) throw new Error('검색 결과 없음')

  const productUrl = `https://prod.danawa.com/info/?pcode=${pcode}`
  const detailHtml = await fetchText(productUrl)
  const $d = cheerio.load(detailHtml)

  const productName =
    $d('.prod_tit .title').first().text().trim() ||
    $d('.prod_tit').first().text().trim() ||
    $d('title')
      .text()
      .replace(/\s*:\s*다나와 가격비교\s*$/, '')
      .trim()

  const specs = parseSpecList($d('.spec_list .items').first().text())

  const images = new Set<string>(thumbImages)
  const addImg = (sel: string) => {
    $d(sel).each((_, img) => {
      const src = $d(img).attr('src') || $d(img).attr('data-src')
      if (src && !src.startsWith('data:') && !src.includes('noImg')) {
        images.add(src.startsWith('//') ? `https:${src}` : src)
      }
    })
  }
  addImg('.photo_w img')
  addImg('.photo_slide img')
  addImg('.thumb_image img')

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

import * as cheerio from 'cheerio'
import type { CrawlResult, RentalRow } from './types'

const BASE = 'https://xn--299ar6vqrd.com'
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

interface SearchListItem {
  model?: string
  model_name?: string
  model_url?: string
  model_thumnail_url?: string
}

interface SearchResponse {
  Counts: number
  Lists: SearchListItem[]
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      Referer: BASE + '/',
      'X-Requested-With': 'XMLHttpRequest',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      Referer: BASE + '/',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function resolveUrl(src: string): string {
  if (src.startsWith('http')) return src
  if (src.startsWith('//')) return 'https:' + src
  if (src.startsWith('/')) return BASE + src
  return src
}

function extractImages($: cheerio.CheerioAPI): string[] {
  const set = new Set<string>()
  const add = (src: string | undefined) => {
    if (!src || src.startsWith('data:')) return
    if (src.includes('/img/energy_img')) return
    set.add(resolveUrl(src))
  }

  const ogImage = $('meta[property="og:image"]').attr('content')
  add(ogImage)

  $('.dtlImg_area img, .ma_dtlImg_area img, .gallery-big img, .photo_slide img, .big.slick-slide img').each(
    (_, img) => {
      add($(img).attr('src') ?? $(img).attr('data-src'))
    }
  )
  return [...set]
}

function extractRentalPrices($: cheerio.CheerioAPI): RentalRow[] {
  const rows: RentalRow[] = []
  $('.compare_tbl ul > li').each((_, li) => {
    const $li = $(li)
    const company = $li.find('.titNm h3').first().text().trim()
    $li.find('.compare_prc_check_box').each((__, box) => {
      const $box = $(box)
      const period = $box.find('.opt_name').first().text().trim()
      const price = $box.find('.option_prc dd em').first().text().trim()
      const cardPrice = $box.find('.option_card dd em').first().text().trim()
      if (company && period && price) {
        rows.push({
          company,
          period,
          price: price + '원',
          cardPrice: cardPrice ? cardPrice + '원' : '-',
        })
      }
    })
  })
  return rows
}

function extractTags($: cheerio.CheerioAPI): string[] {
  const tags: string[] = []
  $('.prd_tag ul li span').each((_, el) => {
    const text = $(el).text().trim().replace(/^#/, '')
    if (text) tags.push(text)
  })
  return tags
}

function productNameFromHtml($: cheerio.CheerioAPI, fallback: string): string {
  const ogTitle = $('meta[property="og:title"]').attr('content') ?? ''
  const cleaned = ogTitle.replace(/\s*\|.*$/, '').trim()
  if (cleaned) return cleaned

  const h2 = $('h2.ff_NSR')
    .toArray()
    .map((el) => $(el).text().trim())
    .filter((t) => t && !t.includes('렌탈사 비교') && !t.includes('상품 상세') && !t.includes('상품 요약'))
  if (h2[0]) return h2[0]

  return fallback
}

export async function crawlBiligo(model: string): Promise<CrawlResult> {
  const apiUrl = `${BASE}/api/v2/models/search?ss_tx=${encodeURIComponent(
    model
  )}&filter_section=rental&section=models`
  const data = await fetchJson<SearchResponse>(apiUrl)

  if (!data.Counts || !data.Lists?.length) {
    throw new Error('검색 결과 없음')
  }

  const first = data.Lists[0]
  const relativeUrl = first.model_url
  if (!relativeUrl) throw new Error('검색 결과 없음')

  const productUrl = relativeUrl.startsWith('http') ? relativeUrl : BASE + relativeUrl
  const html = await fetchHtml(productUrl)
  const $ = cheerio.load(html)

  const productName = productNameFromHtml($, first.model_name ?? model)

  const specs: Record<string, string> = {}
  $('.txtBox dl').each((_, dl) => {
    const $dl = $(dl)
    const key = $dl.find('dt').first().text().trim()
    const val = $dl.find('dd').first().text().trim()
    if (key && val) specs[key] = val
  })

  if (Object.keys(specs).length === 0 && first.model) {
    specs['모델명'] = first.model
  }

  const images = extractImages($)
  const rentalPrices = extractRentalPrices($)
  const tags = extractTags($)

  return {
    source: 'biligo',
    productName,
    specs,
    images,
    productUrl,
    rentalPrices: rentalPrices.length > 0 ? rentalPrices : undefined,
    tags: tags.length > 0 ? tags : undefined,
  }
}

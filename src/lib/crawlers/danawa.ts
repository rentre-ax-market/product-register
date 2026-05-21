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

export async function crawlDanawa(model: string): Promise<CrawlResult> {
  const searchUrl = `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(
    model
  )}&tab=goods`
  const searchHtml = await fetchText(searchUrl)
  const $s = cheerio.load(searchHtml)

  let pcode: string | null = null
  let productName = ''
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

    productName = $el.find('.prod_name a').first().text().trim()
    if (!productName) productName = $el.find('img[alt]').first().attr('alt') ?? ''

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
  const titleText = $d('title').text().trim()
  const titleName = titleText.replace(/\s*:\s*다나와 가격비교\s*$/, '').trim()
  if (titleName) productName = titleName

  const ajaxBody = new URLSearchParams({ pcode })
  const specHtml = await fetchText(
    'https://prod.danawa.com/info/ajax/getProductDescription.ajax.php',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        Referer: productUrl,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: ajaxBody.toString(),
    }
  )
  const $a = cheerio.load(specHtml)

  const specs: Record<string, string> = {}
  $a('.spec_tbl tr').each((_, row) => {
    const $row = $a(row)
    if ($row.find('th[colspan="4"]').length > 0) return

    const ths = $row.find('th.tit').toArray()
    const tds = $row.find('td.dsc').toArray()
    ths.forEach((th, i) => {
      const key = $a(th).text().trim()
      const val = $a(tds[i]).text().trim()
      if (key && val && !key.includes('인증')) {
        specs[key] = val
      }
    })
  })

  const images = new Set<string>(thumbImages)
  const addImg = ($: cheerio.CheerioAPI, sel: string) => {
    $(sel).each((_, img) => {
      const src = $(img).attr('src') || $(img).attr('data-src')
      if (src && !src.startsWith('data:') && !src.includes('noImg')) {
        images.add(src.startsWith('//') ? `https:${src}` : src)
      }
    })
  }
  addImg($a, '.detail_cont img')
  addImg($a, '.detail_export img')

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

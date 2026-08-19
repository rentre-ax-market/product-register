import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

const ALLOWED_IMAGE_HOSTS = [
  'danawa.com',
  'xn--299ar6vqrd.com', // 빌리고
  'biligo.co.kr',
]

function isAllowedImageUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    return ALLOWED_IMAGE_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const { model, urls } = await req.json() as { model: string; urls: string[] }

  if (!urls?.length) {
    return NextResponse.json({ error: '다운로드할 이미지가 없습니다.' }, { status: 400 })
  }

  const zip = new JSZip()
  const counts: Record<string, number> = {}

  await Promise.allSettled(
    urls.map(async (url) => {
      try {
        if (!isAllowedImageUrl(url)) return

        const source = url.includes('danawa') ? 'danawa' : 'biligo'
        counts[source] = (counts[source] ?? 0) + 1
        const idx = String(counts[source]).padStart(2, '0')

        const ext = url.match(/\.(jpg|jpeg|png|webp)/i)?.[1] ?? 'jpg'
        const filename = `${source}_${idx}.${ext}`

        const res = await fetch(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Referer: source === 'danawa' ? 'https://prod.danawa.com/' : 'https://biligo.co.kr/',
          },
        })
        if (!res.ok) return
        const buffer = await res.arrayBuffer()
        zip.file(filename, buffer)
      } catch {
        // 개별 이미지 실패 시 건너뜀
      }
    })
  )

  const zipBase64 = await zip.generateAsync({ type: 'base64' })
  const zipBinary = Buffer.from(zipBase64, 'base64')
  const safeName = (model ?? 'images').replace(/[/\\:*?"<>|]/g, '_')

  return new Response(zipBinary, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${safeName}_images.zip"`,
    },
  })
}

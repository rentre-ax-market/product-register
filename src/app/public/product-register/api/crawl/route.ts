import { NextRequest, NextResponse } from 'next/server'
import { crawlDanawa } from '@/lib/crawlers/danawa'
import { crawlBiligo } from '@/lib/crawlers/biligo'
import type { CrawlResponse } from '@/lib/crawlers/types'

export async function POST(req: NextRequest) {
  const { model } = await req.json()
  if (!model?.trim()) {
    return NextResponse.json({ error: '모델명을 입력해주세요.' }, { status: 400 })
  }

  const TIMEOUT_MS = 30_000
  const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('타임아웃 (30초)')), TIMEOUT_MS)
      ),
    ])

  const [danawa, biligo] = await Promise.allSettled([
    withTimeout(crawlDanawa(model)),
    withTimeout(crawlBiligo(model)),
  ])

  const response: CrawlResponse = {
    danawa:
      danawa.status === 'fulfilled'
        ? danawa.value
        : { error: (danawa.reason as Error)?.message ?? '크롤링 실패' },
    biligo:
      biligo.status === 'fulfilled'
        ? biligo.value
        : { error: (biligo.reason as Error)?.message ?? '크롤링 실패' },
  }

  return NextResponse.json(response)
}

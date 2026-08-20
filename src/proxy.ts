import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'

/**
 * /public/product-register/api 는 마켓 SSO가 면제된 인터넷 노출 구간이라, 라우트 핸들러
 * 개별 호출이 아니라 여기서 한 번에 막는다 — 새 라우트를 추가해도 인증 누락이 불가능하도록.
 */
function keysMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function proxy(req: NextRequest) {
  const expected = process.env.API_KEY
  if (!expected) {
    return NextResponse.json({ error: '서버에 API_KEY가 설정되지 않았습니다.' }, { status: 500 })
  }

  const provided = req.headers.get('x-api-key') ?? ''
  if (!keysMatch(provided, expected)) {
    return NextResponse.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/public/product-register/api/:path*',
}

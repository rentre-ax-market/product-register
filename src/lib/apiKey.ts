import { timingSafeEqual } from 'crypto'

const HEADER_NAME = 'x-api-key'

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/**
 * /public 은 마켓 SSO가 면제되는 경로다.
 * 이 API의 유일한 접근 통제이므로 반드시 통과해야 한다.
 */
export function assertValidApiKey(req: Request): Response | null {
  const expected = process.env.NEXT_PUBLIC_PRODUCT_REGISTER_API_KEY
  const provided = req.headers.get(HEADER_NAME)

  if (!expected) {
    return Response.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
  }
  if (!provided || !safeEqual(provided, expected)) {
    return Response.json({ error: '인증되지 않은 요청입니다.' }, { status: 401 })
  }
  return null
}

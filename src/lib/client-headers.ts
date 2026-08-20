export function apiKeyHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  headers.set('X-Api-Key', process.env.NEXT_PUBLIC_API_KEY ?? '')
  return headers
}

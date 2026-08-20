'use client'

import { useState } from 'react'
import { Toaster, toast } from 'sonner'
import SearchForm from './components/SearchForm'
import SourceCard from './components/SourceCard'
import DownloadBar from './components/DownloadBar'
import type { CrawlResponse } from '@/lib/crawlers/types'

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<CrawlResponse | null>(null)
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())

  const handleSearch = async (model: string) => {
    setIsLoading(true)
    setResult(null)
    setSelectedImages(new Set())
    setQuery(model)

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/public/product-register/api/crawl`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.NEXT_PUBLIC_PRODUCT_REGISTER_API_KEY ?? '',
          },
          body: JSON.stringify({ model }),
        }
      )
      if (!res.ok) throw new Error('서버 오류')
      const data: CrawlResponse = await res.json()
      setResult(data)
    } catch (e) {
      toast.error('크롤링 중 오류가 발생했습니다.')
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleImage = (url: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  return (
    <>
      <Toaster position="top-center" />

      {/* Global nav */}
      <nav className="sticky top-0 z-50 h-11 bg-black flex items-center px-5">
        <span className="text-white text-[12px] tracking-[-0.12px] font-normal opacity-90">
          상품 등록 도구
        </span>
      </nav>

      <main className="flex-1 w-full max-w-[980px] mx-auto px-5 py-20">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1
            className="text-[40px] font-semibold text-[#1d1d1f] mb-3"
            style={{ letterSpacing: '-0.374px', lineHeight: 1.1 }}
          >
            상품 등록
          </h1>
          <p className="text-[21px] font-normal text-[#6e6e73]" style={{ letterSpacing: '0' }}>
            모델명으로 다나와 · 빌리고 스펙과 이미지를 수집합니다.
          </p>
        </div>

        <SearchForm onSearch={handleSearch} isLoading={isLoading} />

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-10">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-[18px] bg-white border border-[#e0e0e0] p-6 space-y-4 animate-pulse"
              >
                <div className="h-4 w-20 rounded-full bg-[#f0f0f0]" />
                <div className="h-36 rounded-[11px] bg-[#f0f0f0]" />
                <div className="h-20 rounded-[11px] bg-[#f0f0f0]" />
              </div>
            ))}
          </div>
        )}

        {result && !isLoading && (
          <div className="mt-10 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <SourceCard
                source="danawa"
                result={result.danawa}
                selectedImages={selectedImages}
                onToggleImage={handleToggleImage}
              />
              <SourceCard
                source="biligo"
                result={result.biligo}
                selectedImages={selectedImages}
                onToggleImage={handleToggleImage}
              />
            </div>
            <DownloadBar model={query} result={result} selectedImages={selectedImages} />
          </div>
        )}
      </main>
    </>
  )
}

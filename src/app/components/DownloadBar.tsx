'use client'

import { useState } from 'react'
import { FileJson, ImageIcon } from 'lucide-react'
import type { CrawlResponse } from '@/lib/crawlers/types'
import { isCrawlResult } from '@/lib/crawlers/types'

interface Props {
  model: string
  result: CrawlResponse
  selectedImages: Set<string>
}

export default function DownloadBar({ model, result, selectedImages }: Props) {
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)

  const handleDownloadJson = () => {
    const merged: Record<string, unknown> = { model }
    if (isCrawlResult(result.danawa)) merged.danawa = result.danawa.specs
    if (isCrawlResult(result.biligo)) merged.biligo = result.biligo.specs

    const blob = new Blob([JSON.stringify(merged, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${model}_specs.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadZip = async () => {
    if (selectedImages.size === 0) return
    setIsDownloadingZip(true)
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/api/download/images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, urls: [...selectedImages] }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${model}_images.zip`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloadingZip(false)
    }
  }

  const hasSpecs = isCrawlResult(result.danawa) || isCrawlResult(result.biligo)

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span className="text-[12px] text-[#7a7a7a] font-semibold tracking-[0]">다운로드</span>

      <button
        onClick={handleDownloadJson}
        disabled={!hasSpecs}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-[#0066cc] text-[#0066cc] text-[14px] tracking-[-0.224px] bg-white transition-transform active:scale-95 hover:bg-[#0066cc]/5 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <FileJson className="w-[14px] h-[14px]" />
        스펙 JSON
      </button>

      <button
        onClick={handleDownloadZip}
        disabled={selectedImages.size === 0 || isDownloadingZip}
        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-[#0066cc] text-white text-[14px] tracking-[-0.224px] transition-transform active:scale-95 hover:bg-[#0077ed] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ImageIcon className="w-[14px] h-[14px]" />
        이미지 ZIP
        {selectedImages.size > 0 && (
          <span className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/25 text-[11px] font-semibold">
            {selectedImages.size}
          </span>
        )}
      </button>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

interface Props {
  onSearch: (model: string) => void
  isLoading: boolean
}

export default function SearchForm({ onSearch, isLoading }: Props) {
  const [value, setValue] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) onSearch(value.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 w-full max-w-xl mx-auto">
      <div className="relative flex-1">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[14px] h-[14px] text-[#7a7a7a]" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="모델명 입력 (예: LG OLED65C3KNA)"
          disabled={isLoading}
          className="w-full h-11 pl-10 pr-5 rounded-full border border-[#e0e0e0] bg-white text-[#1d1d1f] placeholder:text-[#7a7a7a] text-[17px] leading-none tracking-[-0.374px] outline-none focus:border-[#0066cc] focus:ring-2 focus:ring-[#0071e3]/20 transition-colors disabled:opacity-50"
          style={{ letterSpacing: '-0.374px' }}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="h-11 px-6 rounded-full bg-[#0066cc] text-white text-[17px] font-normal tracking-[-0.374px] whitespace-nowrap transition-transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0077ed]"
        style={{ letterSpacing: '-0.374px' }}
      >
        {isLoading ? '검색 중…' : '검색'}
      </button>
    </form>
  )
}

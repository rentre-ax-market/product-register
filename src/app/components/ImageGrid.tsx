'use client'

interface Props {
  images: string[]
  selected: Set<string>
  onToggle: (url: string) => void
}

export default function ImageGrid({ images, selected, onToggle }: Props) {
  if (images.length === 0)
    return <p className="text-[14px] text-[#7a7a7a] tracking-[-0.224px]">이미지 없음</p>

  return (
    <div className="grid grid-cols-3 gap-2">
      {images.map((url) => {
        const isSelected = selected.has(url)
        return (
          <button
            key={url}
            type="button"
            onClick={() => onToggle(url)}
            className={`relative rounded-[8px] overflow-hidden border-2 transition-all ${
              isSelected
                ? 'border-[#0066cc] shadow-[0_0_0_3px_rgba(0,102,204,0.15)]'
                : 'border-transparent hover:border-[#e0e0e0]'
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full aspect-square object-cover" />
            {isSelected && (
              <div className="absolute inset-0 bg-[#0066cc]/10 flex items-center justify-center">
                <span className="w-5 h-5 rounded-full bg-[#0066cc] flex items-center justify-center text-white text-[11px] font-semibold">
                  ✓
                </span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

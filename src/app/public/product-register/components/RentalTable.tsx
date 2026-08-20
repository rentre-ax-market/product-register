import type { RentalRow } from '@/lib/crawlers/types'

interface Props {
  rows: RentalRow[]
}

export default function RentalTable({ rows }: Props) {
  if (rows.length === 0)
    return <p className="text-[14px] text-[#7a7a7a] tracking-[-0.224px]">렌탈 가격 없음</p>

  return (
    <div className="overflow-auto rounded-[11px] border border-[#e0e0e0] text-[13px] tracking-[-0.224px]">
      <table className="w-full">
        <thead>
          <tr className="bg-[#f5f5f7] border-b border-[#e0e0e0]">
            <th className="px-3 py-2 text-left font-semibold text-[#1d1d1f] whitespace-nowrap">렌탈사</th>
            <th className="px-3 py-2 text-left font-semibold text-[#1d1d1f] whitespace-nowrap">계약기간</th>
            <th className="px-3 py-2 text-right font-semibold text-[#1d1d1f] whitespace-nowrap">월 렌탈료</th>
            <th className="px-3 py-2 text-right font-semibold text-[#1d1d1f] whitespace-nowrap">카드 할인시</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-[#f0f0f0] last:border-0 even:bg-[#f5f5f7]/40"
            >
              <td className="px-3 py-2 text-[#1d1d1f] whitespace-nowrap">{row.company}</td>
              <td className="px-3 py-2 text-[#6e6e73] whitespace-nowrap">{row.period}</td>
              <td className="px-3 py-2 text-right font-semibold text-[#1d1d1f] whitespace-nowrap">{row.price}</td>
              <td className="px-3 py-2 text-right text-[#0066cc] whitespace-nowrap">{row.cardPrice}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

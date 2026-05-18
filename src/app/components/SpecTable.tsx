interface Props {
  specs: Record<string, string>
}

export default function SpecTable({ specs }: Props) {
  const entries = Object.entries(specs)
  if (entries.length === 0)
    return <p className="text-[14px] text-[#7a7a7a] tracking-[-0.224px]">스펙 없음</p>

  return (
    <div className="overflow-auto rounded-[11px] border border-[#e0e0e0] text-[14px] tracking-[-0.224px]">
      <table className="w-full">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-[#f0f0f0] last:border-0 even:bg-[#f5f5f7]/60">
              <td className="px-3 py-2 font-semibold text-[#6e6e73] whitespace-nowrap w-[35%] align-top">
                {key}
              </td>
              <td className="px-3 py-2 text-[#1d1d1f] break-all">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

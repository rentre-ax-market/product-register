"use client";

import { ExternalLink } from "lucide-react";
import SpecTable from "./SpecTable";
import ImageGrid from "./ImageGrid";
import RentalTable from "./RentalTable";
import type { CrawlResult } from "@/lib/crawlers/types";

/** 태그 배열 → SpecTable용 Record 변환
 * [카테고리] 내용  →  카테고리: 내용
 * 항목: 값        →  항목: 값
 * 기타            →  기타: ○
 */
function tagsToSpecs(tags: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  tags.forEach((tag) => {
    const bracketMatch = tag.match(/^\[(.+?)\]\s*(.+)$/);
    const colonMatch = tag.match(/^(.+?):\s*(.+)$/);
    if (bracketMatch) {
      result[bracketMatch[1]] = bracketMatch[2];
    } else if (colonMatch) {
      result[colonMatch[1]] = colonMatch[2];
    } else {
      result[tag] = "○";
    }
  });
  return result;
}

// 상품 기본정보에 해당하는 스펙 키 패턴
// 포함: 브랜드/제조사/제조회사, 등록년월/출시연월, ~년형, 크기(가로x세로x깊이)
const BASIC_INFO_PATTERNS: RegExp[] = [
  /브랜드/,
  /제조사/,
  /품목/,
  /제조회사/,
  /등록년월/,
  /출시연월/,
  /크기/,
];

function isBasicInfoKey(key: string): boolean {
  return BASIC_INFO_PATTERNS.some((p) => p.test(key));
}

function splitSpecs(specs: Record<string, string>): {
  basic: Record<string, string>;
  category: Record<string, string>;
} {
  const basic: Record<string, string> = {};
  const category: Record<string, string> = {};
  for (const [k, v] of Object.entries(specs)) {
    if (isBasicInfoKey(k)) basic[k] = v;
    else category[k] = v;
  }
  return { basic, category };
}

function SectionBlock({
  number,
  title,
  specs,
}: {
  number: number;
  title: string;
  specs: Record<string, string>;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#1d1d1f] text-white text-[10px] font-semibold shrink-0">
          {number}
        </span>
        <p className="text-[12px] font-semibold text-[#1d1d1f] tracking-[-0.12px]">
          {title}
        </p>
      </div>
      <SpecTable specs={specs} />
    </div>
  );
}

function SpecSections({
  specs,
  tags,
}: {
  specs: Record<string, string>;
  tags?: string[];
}) {
  const merged = { ...specs, ...(tags ? tagsToSpecs(tags) : {}) };
  const { basic, category } = splitSpecs(merged);
  return (
    <div className="space-y-4">
      {Object.keys(basic).length > 0 && (
        <SectionBlock number={1} title="상품 기본정보 설정" specs={basic} />
      )}
      {Object.keys(category).length > 0 && (
        <SectionBlock
          number={2}
          title="카테고리별 정보 설정"
          specs={category}
        />
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  danawa: "다나와",
  biligo: "빌리고",
};

interface Props {
  result: CrawlResult | { error: string };
  source: "danawa" | "biligo";
  selectedImages: Set<string>;
  onToggleImage: (url: string) => void;
}

export default function SourceCard({
  result,
  source,
  selectedImages,
  onToggleImage,
}: Props) {
  const label = SOURCE_LABEL[source];

  if ("error" in result) {
    return (
      <div className="rounded-[18px] bg-white border border-[#e0e0e0] p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] text-[12px] font-semibold tracking-[-0.12px]">
            {label}
          </span>
        </div>
        <p className="text-[14px] text-red-500 tracking-[-0.224px]">
          {result.error}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[18px] bg-white border border-[#e0e0e0] p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start gap-2 flex-wrap">
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#0066cc] text-white text-[12px] font-semibold tracking-[-0.12px] shrink-0">
          {label}
        </span>
        <span className="text-[14px] text-[#1d1d1f] tracking-[-0.224px] leading-[1.43] flex-1 min-w-0 break-words">
          {result.productName}
        </span>
        <a
          href={result.productUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#0066cc] hover:text-[#0077ed] transition-colors shrink-0"
          aria-label="상세 페이지 열기"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Specs + 태그 — 섹션 분리 */}
      <SpecSections specs={result.specs} tags={result.tags} />

      {/* 렌탈 가격표 (빌리고 전용) */}
      {result.rentalPrices && result.rentalPrices.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-[#7a7a7a] mb-2 tracking-[0]">
            렌탈사별 가격 (
            {result.rentalPrices.length /
              [...new Set(result.rentalPrices.map((r) => r.period))].length}
            개사)
          </p>
          <RentalTable rows={result.rentalPrices} />
        </div>
      )}

      {/* Images */}
      <div>
        <p className="text-[12px] font-semibold text-[#7a7a7a] mb-2 tracking-[0]">
          이미지 {result.images.length}개 — 클릭해서 선택
        </p>
        <ImageGrid
          images={result.images}
          selected={selectedImages}
          onToggle={onToggleImage}
        />
      </div>
    </div>
  );
}

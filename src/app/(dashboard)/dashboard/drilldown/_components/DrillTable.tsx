import Link from "next/link";
import Sparkline from "@/components/ui/Sparkline";
import { formatKRW, formatNumber, formatPercent, formatRoas } from "@/lib/format";
import { CHANNEL_TYPE_LABELS } from "@/types/drilldown";
import type { ChannelSummary, BrandChannelSummary, DailyStat } from "@/types/drilldown";

// ── 채널 목록 테이블 ───────────────────────────────────────────

interface ChannelTableProps {
  rows: ChannelSummary[];
  basePath: string;
}

export function ChannelTable({ rows, basePath }: ChannelTableProps) {
  if (!rows.length) {
    return <p className="py-16 text-center text-sm text-gray-400">채널 데이터가 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
            <th className="px-3 py-3 font-medium sm:px-4">채널</th>
            <th className="px-3 py-3 font-medium text-right sm:px-4">세션</th>
            <th className="px-3 py-3 font-medium text-right sm:px-4">전환</th>
            <th className="px-3 py-3 font-medium text-right sm:px-4">전환율</th>
            <th className="hidden px-3 py-3 font-medium text-right sm:table-cell sm:px-4">매출</th>
            <th className="hidden px-3 py-3 font-medium text-right sm:table-cell sm:px-4">광고비</th>
            <th className="hidden px-3 py-3 font-medium text-right md:table-cell sm:px-4">ROAS</th>
            <th className="hidden px-3 py-3 font-medium text-right md:table-cell sm:px-4">CPA</th>
            <th className="hidden px-3 py-3 font-medium lg:table-cell sm:px-4">추이</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => (
            <tr key={r.channelId} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                <Link
                  href={`${basePath}/${r.channelId}`}
                  className="flex items-center gap-1.5 group"
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                    style={{ backgroundColor: r.color }}
                  />
                  <span className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {r.channelName}
                  </span>
                  <span className="hidden text-xs text-gray-400 sm:inline">
                    {CHANNEL_TYPE_LABELS[r.channelType]}
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{formatNumber(r.totalSessions)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{formatNumber(r.totalConversions)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{formatPercent(r.conversionRate)}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell sm:px-4 sm:py-3">{formatKRW(r.totalRevenue)}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell sm:px-4 sm:py-3">{formatKRW(r.totalAdSpend)}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell sm:px-4 sm:py-3">
                {r.roas !== null ? formatRoas(r.roas) : <span className="text-gray-300">–</span>}
              </td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell sm:px-4 sm:py-3">
                {r.cpa !== null ? formatKRW(r.cpa) : <span className="text-gray-300">–</span>}
              </td>
              <td className="hidden px-3 py-2.5 lg:table-cell sm:px-4 sm:py-3">
                <Sparkline data={r.sparkline} color={r.color} width={72} height={24} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 브랜드 목록 테이블 ─────────────────────────────────────────

interface BrandTableProps {
  rows: BrandChannelSummary[];
  basePath: string;
}

export function BrandTable({ rows, basePath }: BrandTableProps) {
  if (!rows.length) {
    return <p className="py-16 text-center text-sm text-gray-400">브랜드 데이터가 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
            <th className="px-3 py-3 font-medium sm:px-4">브랜드</th>
            <th className="px-3 py-3 font-medium text-right sm:px-4">세션</th>
            <th className="px-3 py-3 font-medium text-right sm:px-4">전환</th>
            <th className="px-3 py-3 font-medium text-right sm:px-4">전환율</th>
            <th className="hidden px-3 py-3 font-medium text-right sm:table-cell sm:px-4">매출</th>
            <th className="hidden px-3 py-3 font-medium text-right sm:table-cell sm:px-4">광고비</th>
            <th className="hidden px-3 py-3 font-medium text-right md:table-cell sm:px-4">ROAS</th>
            <th className="hidden px-3 py-3 font-medium text-right md:table-cell sm:px-4">CPA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => (
            <tr key={r.brandId} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2.5 sm:px-4 sm:py-3">
                <Link
                  href={`${basePath}/${r.brandId}`}
                  className="flex items-center gap-1.5 group"
                >
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5"
                    style={{ backgroundColor: r.brandColor }}
                  />
                  <span className="font-medium text-gray-900 group-hover:text-indigo-600 transition-colors">
                    {r.brandName}
                  </span>
                </Link>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{formatNumber(r.totalSessions)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{formatNumber(r.totalConversions)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{formatPercent(r.conversionRate)}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell sm:px-4 sm:py-3">{formatKRW(r.totalRevenue)}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell sm:px-4 sm:py-3">{formatKRW(r.totalAdSpend)}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell sm:px-4 sm:py-3">
                {r.roas !== null ? formatRoas(r.roas) : <span className="text-gray-300">–</span>}
              </td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell sm:px-4 sm:py-3">
                {r.cpa !== null ? formatKRW(r.cpa) : <span className="text-gray-300">–</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── 일별 시계열 테이블 ─────────────────────────────────────────

interface DailyTableProps {
  rows: DailyStat[];
}

export function DailyTable({ rows }: DailyTableProps) {
  if (!rows.length) {
    return <p className="py-16 text-center text-sm text-gray-400">일별 데이터가 없습니다.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white shadow-sm">
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
            <th className="px-3 py-3 font-medium sm:px-4">날짜</th>
            <th className="px-3 py-3 font-medium text-right sm:px-4">세션</th>
            <th className="px-3 py-3 font-medium text-right sm:px-4">전환</th>
            <th className="px-3 py-3 font-medium text-right sm:px-4">전환율</th>
            <th className="hidden px-3 py-3 font-medium text-right sm:table-cell sm:px-4">매출</th>
            <th className="hidden px-3 py-3 font-medium text-right sm:table-cell sm:px-4">광고비</th>
            <th className="hidden px-3 py-3 font-medium text-right md:table-cell sm:px-4">ROAS</th>
            <th className="hidden px-3 py-3 font-medium text-right md:table-cell sm:px-4">CPA</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((r) => (
            <tr key={r.statDate} className="hover:bg-gray-50 transition-colors">
              <td className="px-3 py-2.5 font-medium tabular-nums text-gray-700 sm:px-4 sm:py-3">{r.statDate}</td>
              <td className="px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{formatNumber(r.sessions)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{formatNumber(r.conversions)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums sm:px-4 sm:py-3">{formatPercent(r.conversionRate)}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell sm:px-4 sm:py-3">{formatKRW(r.revenue)}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums sm:table-cell sm:px-4 sm:py-3">{formatKRW(r.adSpend)}</td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell sm:px-4 sm:py-3">
                {r.roas !== null ? formatRoas(r.roas) : <span className="text-gray-300">–</span>}
              </td>
              <td className="hidden px-3 py-2.5 text-right tabular-nums md:table-cell sm:px-4 sm:py-3">
                {r.cpa !== null ? formatKRW(r.cpa) : <span className="text-gray-300">–</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

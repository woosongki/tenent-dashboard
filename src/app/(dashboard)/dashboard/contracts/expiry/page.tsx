import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";
import {
  getExpiringContracts,
  getAllContracts,
  getTenantContractsMeta,
  getContractsBreakdown,
} from "@/lib/tenantContracts";
import ExpiryFilters from "./_components/ExpiryFilters";
import ExpiryTable from "./_components/ExpiryTable";

export const metadata: Metadata = { title: "계약만료 알람 — lifestyle" };

const HORIZONS = [14, 30, 60, 90] as const;
type Horizon = (typeof HORIZONS)[number];
type Band = Horizon | "all";
const ALL_LIMIT = 1000;

function parseBand(v: string | string[] | undefined): Band {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "all") return "all";
  const n = Number(s);
  return (HORIZONS as readonly number[]).includes(n) ? (n as Horizon) : 60;
}
function parseString(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim() : undefined;
}

export default async function ExpiryPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; store?: string; type?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const days = parseBand(sp.days);
  const store = parseString(sp.store);
  const type = parseString(sp.type);

  // load()가 요청 스코프로 memoize 돼 있어 아래 호출들은 Supabase 왕복 1회로 억제됨.
  const [meta, breakdown, d14, d30, d60, d90] = await Promise.all([
    getTenantContractsMeta(),
    getContractsBreakdown(),
    getExpiringContracts({ withinDays: 14 }),
    getExpiringContracts({ withinDays: 30 }),
    getExpiringContracts({ withinDays: 60 }),
    getExpiringContracts({ withinDays: 90 }),
  ]);

  // 선택 밴드: '전체'면 전체 계약(과거·무기한 포함), 아니면 만료 임박.
  const rows = days === "all"
    ? await getAllContracts({ storeName: store, contractType: type, limit: ALL_LIMIT })
    : await getExpiringContracts({ withinDays: days, storeName: store, contractType: type });

  const stores = Object.keys(breakdown.byStore).sort();
  const types = Object.keys(breakdown.byContractType);

  const bandCounts: Record<Horizon, number> = {
    14: d14.length,
    30: d30.length,
    60: d60.length,
    90: d90.length,
  };

  const metaLabel = meta.source
    ? `데이터 ${meta.source} · ${new Date(meta.importedAt).toISOString().slice(0, 10)} · ${meta.count.toLocaleString()}건`
    : "계약 데이터 없음";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[
          { label: "대시보드", href: "/dashboard" },
          { label: "계약만료 알람" },
        ]}
      />
      <main className={`flex-1 overflow-y-auto ${SPACE.pageX} ${SPACE.pageY}`}>
        <div className={`${SPACE.pageMaxW} ${SPACE.sectionGap} flex flex-col`}>
          <PageHeader
            eyebrow="CONTRACTS · EXPIRY"
            title="계약만료 알람"
            subtitle="입점업체 계약 만료가 임박한 건을 D-14/30/60/90 단위로 확인합니다. 이미 종료·자동연장 처리된 건은 제외."
            meta={metaLabel}
          />

          {meta.count === 0 ? (
            <div className="brutal bg-white p-8 text-center">
              <p className="font-mono text-[13px] text-[#0a0a0a]/70">
                Supabase <code className="bg-[#F1ECDB] px-1.5 py-0.5">tenant_contracts</code> 테이블이 비어있습니다.<br />
                로컬에서 <code className="bg-[#F1ECDB] px-1.5 py-0.5">contractdata/</code> 에 최신 TSV를 저장한 뒤{" "}
                <code className="bg-[#F1ECDB] px-1.5 py-0.5">npm run upload:contracts</code> 로 업로드하세요.
              </p>
            </div>
          ) : (
            <>
              <ExpiryFilters
                horizons={HORIZONS as unknown as number[]}
                bandCounts={bandCounts}
                allCount={meta.count}
                stores={stores}
                types={types}
                current={{ days, store, type }}
              />
              {days === "all" && meta.count > ALL_LIMIT && (
                <p className="font-mono text-[11px] text-[#0a0a0a]/55">
                  전체 {meta.count.toLocaleString()}건 중 {ALL_LIMIT.toLocaleString()}건만 표시 — 지점·계약형태로 좁혀 보세요.
                </p>
              )}
              <ExpiryTable rows={rows} />
            </>
          )}

          <AppFooter />
        </div>
      </main>
    </div>
  );
}

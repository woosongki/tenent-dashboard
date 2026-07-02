import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import TopBar from "@/components/layout/TopBar";
import PageHeader from "@/components/ui/PageHeader";
import AppFooter from "@/components/ui/AppFooter";
import { SPACE } from "@/lib/tokens";
import {
  getExpiringContracts,
  getTenantContractsMeta,
  getContractsBreakdown,
} from "@/lib/tenantContracts";
import ExpiryFilters from "./_components/ExpiryFilters";
import ExpiryTable from "./_components/ExpiryTable";

export const metadata: Metadata = { title: "계약만료 알람 — lifestyle" };

const HORIZONS = [14, 30, 60, 90] as const;
type Horizon = (typeof HORIZONS)[number];

function parseHorizon(v: string | string[] | undefined): Horizon {
  const n = Array.isArray(v) ? Number(v[0]) : Number(v);
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
  const days = parseHorizon(sp.days);
  const store = parseString(sp.store);
  const type = parseString(sp.type);

  const meta = getTenantContractsMeta();
  const breakdown = getContractsBreakdown();
  const rows = getExpiringContracts({ withinDays: days, storeName: store, contractType: type });

  const stores = Object.keys(breakdown.byStore).sort();
  const types = Object.keys(breakdown.byContractType);

  // 뱃지용 카운트: 필터 무시하고 D-14/30/60/90 전체 큰 그림
  const bandCounts: Record<Horizon, number> = {
    14: getExpiringContracts({ withinDays: 14 }).length,
    30: getExpiringContracts({ withinDays: 30 }).length,
    60: getExpiringContracts({ withinDays: 60 }).length,
    90: getExpiringContracts({ withinDays: 90 }).length,
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
                <code className="bg-[#F1ECDB] px-1.5 py-0.5">contractdata/tenant-contracts-master-*.tsv</code>{" "}
                파일이 없습니다. ERP 마스터를 해당 폴더에 저장한 뒤 서버를 재시작하세요.
              </p>
            </div>
          ) : (
            <>
              <ExpiryFilters
                horizons={HORIZONS as unknown as number[]}
                bandCounts={bandCounts}
                stores={stores}
                types={types}
                current={{ days, store, type }}
              />
              <ExpiryTable rows={rows} />
            </>
          )}

          <AppFooter />
        </div>
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllStores, type Store } from "@/lib/stores";
import { getFloorplanIndex, type FloorplanFile } from "@/lib/floorplans";
import TopBar from "@/components/layout/TopBar";

export const metadata: Metadata = { title: "전점도면" };

const BRAND_COLOR: Record<string, { bg: string; text: string; hex: string }> = {
  "NC백화점":    { bg: "bg-violet-50",  text: "text-violet-700",  hex: "#8b5cf6" },
  "뉴코아아울렛": { bg: "bg-rose-50",    text: "text-rose-700",    hex: "#f43f5e" },
  "2001아울렛":  { bg: "bg-emerald-50", text: "text-emerald-700", hex: "#10b981" },
  "동아백화점":  { bg: "bg-sky-50",     text: "text-sky-700",     hex: "#0ea5e9" },
};

export default async function FloorplansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const stores = getAllStores();
  const index  = getFloorplanIndex();

  const total      = stores.length;
  const registered = stores.filter((s) => index[s.id]).length;
  const pct        = total > 0 ? Math.round((registered / total) * 100) : 0;

  // 브랜드별 그룹핑
  const byBrand = stores.reduce<Record<string, Store[]>>((acc, s) => {
    (acc[s.brand] ??= []).push(s);
    return acc;
  }, {});
  const brandOrder = ["NC백화점", "뉴코아아울렛", "2001아울렛", "동아백화점"];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        crumbs={[{ label: "대시보드", href: "/dashboard" }, { label: "전점도면" }]}
      />
      <main className="flex-1 overflow-y-auto px-7 py-6 space-y-6">
        {/* 헤더 */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-[22px] font-extrabold tracking-tight text-slate-900">전점도면</h1>
            <p className="mt-1 text-[13px] text-slate-400">
              41개 점포의 매장 평면도를 한 곳에서 확인 — 카드 클릭 시 원본 보기
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-[#e8ecf0] bg-white px-4 py-2 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">도면 등록률</p>
              <p className="text-[15px] font-bold tabular-nums text-slate-800">
                {registered}<span className="text-slate-300"> / {total}</span>
                <span className="ml-1.5 text-[11px] font-semibold text-violet-600">{pct}%</span>
              </p>
            </div>
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 grid place-items-center">
              <div
                className="h-7 w-7 rounded-full"
                style={{
                  background: `conic-gradient(#8b5cf6 ${pct * 3.6}deg, #e2e8f0 0)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* 도면 미등록 안내 */}
        {registered === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
            <p className="font-semibold">도면 이미지가 아직 등록되지 않았습니다.</p>
            <p className="mt-1 text-amber-700">
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-amber-900">
                public/floorplans/{"{storeId}"}.png
              </code> 형식으로 파일을 추가하면 자동 표시됩니다.
              storeId는 아래 카드 우측 하단에 표시됩니다.
            </p>
          </div>
        )}

        {/* 브랜드별 섹션 */}
        {brandOrder.map((brand) => {
          const list = byBrand[brand];
          if (!list || list.length === 0) return null;
          const c = BRAND_COLOR[brand];
          const brandRegistered = list.filter((s) => index[s.id]).length;

          return (
            <section key={brand} className="space-y-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: c?.hex ?? "#94a3b8" }}
                />
                <h2 className="text-[14px] font-bold tracking-tight text-slate-800">{brand}</h2>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {brandRegistered}/{list.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((store) => (
                  <FloorplanCard
                    key={store.id}
                    store={store}
                    file={index[store.id]}
                    brandColor={c}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}

function FloorplanCard({
  store,
  file,
  brandColor,
}: {
  store: Store;
  file: FloorplanFile | undefined;
  brandColor: { bg: string; text: string; hex: string } | undefined;
}) {
  const has = Boolean(file);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-[#e8ecf0] bg-white shadow-[0_1px_3px_rgba(0,0,0,.04)] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,.08)]">
      {/* 미리보기 */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-50">
        {has && file ? (
          file.isPdf ? (
            <a
              href={file.publicPath}
              target="_blank"
              rel="noreferrer"
              className="flex h-full w-full flex-col items-center justify-center gap-1.5 transition-colors hover:bg-slate-100"
            >
              <svg className="h-8 w-8 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                <text x="10" y="14" textAnchor="middle" fontSize="6" fontWeight="bold" fill="white">PDF</text>
              </svg>
              <span className="text-[10px] text-slate-500">PDF · {file.sizeKB}KB</span>
            </a>
          ) : (
            <a href={file.publicPath} target="_blank" rel="noreferrer" className="block h-full w-full">
              <Image
                src={file.publicPath}
                alt={`${store.name} 도면`}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-contain transition-transform group-hover:scale-[1.02]"
                unoptimized
              />
            </a>
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-slate-300">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            <span className="text-[10px] font-medium">도면 미등록</span>
          </div>
        )}

        {/* 브랜드 칩 */}
        <span
          className={`absolute left-2 top-2 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${
            brandColor?.bg ?? "bg-slate-50"
          } ${brandColor?.text ?? "text-slate-600"}`}
        >
          {store.brand}
        </span>

        {/* 보기 버튼 (도면 있을 때) */}
        {has && file && !file.isPdf && (
          <div className="absolute bottom-2 right-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            원본 보기
          </div>
        )}
      </div>

      {/* 점포 정보 */}
      <div className="flex flex-col gap-1 p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="truncate text-[13px] font-bold text-slate-800">{store.name}</h3>
          {store.hasKimsclub && (
            <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[9px] font-medium text-amber-700">
              킴스클럽
            </span>
          )}
        </div>
        <p className="truncate text-[11px] text-slate-500">{store.address}</p>
        <div className="mt-0.5 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {store.region1} · {store.region2}
          </span>
          <code className="text-[9px] font-mono text-slate-300">{store.id}</code>
        </div>
      </div>
    </div>
  );
}

"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Tooltip,
  Polyline,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";

// 선택된 좌표로 지도를 부드럽게 이동시키는 헬퍼 컴포넌트.
// MapContainer 내부에 위치해야 useMap()이 동작함.
function FlyToTarget({
  target,
}: {
  target: { lat: number; lng: number; zoom?: number; key: string } | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? 13, {
      duration: 0.7,
      easeLinearity: 0.25,
    });
  }, [target, map]);
  return null;
}
import {
  HOMEPLUS_STORES,
  ELAND_STORES,
  TIER_COUNTS,
  TOTAL_BRANDS,
  type HomeplusStore,
  type Tier,
} from "@/data/homeplus";

const TIER_COLOR: Record<Tier, string> = {
  "동일상권": "#ef476f",
  "인접상권": "#ffb547",
  "근접권":   "#06d6a0",
  "별도상권": "#5a6378",
};

const TIER_LABEL: Record<Tier, string> = {
  "동일상권": "동일 (≤1km)",
  "인접상권": "인접 (1~3km)",
  "근접권":   "근접 (3~5km)",
  "별도상권": "별도",
};

const TIER_ORDER: Record<Tier, number> = {
  "동일상권": 0, "인접상권": 1, "근접권": 2, "별도상권": 3,
};

const ALL_TIERS: Tier[] = ["동일상권", "인접상권", "근접권", "별도상권"];

// 다이아몬드 모양 이랜드 마커
const elandIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#4cc9f0;border:2px solid #fff;transform:rotate(45deg);box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

type FlyTarget = { lat: number; lng: number; zoom?: number; key: string };

export default function HomeplusMapClient() {
  const [activeTiers, setActiveTiers] = useState<Set<Tier>>(new Set(ALL_TIERS));
  const [selected, setSelected] = useState<HomeplusStore | null>(null);
  const [showLines, setShowLines] = useState(true);
  const [showEland, setShowEland] = useState(true);
  // 클릭한 점포 좌표로 지도 이동 트리거. key를 매번 새로 만들어 같은 점포 재클릭도 동작.
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);

  function selectHomeplus(s: HomeplusStore) {
    setSelected(s);
    setFlyTarget({ lat: s.lat, lng: s.lng, zoom: 13, key: `hp-${s.name}-${Date.now()}` });
  }
  function flyToEland(id: number) {
    const e = ELAND_STORES.find((x) => x.id === id);
    if (!e) return;
    setFlyTarget({ lat: e.lat, lng: e.lng, zoom: 14, key: `el-${e.id}-${Date.now()}` });
  }

  const filtered = useMemo(
    () => HOMEPLUS_STORES.filter((s) => activeTiers.has(s.tier)),
    [activeTiers],
  );

  const sortedAll = useMemo(
    () =>
      [...HOMEPLUS_STORES].sort(
        (a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier] || a.distance - b.distance,
      ),
    [],
  );

  function toggleTier(t: Tier) {
    const next = new Set(activeTiers);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setActiveTiers(next);
  }

  return (
    <div className="flex h-full w-full bg-[#FAF7EC]">
      {/* ── 좌측 이슈 리스트 ── */}
      <aside className="hidden w-[300px] shrink-0 flex-col border-r-[3px] border-[#0a0a0a] bg-white md:flex">
        <div className="border-b-[3px] border-[#0a0a0a] px-4 py-3">
          <div className="font-display text-[18px] leading-none text-[#0a0a0a]">
            홈플 영업중단 33점
          </div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">
            총 {TOTAL_BRANDS}개 브랜드
          </div>
        </div>

        {/* tier 필터 */}
        <div className="border-b-[2px] border-[#0a0a0a] p-3">
          <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500">
            상권 필터
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_TIERS.map((t) => {
              const active = activeTiers.has(t);
              return (
                <button
                  key={t}
                  onClick={() => toggleTier(t)}
                  className={`flex items-center gap-1.5 border-[2px] border-[#0a0a0a] px-2 py-1 text-[10.5px] font-bold transition ${
                    active ? "bg-yellow-300 text-[#0a0a0a]" : "bg-white text-slate-400"
                  }`}
                  style={{ boxShadow: active ? "2px 2px 0 0 #0a0a0a" : "none" }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: TIER_COLOR[t] }}
                  />
                  {TIER_LABEL[t]}
                  <span className="font-mono text-[10px] opacity-60">
                    {TIER_COUNTS[t]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-3 text-[11px]">
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={showEland}
                onChange={(e) => setShowEland(e.target.checked)}
                className="h-3.5 w-3.5 accent-cyan-400"
              />
              <span className="font-bold text-[#0a0a0a]">이랜드 점포</span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={showLines}
                onChange={(e) => setShowLines(e.target.checked)}
                className="h-3.5 w-3.5 accent-yellow-400"
              />
              <span className="font-bold text-[#0a0a0a]">매칭선</span>
            </label>
          </div>
        </div>

        {/* 점포 카드 리스트 */}
        <div className="flex-1 overflow-y-auto p-2">
          {sortedAll
            .filter((s) => activeTiers.has(s.tier))
            .map((s) => {
              const isSel = selected?.name === s.name;
              return (
                <button
                  key={s.name}
                  onClick={() => selectHomeplus(s)}
                  className={`mb-1.5 block w-full border-[2px] border-[#0a0a0a] bg-white p-2.5 text-left transition hover:bg-yellow-50 ${
                    isSel ? "bg-yellow-100" : ""
                  }`}
                  style={{
                    boxShadow: isSel
                      ? "3px 3px 0 0 #0a0a0a"
                      : "2px 2px 0 0 #0a0a0a",
                    borderLeftWidth: 4,
                    borderLeftColor: TIER_COLOR[s.tier],
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold text-[#0a0a0a]">
                        {s.name}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-500">
                        → {s.eland_brand} {s.eland_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[11px] font-bold text-[#0a0a0a]">
                        {s.distance.toFixed(2)}km
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {s.total_brands}브랜드
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
        </div>
      </aside>

      {/* ── 지도 + 우측 상세 ── */}
      <div className="relative flex-1">
        <MapContainer
          center={[36.5, 127.8]}
          zoom={7}
          className="h-full w-full"
          style={{ background: "#e6e2d5" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* 매칭 라인 */}
          {showLines &&
            filtered
              .filter((s) => s.tier !== "별도상권")
              .map((s) => {
                const el = ELAND_STORES.find((e) => e.id === s.eland_id);
                if (!el) return null;
                return (
                  <Polyline
                    key={`line-${s.name}`}
                    positions={[
                      [s.lat, s.lng],
                      [el.lat, el.lng],
                    ]}
                    pathOptions={{
                      color: TIER_COLOR[s.tier],
                      weight: s.tier === "동일상권" ? 3 : 2,
                      opacity: 0.6,
                      dashArray: s.tier === "근접권" ? "4,6" : undefined,
                    }}
                  />
                );
              })}

          {/* 홈플 마커 */}
          {filtered.map((s) => {
            const radius = 8 + Math.min(s.total_brands, 18) / 1.5;
            const isSel = selected?.name === s.name;
            return (
              <CircleMarker
                key={s.name}
                center={[s.lat, s.lng]}
                radius={radius}
                pathOptions={{
                  color: isSel ? "#ffd166" : "#fff",
                  weight: isSel ? 3 : 2,
                  fillColor: TIER_COLOR[s.tier],
                  fillOpacity: 0.9,
                }}
                eventHandlers={{
                  click: () => selectHomeplus(s),
                }}
              >
                <Tooltip direction="top" offset={[0, -radius]}>
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      홈플 {s.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                      {TIER_LABEL[s.tier]} · {s.distance.toFixed(2)}km
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      <b>{s.total_brands}</b>개 브랜드 ·{" "}
                      {s.categories.length}개 카테고리
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* 이랜드 마커 */}
          {showEland &&
            ELAND_STORES.map((e) => (
              <Marker
                key={`eland-${e.id}`}
                position={[e.lat, e.lng]}
                icon={elandIcon}
                eventHandlers={{
                  click: () => flyToEland(e.id),
                }}
              >
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: "#0891b2" }}>
                      이랜드 · {e.brand}
                    </div>
                    <div style={{ fontSize: 12 }}>{e.name}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>
                      📍 {e.addr}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          {/* 클릭한 점포로 지도 이동 */}
          <FlyToTarget target={flyTarget} />
        </MapContainer>

        {/* 범례 (좌하단) */}
        <div
          className="absolute bottom-4 left-4 z-[400] border-[2px] border-[#0a0a0a] bg-white p-3"
          style={{ boxShadow: "3px 3px 0 0 #0a0a0a" }}
        >
          <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-500">
            범례
          </div>
          {ALL_TIERS.map((t) => (
            <div key={t} className="mb-1 flex items-center gap-2 text-[11px]">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full border border-white"
                style={{ background: TIER_COLOR[t] }}
              />
              <span className="font-bold text-[#0a0a0a]">{TIER_LABEL[t]}</span>
              <span className="ml-auto font-mono text-[10px] text-slate-500">
                {TIER_COUNTS[t]}
              </span>
            </div>
          ))}
          <div className="mt-1.5 flex items-center gap-2 border-t border-slate-200 pt-1.5 text-[11px]">
            <span
              className="inline-block h-2 w-2 rotate-45 border border-white"
              style={{ background: "#4cc9f0" }}
            />
            <span className="font-bold text-[#0a0a0a]">이랜드 41점</span>
          </div>
          <div className="mt-2 text-[9.5px] leading-tight text-slate-500">
            ※ 원 크기 = 입점 브랜드 수
          </div>
        </div>

        {/* 우측 상세 패널 */}
        {selected && (
          <div
            className="absolute right-4 top-4 z-[400] max-h-[calc(100%-2rem)] w-[320px] overflow-y-auto border-[3px] border-[#0a0a0a] bg-white"
            style={{ boxShadow: "5px 5px 0 0 #0a0a0a" }}
          >
            <div className="border-b-[2px] border-[#0a0a0a] p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div
                    className="inline-block border-[1.5px] border-[#0a0a0a] px-2 py-0.5 text-[9.5px] font-extrabold uppercase tracking-wider"
                    style={{
                      background: TIER_COLOR[selected.tier],
                      color: selected.tier === "별도상권" ? "#fff" : "#0a0a0a",
                    }}
                  >
                    {TIER_LABEL[selected.tier]}
                  </div>
                  <div className="mt-1.5 font-display text-[20px] leading-tight text-[#0a0a0a]">
                    홈플 {selected.name}
                  </div>
                  <div className="mt-0.5 text-[10.5px] text-slate-500">
                    📍 {selected.addr}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="border-[2px] border-[#0a0a0a] bg-white px-1.5 py-0.5 text-[11px] font-bold hover:bg-yellow-200"
                  style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
                >
                  ✕
                </button>
              </div>

              <button
                type="button"
                onClick={() => flyToEland(selected.eland_id)}
                className="mt-2.5 block w-full border-[2px] border-[#0a0a0a] bg-cyan-50 p-2 text-left transition hover:bg-cyan-100"
                style={{ boxShadow: "2px 2px 0 0 #0a0a0a" }}
                title="이랜드 점포 위치로 지도 이동"
              >
                <div className="flex items-center justify-between text-[9px] font-extrabold uppercase tracking-wider text-slate-500">
                  <span>최근접 이랜드 (클릭 시 이동)</span>
                  <span>→</span>
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[12px]">
                  <span>
                    <b className="text-cyan-700">{selected.eland_brand}</b>{" "}
                    {selected.eland_name}
                  </span>
                  <span className="font-mono text-[12px] font-extrabold text-[#0a0a0a]">
                    {selected.distance.toFixed(2)}km
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-slate-500">
                  {selected.eland_addr}
                </div>
              </button>
            </div>

            <div className="p-3">
              <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-500">
                입점 브랜드 (총 {selected.total_brands})
              </div>
              {selected.categories.map((c) => (
                <div
                  key={c.category}
                  className="mb-1.5 border-[2px] border-[#0a0a0a] bg-white"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-2.5 py-1.5">
                    <div className="text-[11.5px] font-bold text-[#0a0a0a]">
                      {c.category}
                    </div>
                    <div className="border-[1.5px] border-[#0a0a0a] bg-yellow-200 px-1.5 font-mono text-[10px] font-extrabold">
                      {c.count}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 p-2">
                    {c.brands.map((b) => (
                      <span
                        key={b}
                        className="border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-700"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

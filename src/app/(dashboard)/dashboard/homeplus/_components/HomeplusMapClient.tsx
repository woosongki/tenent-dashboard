"use client";

import "leaflet/dist/leaflet.css";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Tooltip,
  Polyline,
  Popup,
  useMapEvents,
} from "react-leaflet";
import FlyToTarget, { type FlyTarget } from "./FlyToTarget";
import { nearestEland, type NearestEland } from "./nearestEland";
import type { ChainStore } from "@/data/artbox";
import type { Icon, DivIcon } from "leaflet";
import {
  TIER_COLOR,
  TIER_LABEL,
  TIER_ORDER,
  ALL_TIERS,
  elandIcon,
  artboxIcon,
  daisoIcon,
  oliveyoungIcon,
  lotteIcon,
  hyundaiIcon,
  shinsegaeIcon,
  akIcon,
  galleriaIcon,
  entersixIcon,
  modaIcon,
  savezoneIcon,
  lfIcon,
  spaoIcon,
  mixxoIcon,
  modernhouseIcon,
  abcmartIcon,
  eightsecondsIcon,
  mujiIcon,
  hanssemIcon,
  livartIcon,
  iloomIcon,
  nitoriIcon,
  uniqloIcon,
  emartIcon,
  lottemartIcon,
  hanaromartIcon,
} from "./mapIcons";
import {
  HOMEPLUS_STORES,
  ELAND_STORES,
  TIER_COUNTS,
  TOTAL_BRANDS,
  type HomeplusStore,
  type Tier,
} from "@/data/homeplus";
import { ARTBOX_STORES } from "@/data/artbox";
import { DAISO_STORES } from "@/data/daiso";
import { OLIVEYOUNG_STORES } from "@/data/oliveyoung";
import { LOTTE_STORES } from "@/data/lotte";
import { HYUNDAI_STORES } from "@/data/hyundai";
import { SHINSEGAE_STORES } from "@/data/shinsegae";
import { AK_STORES } from "@/data/ak";
import { GALLERIA_STORES } from "@/data/galleria";
// ── 그 외 ──
import { ENTERSIX_STORES } from "@/data/entersix";
import { MODA_STORES } from "@/data/moda";
import { SAVEZONE_STORES } from "@/data/savezone";
import { LF_STORES } from "@/data/lf";
import { MODERNHOUSE_STORES } from "@/data/modernhouse";
import { SPAO_STORES } from "@/data/spao";
import { MIXXO_STORES } from "@/data/mixxo";
import { ABCMART_STORES } from "@/data/abcmart";
import { EIGHTSECONDS_STORES } from "@/data/eightseconds";
import { MUJI_STORES } from "@/data/muji";
import { HANSSEM_STORES } from "@/data/hanssem";
import { LIVART_STORES } from "@/data/livart";
import { ILOOM_STORES } from "@/data/iloom";
import { NITORI_STORES } from "@/data/nitori";
import { UNIQLO_STORES } from "@/data/uniqlo";
// ── 마트 ──
import { EMART_STORES } from "@/data/emart";
import { LOTTEMART_STORES } from "@/data/lottemart";
import { HANAROMART_STORES } from "@/data/hanaromart";

// 거리(km) → 상권 tier. 홈플 데이터(tier 사전계산)와 같은 임계값 사용.
function tierFromDistance(km: number): Tier {
  if (km <= 1) return "동일상권";
  if (km <= 3) return "인접상권";
  if (km <= 5) return "근접권";
  return "별도상권";
}

export default function HomeplusMapClient() {
  // URL ?layer=X 로 진입한 체인 레이어 자동 활성화 (사이드바 하위 메뉴)
  const searchParams = useSearchParams();
  const initialLayer = searchParams?.get("layer") ?? "";

  // 상권 필터는 항상 4개 tier 기본 ON — 홈플/타 체인 매장 모두에 동일하게 적용.
  // 홈플 33점 가시성은 별도 토글(showHomeplus)로 분리 → 마트 섹션 체크박스로 단독 제어.
  const [activeTiers, setActiveTiers] = useState<Set<Tier>>(new Set(ALL_TIERS));
  const [showHomeplus, setShowHomeplus] = useState(initialLayer === "homeplus");
  const [selected, setSelected] = useState<HomeplusStore | null>(null);
  const [showLines, setShowLines] = useState(true);
  const [showEland, setShowEland] = useState(true);
  // 체인 레이어 — URL에 layer 파라미터 있으면 해당 레이어만 ON
  const [showArtbox, setShowArtbox] = useState(initialLayer === "artbox");
  const [showDaiso, setShowDaiso] = useState(initialLayer === "daiso");
  const [showOliveYoung, setShowOliveYoung] = useState(initialLayer === "oliveyoung");
  const [showLotte, setShowLotte] = useState(initialLayer === "lotte");
  const [showHyundai, setShowHyundai] = useState(initialLayer === "hyundai");
  const [showShinsegae, setShowShinsegae] = useState(initialLayer === "shinsegae");
  const [showAk, setShowAk] = useState(initialLayer === "ak");
  const [showGalleria, setShowGalleria] = useState(initialLayer === "galleria");
  // 패널 섹션 접기 상태 (체인/백화점/그외/마트)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  function toggleSection(key: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // 그 외
  const [showEntersix, setShowEntersix] = useState(initialLayer === "entersix");
  const [showModa, setShowModa] = useState(initialLayer === "moda");
  const [showSavezone, setShowSavezone] = useState(initialLayer === "savezone");
  const [showLf, setShowLf] = useState(initialLayer === "lf");
  const [showSpao, setShowSpao] = useState(initialLayer === "spao");
  const [showMixxo, setShowMixxo] = useState(initialLayer === "mixxo");
  const [showModernhouse, setShowModernhouse] = useState(initialLayer === "modernhouse");
  const [showAbcmart, setShowAbcmart] = useState(initialLayer === "abcmart");
  const [showEightseconds, setShowEightseconds] = useState(initialLayer === "8seconds");
  const [showMuji, setShowMuji] = useState(initialLayer === "muji");
  const [showHanssem, setShowHanssem] = useState(initialLayer === "hanssem");
  const [showLivart, setShowLivart] = useState(initialLayer === "livart");
  const [showIloom, setShowIloom] = useState(initialLayer === "iloom");
  const [showNitori, setShowNitori] = useState(initialLayer === "nitori");
  const [showUniqlo, setShowUniqlo] = useState(initialLayer === "uniqlo");
  // 마트
  const [showEmart, setShowEmart] = useState(initialLayer === "emart");
  const [showLottemart, setShowLottemart] = useState(initialLayer === "lottemart");
  const [showHanaromart, setShowHanaromart] = useState(initialLayer === "hanaromart");

  // 출점 공백지 발굴: 반경 N km 이내 이랜드 점포가 없는 체인 매장만 표시
  const [gapMode, setGapMode] = useState(false);
  const [gapRadius, setGapRadius] = useState(5);  // km
  // 모바일 필터 드로어
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // 사이드바 하위 메뉴 클릭으로 layer가 바뀌면 가시성 토글을 그 레이어로 리셋.
  // (effect 대신 React 권장 "prop 변경 시 렌더 중 보정" 패턴 — 동기 setState/cascading render 회피)
  // activeTiers는 사용자가 직접 조정한 상태를 보존(레이어 전환 시 리셋 안 함).
  const [prevLayer, setPrevLayer] = useState(initialLayer);
  if (initialLayer !== prevLayer) {
    setPrevLayer(initialLayer);
    setShowHomeplus(initialLayer === "homeplus");
    setShowArtbox(initialLayer === "artbox");
    setShowDaiso(initialLayer === "daiso");
    setShowOliveYoung(initialLayer === "oliveyoung");
    setShowLotte(initialLayer === "lotte");
    setShowHyundai(initialLayer === "hyundai");
    setShowShinsegae(initialLayer === "shinsegae");
    setShowAk(initialLayer === "ak");
    setShowGalleria(initialLayer === "galleria");
    setShowEntersix(initialLayer === "entersix");
    setShowModa(initialLayer === "moda");
    setShowSavezone(initialLayer === "savezone");
    setShowLf(initialLayer === "lf");
    setShowSpao(initialLayer === "spao");
    setShowMixxo(initialLayer === "mixxo");
    setShowModernhouse(initialLayer === "modernhouse");
    setShowAbcmart(initialLayer === "abcmart");
    setShowEightseconds(initialLayer === "8seconds");
    setShowMuji(initialLayer === "muji");
    setShowHanssem(initialLayer === "hanssem");
    setShowLivart(initialLayer === "livart");
    setShowIloom(initialLayer === "iloom");
    setShowNitori(initialLayer === "nitori");
    setShowUniqlo(initialLayer === "uniqlo");
    setShowEmart(initialLayer === "emart");
    setShowLottemart(initialLayer === "lottemart");
    setShowHanaromart(initialLayer === "hanaromart");
  }
  // 클릭한 점포 좌표로 지도 이동 트리거. key를 매번 새로 만들어 같은 점포 재클릭도 동작.
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  // 고유 key 생성용 단조 증가 카운터 (렌더 순수성 위해 Date.now() 대신 ref 사용)
  const flyKeySeq = useRef(0);

  function selectHomeplus(s: HomeplusStore) {
    setSelected(s);
    setFlyTarget({ lat: s.lat, lng: s.lng, zoom: 13, key: `hp-${s.name}-${++flyKeySeq.current}` });
  }
  function flyToEland(id: number) {
    const e = ELAND_STORES.find((x) => x.id === id);
    if (!e) return;
    setFlyTarget({ lat: e.lat, lng: e.lng, zoom: 14, key: `el-${e.id}-${++flyKeySeq.current}` });
  }

  const filtered = useMemo(
    () =>
      showHomeplus
        ? HOMEPLUS_STORES.filter((s) => activeTiers.has(s.tier))
        : [],
    [activeTiers, showHomeplus],
  );

  // 체인/백화점/그외/마트 매장 통합 처리: 가시성 + 최근접 이랜드 거리 + tier 계산 + 상권필터/공백지필터 적용.
  // 결과는 마커/매칭선 양쪽에서 공유.
  const chainLayers = useMemo(() => {
    const cfgs = [
      { show: showArtbox,      stores: ARTBOX_STORES,      icon: artboxIcon,      color: "#c1166b", emoji: "🎨", k: "artbox", off: 5 },
      { show: showDaiso,       stores: DAISO_STORES,       icon: daisoIcon,       color: "#b88a00", emoji: "🛒", k: "daiso", off: 5 },
      { show: showOliveYoung,  stores: OLIVEYOUNG_STORES,  icon: oliveyoungIcon,  color: "#2d6a4f", emoji: "💄", k: "oy", off: 5 },
      { show: showLotte,       stores: LOTTE_STORES,       icon: lotteIcon,       color: "#a4133c", emoji: "🏬", k: "lotte", off: 8, dbNote: true },
      { show: showHyundai,     stores: HYUNDAI_STORES,     icon: hyundaiIcon,     color: "#1d3557", emoji: "🏬", k: "hyundai", off: 8, dbNote: true },
      { show: showShinsegae,   stores: SHINSEGAE_STORES,   icon: shinsegaeIcon,   color: "#495057", emoji: "🏬", k: "ss", off: 8, dbNote: true },
      { show: showAk,          stores: AK_STORES,          icon: akIcon,          color: "#6f1d77", emoji: "🏬", k: "ak", off: 8, dbNote: true },
      { show: showGalleria,    stores: GALLERIA_STORES,    icon: galleriaIcon,    color: "#2d5016", emoji: "🏬", k: "gl", off: 8, dbNote: true },
      { show: showEntersix,    stores: ENTERSIX_STORES,    icon: entersixIcon,    color: "#cc5429", emoji: "", k: "es", off: 4 },
      { show: showModa,        stores: MODA_STORES,        icon: modaIcon,        color: "#007a6e", emoji: "", k: "md", off: 4 },
      { show: showSavezone,    stores: SAVEZONE_STORES,    icon: savezoneIcon,    color: "#6e7a2e", emoji: "", k: "sv", off: 4 },
      { show: showLf,          stores: LF_STORES,          icon: lfIcon,          color: "#6e5538", emoji: "🛍️", k: "lf", off: 4 },
      { show: showSpao,        stores: SPAO_STORES,        icon: spaoIcon,        color: "#0b3d91", emoji: "👕", k: "spao", off: 4 },
      { show: showMixxo,       stores: MIXXO_STORES,       icon: mixxoIcon,       color: "#e6007e", emoji: "👗", k: "mixxo", off: 4 },
      { show: showModernhouse, stores: MODERNHOUSE_STORES, icon: modernhouseIcon, color: "#6a2c70", emoji: "🏡", k: "mh", off: 4 },
      { show: showAbcmart,     stores: ABCMART_STORES,     icon: abcmartIcon,     color: "#c1121f", emoji: "👟", k: "abc", off: 4 },
      { show: showEightseconds,stores: EIGHTSECONDS_STORES,icon: eightsecondsIcon,color: "#b58000", emoji: "👕", k: "8s", off: 4 },
      { show: showMuji,        stores: MUJI_STORES,        icon: mujiIcon,        color: "#6f4e37", emoji: "🛒", k: "muji", off: 4 },
      { show: showHanssem,     stores: HANSSEM_STORES,     icon: hanssemIcon,     color: "#1e5fa3", emoji: "🛋️", k: "hs", off: 4 },
      { show: showLivart,      stores: LIVART_STORES,      icon: livartIcon,      color: "#be185d", emoji: "🛋️", k: "lv", off: 4 },
      { show: showIloom,       stores: ILOOM_STORES,       icon: iloomIcon,       color: "#a16207", emoji: "🛋️", k: "il", off: 4 },
      { show: showNitori,      stores: NITORI_STORES,      icon: nitoriIcon,      color: "#c2410c", emoji: "🏡", k: "nt", off: 4 },
      { show: showUniqlo,      stores: UNIQLO_STORES,      icon: uniqloIcon,      color: "#9f1239", emoji: "👕", k: "uq", off: 4 },
      { show: showEmart,       stores: EMART_STORES,       icon: emartIcon,       color: "#b88a00", emoji: "🛒", k: "em", off: 6 },
      { show: showLottemart,   stores: LOTTEMART_STORES,   icon: lottemartIcon,   color: "#a01a1a", emoji: "🛒", k: "lm", off: 6 },
      { show: showHanaromart,  stores: HANAROMART_STORES,  icon: hanaromartIcon,  color: "#1f4d3a", emoji: "🛒", k: "hm", off: 6 },
    ] as ChainLayerCfg[];
    return cfgs.map((c) => {
      if (!c.show) return { cfg: c, items: [] as EnrichedChainItem[] };
      const items: EnrichedChainItem[] = [];
      for (const s of c.stores) {
        const near = nearestEland(s.lat, s.lng);
        const tier: Tier = near ? tierFromDistance(near.distanceKm) : "별도상권";
        if (!activeTiers.has(tier)) continue;
        if (gapMode && near && near.distanceKm <= gapRadius) continue;
        items.push({ store: s, near, tier });
      }
      return { cfg: c, items };
    });
  }, [
    showArtbox, showDaiso, showOliveYoung,
    showLotte, showHyundai, showShinsegae, showAk, showGalleria,
    showEntersix, showModa, showSavezone, showLf, showSpao, showMixxo, showModernhouse,
    showAbcmart, showEightseconds,
    showMuji, showHanssem, showLivart, showIloom, showNitori, showUniqlo,
    showEmart, showLottemart, showHanaromart,
    activeTiers, gapMode, gapRadius,
  ]);

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
    <div className="relative flex h-full w-full bg-[#FAF7EC]">
      {/* 모바일 필터 오버레이 배경 */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-[1500] bg-black/40 md:hidden" onClick={() => setMobileFilterOpen(false)} aria-hidden />
      )}

      {/* ── 좌측 이슈 리스트 (모바일=드로어) ── */}
      <aside
        className={`flex flex-col border-r-[3px] border-[#0a0a0a] bg-white
          md:static md:w-[300px] md:shrink-0 md:translate-x-0
          fixed inset-y-0 left-0 z-[1600] w-[85%] max-w-[340px] transition-transform duration-300
          ${mobileFilterOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        <div className="flex items-center justify-between border-b-[3px] border-[#0a0a0a] px-4 py-3">
          <div>
            <div className="font-display text-[18px] leading-none text-[#0a0a0a]">
              리테일 지도
            </div>
            <div className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-slate-500">
              상권 분석 · 이랜드 매칭
            </div>
          </div>
          <button onClick={() => setMobileFilterOpen(false)}
            className="md:hidden border-[2px] border-[#0a0a0a] bg-white px-2 py-1 text-[12px] font-bold" aria-label="닫기">✕</button>
        </div>

        {/* 헤더 제외 본문 전체를 하나의 스크롤 영역으로 — 레이어 섹션이 길어져도 끝까지 스크롤 */}
        <div className="flex-1 min-h-0 overflow-y-auto">

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

          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
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

        {/* 출점 공백지 발굴 모드 */}
        <div className="border-b-[2px] border-[#0a0a0a] bg-yellow-50 p-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={gapMode}
              onChange={(e) => setGapMode(e.target.checked)}
              className="h-4 w-4 accent-rose-500"
            />
            <span className="text-[12px] font-extrabold text-[#0a0a0a]">🎯 출점 공백지 모드</span>
          </label>
          {gapMode && (
            <div className="mt-2 flex items-center gap-2 text-[11px]">
              <span className="text-slate-600">이랜드 반경</span>
              <div className="flex gap-1">
                {[3, 5, 10].map((r) => (
                  <button
                    key={r}
                    onClick={() => setGapRadius(r)}
                    className={`border-[2px] border-[#0a0a0a] px-2 py-0.5 font-bold transition ${
                      gapRadius === r ? "bg-rose-400 text-white" : "bg-white hover:bg-rose-50"
                    }`}
                  >
                    {r}km
                  </button>
                ))}
              </div>
              <span className="text-slate-500">밖 매장만</span>
            </div>
          )}
          {gapMode && (
            <p className="mt-1.5 text-[10px] leading-tight text-slate-500">
              💡 켠 체인 중 이랜드 점포 {gapRadius}km 이내에 없는 매장만 표시 → 미입점 상권 발굴
            </p>
          )}
        </div>

        {/* 체인 매장 레이어 — 별도 섹션 */}
        <div className="border-b-[2px] border-[#0a0a0a] p-3">
          <button
            type="button"
            onClick={() => toggleSection("chain")}
            className="mb-2 flex w-full items-center gap-1 text-left text-[10px] font-extrabold uppercase tracking-[.14em] text-slate-500 hover:text-slate-700"
          >
            <span className={`inline-block transition-transform ${collapsedSections.has("chain") ? "-rotate-90" : ""}`}>▾</span>
            <span className="flex-1">체인 매장 (opt-in)</span>
          </button>
          {!collapsedSections.has("chain") && (
          <div className="flex flex-col gap-1.5 text-[11px]">
            <label className="flex cursor-pointer items-center gap-1.5" title={ARTBOX_STORES.length === 0 ? "수집 필요" : `전국 ${ARTBOX_STORES.length}개 매장`}>
              <input
                type="checkbox"
                checked={showArtbox}
                onChange={(e) => setShowArtbox(e.target.checked)}
                disabled={ARTBOX_STORES.length === 0}
                className="h-3.5 w-3.5 accent-pink-500 disabled:opacity-40"
              />
              <span className="inline-block h-2 w-2" style={{ background: "#f72585" }} />
              <span className={`font-bold ${ARTBOX_STORES.length === 0 ? "text-slate-400 line-through" : "text-[#0a0a0a]"}`}>
                아트박스 {ARTBOX_STORES.length > 0 && `(${ARTBOX_STORES.length})`}
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5" title={DAISO_STORES.length === 0 ? "수집 필요" : `전국 ${DAISO_STORES.length}개 매장`}>
              <input
                type="checkbox"
                checked={showDaiso}
                onChange={(e) => setShowDaiso(e.target.checked)}
                disabled={DAISO_STORES.length === 0}
                className="h-3.5 w-3.5 accent-yellow-400 disabled:opacity-40"
              />
              <span className="inline-block h-2 w-2" style={{ background: "#f9c74f" }} />
              <span className={`font-bold ${DAISO_STORES.length === 0 ? "text-slate-400 line-through" : "text-[#0a0a0a]"}`}>
                다이소 {DAISO_STORES.length > 0 && `(${DAISO_STORES.length})`}
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5" title={OLIVEYOUNG_STORES.length === 0 ? "수집 필요" : `전국 ${OLIVEYOUNG_STORES.length}개 매장`}>
              <input
                type="checkbox"
                checked={showOliveYoung}
                onChange={(e) => setShowOliveYoung(e.target.checked)}
                disabled={OLIVEYOUNG_STORES.length === 0}
                className="h-3.5 w-3.5 accent-green-500 disabled:opacity-40"
              />
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#52b788" }} />
              <span className={`font-bold ${OLIVEYOUNG_STORES.length === 0 ? "text-slate-400 line-through" : "text-[#0a0a0a]"}`}>
                올리브영 {OLIVEYOUNG_STORES.length > 0 && `(${OLIVEYOUNG_STORES.length})`}
              </span>
            </label>
          </div>
          )}

          {/* 백화점 3사 */}
          <div className="mt-3 border-t border-slate-200 pt-2">
            <button
              type="button"
              onClick={() => toggleSection("dept")}
              className="mb-1.5 flex w-full items-center gap-1 text-left text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-500 hover:text-slate-700"
            >
              <span className={`inline-block transition-transform ${collapsedSections.has("dept") ? "-rotate-90" : ""}`}>▾</span>
              <span className="flex-1">백화점</span>
            </button>
            {!collapsedSections.has("dept") && (
            <div className="flex flex-col gap-1.5 text-[11px]">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showLotte}
                  onChange={(e) => setShowLotte(e.target.checked)}
                  disabled={LOTTE_STORES.length === 0}
                  className="h-3.5 w-3.5 disabled:opacity-40"
                />
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[8px] font-black text-white" style={{ background: "#a4133c" }}>L</span>
                <span className="font-bold text-[#0a0a0a]">롯데백화점 ({LOTTE_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showHyundai}
                  onChange={(e) => setShowHyundai(e.target.checked)}
                  disabled={HYUNDAI_STORES.length === 0}
                  className="h-3.5 w-3.5 disabled:opacity-40"
                />
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[8px] font-black text-white" style={{ background: "#1d3557" }}>H</span>
                <span className="font-bold text-[#0a0a0a]">현대백화점 ({HYUNDAI_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showShinsegae}
                  onChange={(e) => setShowShinsegae(e.target.checked)}
                  disabled={SHINSEGAE_STORES.length === 0}
                  className="h-3.5 w-3.5 disabled:opacity-40"
                />
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[8px] font-black text-white" style={{ background: "#495057" }}>S</span>
                <span className="font-bold text-[#0a0a0a]">신세계백화점 ({SHINSEGAE_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showAk}
                  onChange={(e) => setShowAk(e.target.checked)}
                  disabled={AK_STORES.length === 0}
                  className="h-3.5 w-3.5 disabled:opacity-40"
                />
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[7px] font-black text-white" style={{ background: "#6f1d77" }}>AK</span>
                <span className="font-bold text-[#0a0a0a]">AK백화점 ({AK_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showGalleria}
                  onChange={(e) => setShowGalleria(e.target.checked)}
                  disabled={GALLERIA_STORES.length === 0}
                  className="h-3.5 w-3.5 disabled:opacity-40"
                />
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center text-[8px] font-black text-white" style={{ background: "#2d5016" }}>G</span>
                <span className="font-bold text-[#0a0a0a]">갤러리아 ({GALLERIA_STORES.length})</span>
              </label>
            </div>
            )}
          </div>

          {/* 그 외 */}
          <div className="mt-3 border-t border-slate-200 pt-2">
            <button
              type="button"
              onClick={() => toggleSection("other")}
              className="mb-1.5 flex w-full items-center gap-1 text-left text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-500 hover:text-slate-700"
            >
              <span className={`inline-block transition-transform ${collapsedSections.has("other") ? "-rotate-90" : ""}`}>▾</span>
              <span className="flex-1">그 외</span>
            </button>
            {!collapsedSections.has("other") && (
            <div className="flex flex-col gap-1.5 text-[11px]">
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showEntersix} onChange={(e) => setShowEntersix(e.target.checked)} disabled={ENTERSIX_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#ff6f3c" }} />
                <span className="font-bold text-[#0a0a0a]">엔터식스 ({ENTERSIX_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showModa} onChange={(e) => setShowModa(e.target.checked)} disabled={MODA_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#00b4a0" }} />
                <span className="font-bold text-[#0a0a0a]">모다아울렛 ({MODA_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showSavezone} onChange={(e) => setShowSavezone(e.target.checked)} disabled={SAVEZONE_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#95a847" }} />
                <span className="font-bold text-[#0a0a0a]">세이브존 ({SAVEZONE_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showLf} onChange={(e) => setShowLf(e.target.checked)} disabled={LF_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#a08260" }} />
                <span className="font-bold text-[#0a0a0a]">LF스퀘어 ({LF_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showSpao} onChange={(e) => setShowSpao(e.target.checked)} disabled={SPAO_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#0b3d91" }} />
                <span className="font-bold text-[#0a0a0a]">스파오 ({SPAO_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showMixxo} onChange={(e) => setShowMixxo(e.target.checked)} disabled={MIXXO_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#e6007e" }} />
                <span className="font-bold text-[#0a0a0a]">미쏘 ({MIXXO_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showModernhouse} onChange={(e) => setShowModernhouse(e.target.checked)} disabled={MODERNHOUSE_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#6a2c70" }} />
                <span className="font-bold text-[#0a0a0a]">모던하우스 ({MODERNHOUSE_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showAbcmart} onChange={(e) => setShowAbcmart(e.target.checked)} disabled={ABCMART_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#e63946" }} />
                <span className="font-bold text-[#0a0a0a]">ABC마트 ({ABCMART_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showEightseconds} onChange={(e) => setShowEightseconds(e.target.checked)} disabled={EIGHTSECONDS_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#fbbf24" }} />
                <span className="font-bold text-[#0a0a0a]">에잇세컨즈 ({EIGHTSECONDS_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showMuji} onChange={(e) => setShowMuji(e.target.checked)} disabled={MUJI_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#6f4e37" }} />
                <span className="font-bold text-[#0a0a0a]">무인양품 ({MUJI_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showHanssem} onChange={(e) => setShowHanssem(e.target.checked)} disabled={HANSSEM_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#1e5fa3" }} />
                <span className="font-bold text-[#0a0a0a]">한샘 ({HANSSEM_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showLivart} onChange={(e) => setShowLivart(e.target.checked)} disabled={LIVART_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#ec4899" }} />
                <span className="font-bold text-[#0a0a0a]">현대리바트 ({LIVART_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showIloom} onChange={(e) => setShowIloom(e.target.checked)} disabled={ILOOM_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#ca8a04" }} />
                <span className="font-bold text-[#0a0a0a]">일룸 ({ILOOM_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showNitori} onChange={(e) => setShowNitori(e.target.checked)} disabled={NITORI_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#ea580c" }} />
                <span className="font-bold text-[#0a0a0a]">니토리 ({NITORI_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showUniqlo} onChange={(e) => setShowUniqlo(e.target.checked)} disabled={UNIQLO_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#be123c" }} />
                <span className="font-bold text-[#0a0a0a]">유니클로 ({UNIQLO_STORES.length})</span>
              </label>
            </div>
            )}
          </div>

          {/* 마트 */}
          <div className="mt-3 border-t border-slate-200 pt-2">
            <button
              type="button"
              onClick={() => toggleSection("mart")}
              className="mb-1.5 flex w-full items-center gap-1 text-left text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-500 hover:text-slate-700"
            >
              <span className={`inline-block transition-transform ${collapsedSections.has("mart") ? "-rotate-90" : ""}`}>▾</span>
              <span className="flex-1">마트</span>
            </button>
            {!collapsedSections.has("mart") && (
            <div className="flex flex-col gap-1.5 text-[11px]">
              <label className="flex cursor-pointer items-center gap-1.5" title="홈플러스 영업중단 점포 전체 ON/OFF — 세부 tier는 상단 상권 필터에서 조정">
                <input
                  type="checkbox"
                  checked={showHomeplus}
                  onChange={(e) => setShowHomeplus(e.target.checked)}
                  className="h-3.5 w-3.5"
                />
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#0a0a0a" }} />
                <span className="font-bold text-[#0a0a0a]">홈플 영업중단 ({HOMEPLUS_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showEmart} onChange={(e) => setShowEmart(e.target.checked)} disabled={EMART_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#ffc107" }} />
                <span className="font-bold text-[#0a0a0a]">이마트 ({EMART_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showLottemart} onChange={(e) => setShowLottemart(e.target.checked)} disabled={LOTTEMART_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#d62828" }} />
                <span className="font-bold text-[#0a0a0a]">롯데마트 ({LOTTEMART_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showHanaromart} onChange={(e) => setShowHanaromart(e.target.checked)} disabled={HANAROMART_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#2d6a4f" }} />
                <span className="font-bold text-[#0a0a0a]">하나로마트 ({HANAROMART_STORES.length})</span>
              </label>
            </div>
            )}
          </div>
        </div>

        {/* 점포 카드 리스트 — 홈플 영업중단 33점이 활성화된 경우에만 노출 */}
        <div className="p-2">
          {showHomeplus && (
            <div className="mb-2 border-[2px] border-[#0a0a0a] bg-yellow-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-slate-600">
              홈플 영업중단 33점 · 총 {TOTAL_BRANDS}개 브랜드
            </div>
          )}
          {showHomeplus && sortedAll
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

        </div>
      </aside>

      {/* ── 지도 + 우측 상세 ── */}
      <div className="relative flex-1">
        {/* 모바일 필터 열기 버튼 */}
        <button
          onClick={() => setMobileFilterOpen(true)}
          className="md:hidden absolute left-3 top-3 z-[500] border-[2px] border-[#0a0a0a] bg-yellow-300 px-3 py-2 text-[12px] font-extrabold text-[#0a0a0a] shadow-[2px_2px_0_0_#0a0a0a]"
        >
          ☰ 필터
        </button>
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

          {/* 매칭 라인 — 홈플 */}
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

          {/* 매칭 라인 — 기타 체인/백화점/마트 (최근접 이랜드로 연결, 별도상권 제외) */}
          {showLines &&
            chainLayers.flatMap((layer) =>
              layer.items
                .filter((it) => it.tier !== "별도상권" && it.near)
                .map((it) => (
                  <Polyline
                    key={`line-${layer.cfg.k}-${it.store.id}`}
                    positions={[
                      [it.store.lat, it.store.lng],
                      [it.near!.store.lat, it.near!.store.lng],
                    ]}
                    pathOptions={{
                      color: TIER_COLOR[it.tier],
                      weight: it.tier === "동일상권" ? 2.5 : 1.5,
                      opacity: 0.4,
                      dashArray: it.tier === "근접권" ? "4,6" : undefined,
                    }}
                  />
                )),
            )}

          {/* 홈플 마커 */}
          {filtered.map((s) => {
            const radius = 10 + Math.min(s.total_brands, 18) / 1.5;
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
                <Tooltip direction="top" offset={[0, -radius]} sticky>
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

          {/* ── 체인/백화점/그외/마트 매장 — 줌·뷰포트 컬링 (확대+화면 안만 렌더) ── */}
          <ChainLayersRenderer layers={chainLayers} />

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
          <div className="mt-1.5 border-t border-slate-200 pt-1.5 text-[9px] leading-tight text-slate-400">
            💡 체인 매장(다이소·올리브영 등)은 지도를 확대하면 표시됩니다 (성능)
          </div>
          {showArtbox && ARTBOX_STORES.length > 0 && (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="inline-block h-2 w-2 border border-white" style={{ background: "#f72585" }} />
              <span className="font-bold text-[#0a0a0a]">아트박스 {ARTBOX_STORES.length}점</span>
            </div>
          )}
          {showDaiso && DAISO_STORES.length > 0 && (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="inline-block h-2 w-2 border border-white" style={{ background: "#f9c74f" }} />
              <span className="font-bold text-[#0a0a0a]">다이소 {DAISO_STORES.length}점</span>
            </div>
          )}
          {showOliveYoung && OLIVEYOUNG_STORES.length > 0 && (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="inline-block h-2 w-2 rounded-full border border-white" style={{ background: "#52b788" }} />
              <span className="font-bold text-[#0a0a0a]">올리브영 {OLIVEYOUNG_STORES.length}점</span>
            </div>
          )}
          {showLotte && LOTTE_STORES.length > 0 && (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="inline-flex h-3 w-3 items-center justify-center text-[7px] font-black text-white" style={{ background: "#a4133c" }}>L</span>
              <span className="font-bold text-[#0a0a0a]">롯데백화점 {LOTTE_STORES.length}점</span>
            </div>
          )}
          {showHyundai && HYUNDAI_STORES.length > 0 && (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="inline-flex h-3 w-3 items-center justify-center text-[7px] font-black text-white" style={{ background: "#1d3557" }}>H</span>
              <span className="font-bold text-[#0a0a0a]">현대백화점 {HYUNDAI_STORES.length}점</span>
            </div>
          )}
          {showShinsegae && SHINSEGAE_STORES.length > 0 && (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              <span className="inline-flex h-3 w-3 items-center justify-center text-[7px] font-black text-white" style={{ background: "#495057" }}>S</span>
              <span className="font-bold text-[#0a0a0a]">신세계백화점 {SHINSEGAE_STORES.length}점</span>
            </div>
          )}
          <div className="mt-2 text-[9.5px] leading-tight text-slate-500">
            ※ 원 크기 = 입점 브랜드 수
          </div>
        </div>

        {/* 우측 상세 패널 */}
        {selected && (
          <div
            className="absolute right-2 top-2 z-[400] max-h-[calc(100%-1rem)] w-[calc(100%-1rem)] max-w-[320px] overflow-y-auto border-[3px] border-[#0a0a0a] bg-white sm:right-4 sm:top-4 sm:w-[320px]"
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

// ── 체인 매장 마커 (최근접 이랜드 거리 + 상권 tier 툴팁) ──
interface ChainLayerCfg {
  show: boolean;
  stores: ChainStore[];
  icon: Icon | DivIcon;
  color: string;
  emoji: string;
  k: string;
  off: number;
  dbNote?: boolean;
}

interface EnrichedChainItem {
  store: ChainStore;
  near: NearestEland | null;
  tier: Tier;
}

function ChainMarker({
  store, icon, color, emoji, offsetY, dbNote, near, tier,
}: {
  store: ChainStore;
  icon: Icon | DivIcon;
  color: string;
  emoji: string;
  offsetY: number;
  dbNote?: boolean;
  near: NearestEland | null;
  tier: Tier;
}) {
  return (
    <Marker position={[store.lat, store.lng]} icon={icon}>
      <Tooltip direction="top" offset={[0, -offsetY]} sticky>
        <div style={{ minWidth: 180 }}>
          <div style={{ fontWeight: 700, fontSize: 12, color }}>
            {emoji ? `${emoji} ` : ""}{store.name}
          </div>
          <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{store.addr}</div>
          {near && (
            <div style={{ fontSize: 10, marginTop: 4, paddingTop: 4, borderTop: "1px solid #eee" }}>
              <span style={{ display: "inline-block", padding: "1px 5px", marginRight: 4, fontSize: 9, fontWeight: 800, color: tier === "별도상권" ? "#fff" : "#0a0a0a", background: TIER_COLOR[tier] }}>
                {TIER_LABEL[tier]}
              </span>
              <b style={{ color: "#0891b2" }}>{near.store.brand} {near.store.name}</b>
              <span style={{ color: "#0a0a0a", fontWeight: 700 }}> · {near.distanceKm.toFixed(2)}km</span>
            </div>
          )}
          {dbNote && (
            <div style={{ fontSize: 9, color: "#999", marginTop: 4, fontStyle: "italic" }}>입점 컨텐츠 DB 준비 중</div>
          )}
        </div>
      </Tooltip>
    </Marker>
  );
}

// 체인 매장이 수백~수천 개라 전부 렌더하면 느림.
// 일정 줌 이상 + 현재 화면(약간의 여유 포함) 안의 매장만 렌더한다.
const CHAIN_MIN_ZOOM = 10;
function ChainLayersRenderer({ layers }: { layers: { cfg: ChainLayerCfg; items: EnrichedChainItem[] }[] }) {
  const [, bump] = useState(0);
  const map = useMapEvents({
    moveend: () => bump((x) => x + 1),
    zoomend: () => bump((x) => x + 1),
  });
  if (map.getZoom() < CHAIN_MIN_ZOOM) return null;   // 전국 축소 뷰에선 체인 마커 숨김
  const bounds = map.getBounds().pad(0.25);          // 화면 + 약간의 여유
  return (
    <>
      {layers.map((layer) =>
        layer.items
          .filter((it) => bounds.contains([it.store.lat, it.store.lng]))
          .map((it) => (
            <ChainMarker
              key={`${layer.cfg.k}-${it.store.id}`}
              store={it.store}
              icon={layer.cfg.icon}
              color={layer.cfg.color}
              emoji={layer.cfg.emoji}
              offsetY={layer.cfg.off}
              dbNote={layer.cfg.dbNote}
              near={it.near}
              tier={it.tier}
            />
          )),
      )}
    </>
  );
}

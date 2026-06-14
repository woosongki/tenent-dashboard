"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Tooltip,
  Polyline,
  Popup,
} from "react-leaflet";
import FlyToTarget, { type FlyTarget } from "./FlyToTarget";
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
  saturIcon,
  modernhouseIcon,
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
import { SATUR_STORES } from "@/data/satur";
// ── 마트 ──
import { EMART_STORES } from "@/data/emart";
import { LOTTEMART_STORES } from "@/data/lottemart";
import { HANAROMART_STORES } from "@/data/hanaromart";

export default function HomeplusMapClient() {
  // URL ?layer=X 로 진입한 체인 레이어 자동 활성화 (사이드바 하위 메뉴)
  const searchParams = useSearchParams();
  const initialLayer = searchParams?.get("layer") ?? "";

  // 체인 메뉴(아트박스/다이소/올리브영)로 진입했으면 홈플 33점은 기본 OFF.
  // 홈플 메뉴 또는 쿼리 없음(기본 진입)은 4개 tier 모두 ON.
  const CHAIN_LAYERS = [
    "artbox","daiso","oliveyoung",
    "lotte","hyundai","shinsegae","ak","galleria",
    "entersix","moda","savezone","lf","satur","modernhouse",
    "emart","lottemart","hanaromart",
  ];
  const isChainView = CHAIN_LAYERS.includes(initialLayer);

  const [activeTiers, setActiveTiers] = useState<Set<Tier>>(
    isChainView ? new Set() : new Set(ALL_TIERS),
  );
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
  const [showSatur, setShowSatur] = useState(initialLayer === "satur");
  const [showModernhouse, setShowModernhouse] = useState(initialLayer === "modernhouse");
  // 마트
  const [showEmart, setShowEmart] = useState(initialLayer === "emart");
  const [showLottemart, setShowLottemart] = useState(initialLayer === "lottemart");
  const [showHanaromart, setShowHanaromart] = useState(initialLayer === "hanaromart");

  // 사이드바 하위 메뉴 클릭으로 layer가 바뀌면 토글/tier 자동 동기화.
  useEffect(() => {
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
    setShowSatur(initialLayer === "satur");
    setShowModernhouse(initialLayer === "modernhouse");
    setShowEmart(initialLayer === "emart");
    setShowLottemart(initialLayer === "lottemart");
    setShowHanaromart(initialLayer === "hanaromart");
    // 체인 뷰 → 홈플 tier 모두 OFF / 홈플 뷰 → 모두 ON
    setActiveTiers(isChainView ? new Set() : new Set(ALL_TIERS));
  }, [initialLayer, isChainView]);
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
                <input type="checkbox" checked={showSatur} onChange={(e) => setShowSatur(e.target.checked)} disabled={SATUR_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#7c3aed" }} />
                <span className="font-bold text-[#0a0a0a]">세터 ({SATUR_STORES.length})</span>
              </label>
              <label className="flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showModernhouse} onChange={(e) => setShowModernhouse(e.target.checked)} disabled={MODERNHOUSE_STORES.length === 0} className="h-3.5 w-3.5 disabled:opacity-40" />
                <span className="inline-block h-2 w-2" style={{ background: "#6a2c70" }} />
                <span className="font-bold text-[#0a0a0a]">모던하우스 ({MODERNHOUSE_STORES.length})</span>
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

          {/* 아트박스 매장 */}
          {showArtbox &&
            ARTBOX_STORES.map((a) => (
              <Marker key={`artbox-${a.id}`} position={[a.lat, a.lng]} icon={artboxIcon}>
                <Tooltip direction="top" offset={[0, -5]}>
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#c1166b" }}>🎨 {a.name}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{a.addr}</div>
                  </div>
                </Tooltip>
              </Marker>
            ))}

          {/* 다이소 매장 */}
          {showDaiso &&
            DAISO_STORES.map((d) => (
              <Marker key={`daiso-${d.id}`} position={[d.lat, d.lng]} icon={daisoIcon}>
                <Tooltip direction="top" offset={[0, -5]}>
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#b88a00" }}>🛒 {d.name}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{d.addr}</div>
                  </div>
                </Tooltip>
              </Marker>
            ))}

          {/* 올리브영 매장 */}
          {showOliveYoung &&
            OLIVEYOUNG_STORES.map((o) => (
              <Marker key={`oy-${o.id}`} position={[o.lat, o.lng]} icon={oliveyoungIcon}>
                <Tooltip direction="top" offset={[0, -5]}>
                  <div style={{ minWidth: 160 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#2d6a4f" }}>💄 {o.name}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{o.addr}</div>
                  </div>
                </Tooltip>
              </Marker>
            ))}

          {/* 롯데백화점 */}
          {showLotte &&
            LOTTE_STORES.map((s) => (
              <Marker key={`lotte-${s.id}`} position={[s.lat, s.lng]} icon={lotteIcon}>
                <Tooltip direction="top" offset={[0, -8]}>
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#a4133c" }}>🏬 {s.name}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                    <div style={{ fontSize: 9, color: "#999", marginTop: 4, fontStyle: "italic" }}>입점 컨텐츠 DB 준비 중</div>
                  </div>
                </Tooltip>
              </Marker>
            ))}

          {/* 현대백화점 */}
          {showHyundai &&
            HYUNDAI_STORES.map((s) => (
              <Marker key={`hyundai-${s.id}`} position={[s.lat, s.lng]} icon={hyundaiIcon}>
                <Tooltip direction="top" offset={[0, -8]}>
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#1d3557" }}>🏬 {s.name}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                    <div style={{ fontSize: 9, color: "#999", marginTop: 4, fontStyle: "italic" }}>입점 컨텐츠 DB 준비 중</div>
                  </div>
                </Tooltip>
              </Marker>
            ))}

          {/* 신세계백화점 */}
          {showShinsegae &&
            SHINSEGAE_STORES.map((s) => (
              <Marker key={`ss-${s.id}`} position={[s.lat, s.lng]} icon={shinsegaeIcon}>
                <Tooltip direction="top" offset={[0, -8]}>
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#495057" }}>🏬 {s.name}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                    <div style={{ fontSize: 9, color: "#999", marginTop: 4, fontStyle: "italic" }}>입점 컨텐츠 DB 준비 중</div>
                  </div>
                </Tooltip>
              </Marker>
            ))}

          {/* AK백화점 */}
          {showAk && AK_STORES.map((s) => (
            <Marker key={`ak-${s.id}`} position={[s.lat, s.lng]} icon={akIcon}>
              <Tooltip direction="top" offset={[0, -8]}>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#6f1d77" }}>🏬 {s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                  <div style={{ fontSize: 9, color: "#999", marginTop: 4, fontStyle: "italic" }}>입점 컨텐츠 DB 준비 중</div>
                </div>
              </Tooltip>
            </Marker>
          ))}

          {/* 갤러리아 */}
          {showGalleria && GALLERIA_STORES.map((s) => (
            <Marker key={`gl-${s.id}`} position={[s.lat, s.lng]} icon={galleriaIcon}>
              <Tooltip direction="top" offset={[0, -8]}>
                <div style={{ minWidth: 180 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#2d5016" }}>🏬 {s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                  <div style={{ fontSize: 9, color: "#999", marginTop: 4, fontStyle: "italic" }}>입점 컨텐츠 DB 준비 중</div>
                </div>
              </Tooltip>
            </Marker>
          ))}

          {/* ── 그 외 ── */}
          {showEntersix && ENTERSIX_STORES.map((s) => (
            <Marker key={`es-${s.id}`} position={[s.lat, s.lng]} icon={entersixIcon}>
              <Tooltip direction="top" offset={[0, -4]}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#cc5429" }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                </div>
              </Tooltip>
            </Marker>
          ))}
          {showModa && MODA_STORES.map((s) => (
            <Marker key={`md-${s.id}`} position={[s.lat, s.lng]} icon={modaIcon}>
              <Tooltip direction="top" offset={[0, -4]}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#007a6e" }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                </div>
              </Tooltip>
            </Marker>
          ))}
          {showSavezone && SAVEZONE_STORES.map((s) => (
            <Marker key={`sv-${s.id}`} position={[s.lat, s.lng]} icon={savezoneIcon}>
              <Tooltip direction="top" offset={[0, -4]}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#6e7a2e" }}>{s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                </div>
              </Tooltip>
            </Marker>
          ))}
          {showLf && LF_STORES.map((s) => (
            <Marker key={`lf-${s.id}`} position={[s.lat, s.lng]} icon={lfIcon}>
              <Tooltip direction="top" offset={[0, -4]}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#6e5538" }}>🛍️ {s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                </div>
              </Tooltip>
            </Marker>
          ))}
          {showSatur && SATUR_STORES.map((s) => (
            <Marker key={`sa-${s.id}`} position={[s.lat, s.lng]} icon={saturIcon}>
              <Tooltip direction="top" offset={[0, -4]}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#5b21b6" }}>👜 {s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                </div>
              </Tooltip>
            </Marker>
          ))}
          {showModernhouse && MODERNHOUSE_STORES.map((s) => (
            <Marker key={`mh-${s.id}`} position={[s.lat, s.lng]} icon={modernhouseIcon}>
              <Tooltip direction="top" offset={[0, -4]}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#6a2c70" }}>🏡 {s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                </div>
              </Tooltip>
            </Marker>
          ))}

          {/* ── 마트 ── */}
          {showEmart && EMART_STORES.map((s) => (
            <Marker key={`em-${s.id}`} position={[s.lat, s.lng]} icon={emartIcon}>
              <Tooltip direction="top" offset={[0, -6]}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#b88a00" }}>🛒 {s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                </div>
              </Tooltip>
            </Marker>
          ))}
          {showLottemart && LOTTEMART_STORES.map((s) => (
            <Marker key={`lm-${s.id}`} position={[s.lat, s.lng]} icon={lottemartIcon}>
              <Tooltip direction="top" offset={[0, -6]}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#a01a1a" }}>🛒 {s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                </div>
              </Tooltip>
            </Marker>
          ))}
          {showHanaromart && HANAROMART_STORES.map((s) => (
            <Marker key={`hm-${s.id}`} position={[s.lat, s.lng]} icon={hanaromartIcon}>
              <Tooltip direction="top" offset={[0, -6]}>
                <div style={{ minWidth: 160 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#1f4d3a" }}>🛒 {s.name}</div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>{s.addr}</div>
                </div>
              </Tooltip>
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

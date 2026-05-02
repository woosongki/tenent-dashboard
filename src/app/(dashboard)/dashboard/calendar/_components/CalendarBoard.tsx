"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  type CalendarWeek,
  type CalendarMatch,
  type Intensity,
  INTENSITY_COLOR,
  getSeasonStyle,
} from "@/lib/calendar52";
import { STAGE_BADGE, type PopupContact } from "@/lib/popupContacts";
import type { CalendarAssignment } from "@/lib/calendarAssignments";
import {
  assignContactToWeek,
  unassignContact,
} from "../_actions";

interface Props {
  weeks: CalendarWeek[];
  matches: Record<number, CalendarMatch[]>;
  contacts: PopupContact[];
  assignments: Record<number, CalendarAssignment[]>;
  canEdit: boolean;
}

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const INTENSITY_LABEL: Record<Intensity, string> = { high: "고강도", mid: "중강도", low: "저강도" };

export default function CalendarBoard({ weeks, matches, contacts, assignments, canEdit }: Props) {
  const [intensity, setIntensity] = useState<Intensity | "all">("all");
  const [q, setQ]                 = useState("");
  const [onlyMatched, setOnlyMatched] = useState(false);

  const filtered = useMemo(() => {
    const qNorm = q.trim().toLowerCase();
    return weeks.filter((w) => {
      if (intensity !== "all" && w.intensity !== intensity) return false;
      if (onlyMatched && !matches[w.index] && !assignments[w.index]) return false;
      if (qNorm) {
        const hay = [
          w.concept, w.monthKw, w.item, w.hotsauce, w.bestCat,
          ...w.popups.map((p) => p.text),
          ...w.others.map((o) => `${o.label} ${o.text}`),
          ...w.extEvents.map((e) => `${e.label} ${e.text}`),
        ].join(" ").toLowerCase();
        if (!hay.includes(qNorm)) return false;
      }
      return true;
    });
  }, [weeks, intensity, q, onlyMatched, matches, assignments]);

  const contactByNo = useMemo(() => {
    const m = new Map<number, PopupContact>();
    for (const c of contacts) m.set(c.no, c);
    return m;
  }, [contacts]);

  const byMonth = useMemo(() => {
    const m: Record<string, CalendarWeek[]> = {};
    for (const w of filtered) (m[w.month] ??= []).push(w);
    return m;
  }, [filtered]);

  return (
    <div className="space-y-5">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip active={intensity === "all"} onClick={() => setIntensity("all")}>
          전체
        </Chip>
        {(["high","mid","low"] as const).map((g) => (
          <Chip
            key={g}
            active={intensity === g}
            onClick={() => setIntensity(intensity === g ? "all" : g)}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${INTENSITY_COLOR[g].dot}`} />
            {INTENSITY_LABEL[g]}
          </Chip>
        ))}
        <label className="ml-2 inline-flex items-center gap-1.5 text-[12px] text-slate-600">
          <input
            type="checkbox"
            checked={onlyMatched}
            onChange={(e) => setOnlyMatched(e.target.checked)}
            className="rounded border-slate-300"
          />
          컨텍판 매칭/핀만
        </label>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="컨셉·팝업·이벤트 검색"
          className="ml-auto h-8 w-64 rounded-lg border border-[#e8ecf0] bg-white px-3 text-[12px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      {/* 월 섹션 */}
      {MONTHS.map((mo) => {
        const ws = byMonth[mo];
        if (!ws || ws.length === 0) return null;
        const head = ws[0];
        const sty = getSeasonStyle(head.season);
        return (
          <section key={mo} className="rounded-xl border border-[#e8ecf0] bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,.04)]">
            <header className="flex flex-wrap items-center gap-3 pb-2 mb-3 border-b border-[#f1f5f9]">
              <h2 className="text-[18px] font-extrabold tracking-tight text-slate-900">{mo}</h2>
              <span
                className="inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full"
                style={{ background: sty.bg, color: sty.tx }}
              >
                {head.season}
              </span>
              <span className="text-[11px] text-slate-500 leading-relaxed">{head.monthKw}</span>
            </header>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
              {ws.map((w) => (
                <WeekCard
                  key={w.index}
                  week={w}
                  matches={matches[w.index] ?? []}
                  pins={(assignments[w.index] ?? []).map((a) => ({
                    assignment: a,
                    contact: contactByNo.get(a.contactNo) ?? null,
                  }))}
                  contacts={contacts}
                  canEdit={canEdit}
                />
              ))}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <div className="rounded-xl bg-white py-16 text-center border border-[#e8ecf0]">
          <p className="text-sm text-slate-400">조건에 맞는 주차가 없습니다.</p>
        </div>
      )}
    </div>
  );
}

interface PinRow { assignment: CalendarAssignment; contact: PopupContact | null }

function WeekCard({
  week,
  matches,
  pins,
  contacts,
  canEdit,
}: {
  week: CalendarWeek;
  matches: CalendarMatch[];
  pins: PinRow[];
  contacts: PopupContact[];
  canEdit: boolean;
}) {
  const ic = INTENSITY_COLOR[week.intensity];
  const pinnedNos = useMemo(() => new Set(pins.map((p) => p.assignment.contactNo)), [pins]);
  return (
    <div className="rounded-lg border border-[#e8ecf0] bg-white overflow-hidden hover:border-violet-300 hover:shadow-[0_4px_12px_rgba(124,58,237,.06)] transition-all">
      {/* 헤더 */}
      <div className="px-3 py-2.5 border-b border-[#f1f5f9]">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-semibold text-slate-400">{week.month} {week.weekNo}주</span>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${ic.dot}`} />
          <span className="text-[10px] text-amber-500">{week.grade}</span>
        </div>
        <p className="text-[12.5px] font-bold text-slate-900 leading-tight whitespace-pre-line">
          {week.concept}
        </p>
      </div>

      <div className="p-2.5 space-y-2.5 text-[11px]">
        {/* 팝업 후보 */}
        {week.popups.length > 0 && (
          <Section title="🎪 팝업 후보">
            {week.popups.map((p, i) => (
              <Item key={i} label={p.label} color={p.color} text={p.text} />
            ))}
          </Section>
        )}

        {/* 핀 (수동 배정) */}
        {(pins.length > 0 || canEdit) && (
          <Section title={`📍 핀 ${pins.length}건`}>
            <div className="flex flex-wrap gap-1 items-center">
              {pins.map(({ assignment, contact }) => (
                <PinChip
                  key={assignment.id}
                  assignment={assignment}
                  contact={contact}
                  canEdit={canEdit}
                />
              ))}
              {canEdit && (
                <AddContactPicker
                  weekIndex={week.index}
                  contacts={contacts}
                  excludeNos={pinnedNos}
                />
              )}
            </div>
          </Section>
        )}

        {/* 컨텍판 자동 매칭 */}
        {matches.length > 0 && (
          <Section title={`🔍 자동 매칭 ${matches.length}건`}>
            <div className="flex flex-wrap gap-1">
              {matches.slice(0, 8).map((m) => (
                <Link
                  key={m.contact.no}
                  href={`/dashboard/goals?tab=popup`}
                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
                    m.contact.stage ? STAGE_BADGE[m.contact.stage] ?? "bg-slate-50 text-slate-700 border-slate-200" : "bg-slate-50 text-slate-700 border-slate-200"
                  } hover:underline`}
                  title={`${m.contact.brand} · ${m.contact.stage ?? "단계 미상"} · ${m.contact.field ?? ""}`}
                >
                  <span className="font-medium">{m.contact.brand}</span>
                  {m.contact.stage && <span className="text-[9px] opacity-70">{m.contact.stage}</span>}
                </Link>
              ))}
              {matches.length > 8 && (
                <span className="text-[10px] text-slate-400">+{matches.length - 8}</span>
              )}
            </div>
          </Section>
        )}

        {/* 타유통 */}
        {week.others.length > 0 && (
          <Section title="🏢 타유통 팝업">
            {week.others.map((o, i) => (
              <Item key={i} label={o.label} color={o.color} text={o.text} />
            ))}
          </Section>
        )}

        {/* 박람회/축제/온라인 */}
        {week.extEvents.length > 0 && (
          <Section title="📅 외부 이벤트">
            {week.extEvents.map((e, i) => (
              <div key={i} className="text-[10.5px] text-slate-600">
                <span className="font-medium text-slate-700">{e.label}</span>
                <span className="text-slate-500 ml-1 whitespace-pre-line">{e.text}</span>
              </div>
            ))}
          </Section>
        )}

        {/* 단일 이벤트/핫소스/베스트 */}
        {week.item && (
          <Section title="🎯 단일대상">
            <p className="text-[10.5px] text-slate-600 whitespace-pre-line">{week.item}</p>
          </Section>
        )}
        {week.bestCat && (
          <Section title="🏆 베스트 카테고리">
            <p className="text-[10.5px] text-slate-600 whitespace-pre-line">{week.bestCat}</p>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-tight text-slate-400 mb-1">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Item({ label, color, text }: { label: string; color?: string; text: string }) {
  return (
    <div className="text-[10.5px]">
      <span
        className="inline-block px-1 py-0 rounded text-[9px] font-semibold mr-1 align-middle"
        style={{
          background: color ? `${color}1a` : "#f1f5f9",
          color: color ?? "#475569",
        }}
      >
        {label}
      </span>
      <span className="text-slate-600 whitespace-pre-line">{text}</span>
    </div>
  );
}

function PinChip({
  assignment,
  contact,
  canEdit,
}: {
  assignment: CalendarAssignment;
  contact: PopupContact | null;
  canEdit: boolean;
}) {
  const [pending, start] = useTransition();
  const stage = contact?.stage ?? null;
  const cls = stage ? STAGE_BADGE[stage] ?? "bg-amber-50 text-amber-700 border-amber-200" : "bg-amber-50 text-amber-700 border-amber-200";

  function onRemove() {
    if (!canEdit) return;
    if (!confirm(`'${assignment.contactBrand}' 핀을 해제할까요?`)) return;
    start(async () => {
      const res = await unassignContact(assignment.id);
      if (!res.ok) toast.error(res.error);
      else toast.success("핀 해제됨");
    });
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${cls} ${
        pending ? "opacity-50" : ""
      }`}
      title={`${assignment.contactBrand}${stage ? " · " + stage : ""}${contact?.field ? " · " + contact.field : ""}`}
    >
      <span className="text-amber-700 font-bold">📍</span>
      <Link href={`/dashboard/goals?tab=popup`} className="font-medium hover:underline">
        {assignment.contactBrand}
      </Link>
      {stage && <span className="text-[9px] opacity-70">{stage}</span>}
      {canEdit && (
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          aria-label="핀 해제"
          className="ml-0.5 text-slate-400 hover:text-rose-600"
        >
          ✕
        </button>
      )}
    </span>
  );
}

function AddContactPicker({
  weekIndex,
  contacts,
  excludeNos,
}: {
  weekIndex: number;
  contacts: PopupContact[];
  excludeNos: Set<number>;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();

  const candidates = useMemo(() => {
    const qNorm = q.trim().toLowerCase();
    return contacts
      .filter((c) => !excludeNos.has(c.no))
      .filter((c) => {
        if (!qNorm) return true;
        const hay = `${c.brand} ${c.company ?? ""} ${c.field ?? ""}`.toLowerCase();
        return hay.includes(qNorm);
      })
      .slice(0, 30);
  }, [contacts, excludeNos, q]);

  function onPick(c: PopupContact) {
    start(async () => {
      const res = await assignContactToWeek(weekIndex, c.no, c.brand);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`'${c.brand}' 핀 추가됨`);
        setOpen(false);
        setQ("");
      }
    });
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[10px] px-1.5 py-0.5 rounded border border-dashed border-slate-300 text-slate-500 hover:border-violet-400 hover:text-violet-700"
      >
        + 컨텍판 추가
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-64 rounded-lg border border-slate-200 bg-white shadow-lg p-2">
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="브랜드·업체 검색"
            className="h-7 w-full rounded border border-slate-200 px-2 text-[11px] focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
          <ul className="mt-1 max-h-56 overflow-y-auto">
            {candidates.length === 0 ? (
              <li className="text-[11px] text-slate-400 px-2 py-3 text-center">결과 없음</li>
            ) : (
              candidates.map((c) => (
                <li key={c.no}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    disabled={pending}
                    className="w-full text-left px-2 py-1 rounded text-[11px] hover:bg-slate-50 disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800 truncate">{c.brand}</span>
                      {c.stage && (
                        <span
                          className={`shrink-0 text-[9px] px-1 py-0 rounded border ${
                            STAGE_BADGE[c.stage] ?? "bg-slate-50 text-slate-700 border-slate-200"
                          }`}
                        >
                          {c.stage}
                        </span>
                      )}
                    </div>
                    <div className="text-[9.5px] text-slate-400 truncate">
                      {c.field ?? "-"}
                      {c.company && c.company !== c.brand ? ` · ${c.company}` : ""}
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
          <button
            type="button"
            onClick={() => { setOpen(false); setQ(""); }}
            className="mt-1 w-full text-[10px] text-slate-400 hover:text-slate-600"
          >
            닫기
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[12px] px-3 py-1.5 rounded-full border transition-colors inline-flex items-center ${
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white border-[#e8ecf0] text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

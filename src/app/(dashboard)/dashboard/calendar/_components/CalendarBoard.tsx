"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
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
  updateCalendarWeek,
  type WeekPatch,
} from "../_actions";

interface Props {
  weeks: CalendarWeek[];
  matches: Record<number, CalendarMatch[]>;
  contacts: PopupContact[];
  assignments: Record<number, CalendarAssignment[]>;
  canEdit: boolean;
  canEditWeek: boolean;
}

const MONTHS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
const INTENSITY_LABEL: Record<Intensity, string> = { high: "고강도", mid: "중강도", low: "저강도" };

export default function CalendarBoard({ weeks, matches, contacts, assignments, canEdit, canEditWeek }: Props) {
  const [editingWeek, setEditingWeek] = useState<CalendarWeek | null>(null);
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
        <label className="ml-2 inline-flex items-center gap-1.5 text-[12px] text-[#0a0a0a]/75">
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
          className="ml-auto h-9 w-64 border-[2px] border-[#0a0a0a] bg-white px-3 text-[12px] font-medium placeholder:text-[#0a0a0a]/40 shadow-[3px_3px_0_0_#0a0a0a] focus:outline-none focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[4px_4px_0_0_#0a0a0a] transition-all"
        />
      </div>

      {/* 월 섹션 */}
      {MONTHS.map((mo) => {
        const ws = byMonth[mo];
        if (!ws || ws.length === 0) return null;
        const head = ws[0];
        const sty = getSeasonStyle(head.season);
        return (
          <section key={mo} className="brutal bg-white p-5">
            <header className="flex flex-wrap items-center gap-3 pb-2 mb-3 border-b border-[#0a0a0a]/10">
              <h2 className="font-display text-[18px] leading-none text-[#0a0a0a]">{mo}</h2>
              <span
                className="inline-block border-[1.5px] border-[#0a0a0a] px-2 py-0 text-[10px] font-extrabold uppercase tracking-wider"
                style={{ background: sty.bg, color: sty.tx }}
              >
                {head.season}
              </span>
              <span className="text-[11px] text-[#0a0a0a]/65 leading-relaxed">{head.monthKw}</span>
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
                  canEditWeek={canEditWeek}
                  onEdit={() => setEditingWeek(w)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <div className="brutal bg-white py-16 text-center">
          <p className="text-[14px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/60">조건에 맞는 주차가 없습니다</p>
        </div>
      )}

      {editingWeek && (
        <WeekEditModal
          week={editingWeek}
          onClose={() => setEditingWeek(null)}
        />
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
  canEditWeek,
  onEdit,
}: {
  week: CalendarWeek;
  matches: CalendarMatch[];
  pins: PinRow[];
  contacts: PopupContact[];
  canEdit: boolean;
  canEditWeek: boolean;
  onEdit: () => void;
}) {
  const ic = INTENSITY_COLOR[week.intensity];
  const pinnedNos = useMemo(() => new Set(pins.map((p) => p.assignment.contactNo)), [pins]);
  return (
    <div className="brutal-sm brutal-hover bg-white overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2.5 border-b border-[#0a0a0a]/10">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/55">{week.month} {week.weekNo}주</span>
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${ic.dot}`} />
          <span className="text-[10px] text-amber-500">{week.grade}</span>
          {canEditWeek && (
            <button
              type="button"
              onClick={onEdit}
              className="ml-auto text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55 hover:text-violet-600"
              title="주차 편집"
            >
              ✏️ 편집
            </button>
          )}
        </div>
        <p className="text-[12.5px] font-extrabold text-[#0a0a0a] leading-tight whitespace-pre-line">
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
                    m.contact.stage ? STAGE_BADGE[m.contact.stage] ?? "bg-slate-50 text-[#0a0a0a] border-slate-200" : "bg-slate-50 text-[#0a0a0a] border-slate-200"
                  } hover:underline`}
                  title={`${m.contact.brand} · ${m.contact.stage ?? "단계 미상"} · ${m.contact.field ?? ""}`}
                >
                  <span className="font-medium">{m.contact.brand}</span>
                  {m.contact.stage && <span className="text-[9px] opacity-70">{m.contact.stage}</span>}
                </Link>
              ))}
              {matches.length > 8 && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0a0a0a]/55">+{matches.length - 8}</span>
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
              <div key={i} className="text-[10.5px] font-medium text-[#0a0a0a]/75">
                <span className="font-extrabold text-[#0a0a0a]">{e.label}</span>
                <span className="text-[#0a0a0a]/65 ml-1 whitespace-pre-line">{e.text}</span>
              </div>
            ))}
          </Section>
        )}

        {/* 단일 이벤트/핫소스/베스트 */}
        {week.item && (
          <Section title="🎯 단일대상">
            <p className="text-[10.5px] font-medium text-[#0a0a0a]/75 whitespace-pre-line">{week.item}</p>
          </Section>
        )}
        {week.bestCat && (
          <Section title="🏆 베스트 카테고리">
            <p className="text-[10.5px] font-medium text-[#0a0a0a]/75 whitespace-pre-line">{week.bestCat}</p>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[9px] font-extrabold uppercase tracking-[.14em] text-[#0a0a0a]/65 mb-1">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Item({ label, color, text }: { label: string; color?: string; text: string }) {
  return (
    <div className="text-[10.5px]">
      <span
        className="inline-block border-[1px] border-[#0a0a0a] px-1 py-0 text-[9px] font-extrabold uppercase tracking-wider mr-1 align-middle"
        style={{
          background: color ? `${color}1a` : "#f1f5f9",
          color: color ?? "#475569",
        }}
      >
        {label}
      </span>
      <span className="text-[#0a0a0a]/75 whitespace-pre-line">{text}</span>
    </div>
  );
}

function WeekEditModal({ week, onClose }: { week: CalendarWeek; onClose: () => void }) {
  const [concept,   setConcept]   = useState(week.concept);
  const [grade,     setGrade]     = useState(week.grade);
  const [intensity, setIntensity] = useState<Intensity>(week.intensity);
  const [monthKw,   setMonthKw]   = useState(week.monthKw);
  const [item,      setItem]      = useState(week.item);
  const [hotsauce,  setHotsauce]  = useState(week.hotsauce);
  const [bestCat,   setBestCat]   = useState(week.bestCat);
  const [popups,    setPopups]    = useState(JSON.stringify(week.popups, null, 2));
  const [others,    setOthers]    = useState(JSON.stringify(week.others, null, 2));
  const [extEvents, setExtEvents] = useState(JSON.stringify(week.extEvents, null, 2));
  const [pending,   start]        = useTransition();

  function tryParse(label: string, txt: string): unknown[] | null {
    try {
      const v = JSON.parse(txt);
      if (!Array.isArray(v)) throw new Error("배열이어야 합니다");
      return v;
    } catch (e) {
      toast.error(`${label} JSON 파싱 실패: ${(e as Error).message}`);
      return null;
    }
  }

  function onSave() {
    const popsParsed = tryParse("팝업 후보", popups);
    const otrParsed  = tryParse("타유통", others);
    const extParsed  = tryParse("외부 이벤트", extEvents);
    if (!popsParsed || !otrParsed || !extParsed) return;

    const patch: WeekPatch = {
      concept, grade, intensity, monthKw, item, hotsauce, bestCat,
      popups:    popsParsed as WeekPatch["popups"],
      others:    otrParsed  as WeekPatch["others"],
      extEvents: extParsed  as WeekPatch["extEvents"],
    };

    start(async () => {
      const res = await updateCalendarWeek(week.index, patch);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(`${week.month} ${week.weekNo}주 저장됨`);
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center p-4 sm:p-8 bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-2xl brutal-lg bg-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 py-3 border-b-[2px] border-[#0a0a0a] bg-[#F1ECDB] flex items-center gap-2">
          <h3 className="font-display text-[18px] leading-none text-[#0a0a0a]">
            {week.month} {week.weekNo}주 편집
          </h3>
          <span className="text-[11px] text-[#0a0a0a]/55">{week.season}</span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto text-[#0a0a0a]/55 hover:text-[#0a0a0a]"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4 text-[13px]">
          <Field label="컨셉">
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              rows={2}
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="강도">
              <select
                value={intensity}
                onChange={(e) => setIntensity(e.target.value as Intensity)}
                className={inputCls}
              >
                <option value="high">고강도</option>
                <option value="mid">중강도</option>
                <option value="low">저강도</option>
              </select>
            </Field>
            <Field label="등급(★)">
              <input
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="월 키워드">
              <input
                value={monthKw}
                onChange={(e) => setMonthKw(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <Field
            label="팝업 후보 (JSON 배열)"
            hint='형식: [{"label":"핵심팝업","color":"#8e44ad","text":"내용\n여러줄"}]'
          >
            <textarea
              value={popups}
              onChange={(e) => setPopups(e.target.value)}
              rows={8}
              className={`${inputCls} font-mono text-[11px]`}
              spellCheck={false}
            />
          </Field>

          <Field
            label="타유통 팝업 (JSON 배열)"
            hint='형식: [{"label":"더현대","color":"#1a6eb5","text":"..."}]'
          >
            <textarea
              value={others}
              onChange={(e) => setOthers(e.target.value)}
              rows={6}
              className={`${inputCls} font-mono text-[11px]`}
              spellCheck={false}
            />
          </Field>

          <Field
            label="외부 이벤트 (JSON 배열)"
            hint='형식: [{"label":"박람회","text":"..."}]'
          >
            <textarea
              value={extEvents}
              onChange={(e) => setExtEvents(e.target.value)}
              rows={4}
              className={`${inputCls} font-mono text-[11px]`}
              spellCheck={false}
            />
          </Field>

          <Field label="단일 대상 (item)">
            <textarea value={item} onChange={(e) => setItem(e.target.value)} rows={2} className={inputCls} />
          </Field>
          <Field label="핫소스 (hotsauce)">
            <textarea value={hotsauce} onChange={(e) => setHotsauce(e.target.value)} rows={3} className={inputCls} />
          </Field>
          <Field label="베스트 카테고리 (bestCat)">
            <textarea value={bestCat} onChange={(e) => setBestCat(e.target.value)} rows={2} className={inputCls} />
          </Field>
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3 border-t-[2px] border-[#0a0a0a] bg-[#F1ECDB] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="text-[12px] font-extrabold uppercase tracking-wider px-4 py-2 border-[2px] border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-yellow-300 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className="text-[12px] font-extrabold uppercase tracking-wider px-4 py-2 border-[2px] border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-[3px_3px_0_0_#0a0a0a] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0_0_#0a0a0a] disabled:opacity-50 transition-all"
          >
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full border-[2px] border-[#0a0a0a] bg-white px-3 py-2 text-[13px] shadow-[2px_2px_0_0_#0a0a0a] focus:outline-none focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[3px_3px_0_0_#0a0a0a] transition-all";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0a0a0a] mb-1">
        {label}
        {hint && <span className="ml-2 font-medium text-[#0a0a0a]/55">{hint}</span>}
      </label>
      {children}
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const stage = contact?.stage ?? null;

  function doRemove() {
    setConfirmOpen(false);
    start(async () => {
      const res = await unassignContact(assignment.id);
      if (!res.ok) toast.error(res.error);
      else toast.success("핀 해제됨");
    });
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 border-[1.5px] border-[#0a0a0a] bg-yellow-200 text-[#0a0a0a] ${
        pending ? "opacity-50" : ""
      }`}
      title={`${assignment.contactBrand}${stage ? " · " + stage : ""}${contact?.field ? " · " + contact.field : ""}`}
    >
      <span>📍</span>
      <Link href={`/dashboard/goals?tab=popup`} className="hover:underline">
        {assignment.contactBrand}
      </Link>
      {stage && <span className="text-[9px] font-bold opacity-65">{stage}</span>}
      {canEdit && (
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          disabled={pending}
          aria-label="핀 해제"
          className="ml-0.5 h-3.5 w-3.5 inline-flex items-center justify-center border-[1.5px] border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-rose-500 hover:text-white transition-colors"
        >
          ✕
        </button>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title="핀 해제"
        message={`'${assignment.contactBrand}' 핀을 해제할까요?`}
        confirmLabel="해제"
        tone="danger"
        onConfirm={doRemove}
        onCancel={() => setConfirmOpen(false)}
      />
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
        className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 border-[2px] border-dashed border-[#0a0a0a] bg-white text-[#0a0a0a] hover:bg-yellow-300"
      >
        + 컨텍판 추가
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 w-64 brutal bg-white p-2">
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="브랜드·업체 검색"
            className="h-7 w-full border-[2px] border-[#0a0a0a] bg-white px-2 text-[11px] font-medium shadow-[2px_2px_0_0_#0a0a0a] focus:outline-none focus:translate-x-[-1px] focus:translate-y-[-1px] focus:shadow-[3px_3px_0_0_#0a0a0a] transition-all"
          />
          <ul className="mt-1 max-h-56 overflow-y-auto">
            {candidates.length === 0 ? (
              <li className="text-[11px] font-bold uppercase tracking-wider text-[#0a0a0a]/40 px-2 py-3 text-center">결과 없음</li>
            ) : (
              candidates.map((c) => (
                <li key={c.no}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    disabled={pending}
                    className="w-full text-left px-2 py-1.5 border-l-[3px] border-transparent text-[11px] hover:bg-yellow-300 hover:border-[#0a0a0a] disabled:opacity-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-[#0a0a0a] truncate">{c.brand}</span>
                      {c.stage && (
                        <span
                          className={`shrink-0 text-[9px] px-1 py-0 rounded border ${
                            STAGE_BADGE[c.stage] ?? "bg-slate-50 text-[#0a0a0a] border-slate-200"
                          }`}
                        >
                          {c.stage}
                        </span>
                      )}
                    </div>
                    <div className="text-[9.5px] font-bold uppercase tracking-wider text-[#0a0a0a]/55 truncate">
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
            className="mt-1 w-full text-[10px] font-extrabold uppercase tracking-wider text-[#0a0a0a]/55 hover:text-[#0a0a0a] hover:bg-yellow-100 transition-colors"
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
      className={`text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 border-[2px] transition-all inline-flex items-center ${
        active
          ? "bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-[2px_2px_0_0_#0a0a0a]"
          : "bg-white border-[#0a0a0a] text-[#0a0a0a] hover:bg-yellow-300"
      }`}
    >
      {children}
    </button>
  );
}

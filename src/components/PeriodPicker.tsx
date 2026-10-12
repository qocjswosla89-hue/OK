"use client";

import { useState, useMemo } from "react";
import { Calendar } from "lucide-react";

// 은행 앱 조회기간처럼: 버튼을 누르면 시작일~종료일이 채워지고, 날짜를 직접 골라 조회할 수도 있음
export type Preset = "week" | "month" | "3month" | "6month" | "year" | "byYear" | "byMonth" | "custom";
export type DateRange = { start: string; end: string }; // 둘 다 포함, YYYY-MM-DD

const PRESETS: { key: Preset; label: string }[] = [
  { key: "week", label: "1주일" },
  { key: "month", label: "1개월" },
  { key: "3month", label: "3개월" },
  { key: "6month", label: "6개월" },
  { key: "year", label: "1년" },
  { key: "byYear", label: "연도별" },
  { key: "byMonth", label: "월별" },
];

const FIRST_YEAR = 2026; // 수집 시작 연도 (crawlers.ts SINCE_DATE)

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 종료일(포함) → 다음날 (API는 to 미만으로 조회)
export function nextDay(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return ymd(new Date(y, m - 1, d + 1));
}

export function formatRange(r: DateRange): string {
  return `${r.start.replace(/-/g, ".")} ~ ${r.end.replace(/-/g, ".")}`;
}

// 프리셋 → 시작일·종료일
export function presetRange(p: Preset, year = 0, month = 0): DateRange | null {
  const today = new Date();
  const back = (fn: (d: Date) => void) => { const d = new Date(today); fn(d); return { start: ymd(d), end: ymd(today) }; };
  if (p === "week") return back((d) => d.setDate(d.getDate() - 7));
  if (p === "month") return back((d) => d.setMonth(d.getMonth() - 1));
  if (p === "3month") return back((d) => d.setMonth(d.getMonth() - 3));
  if (p === "6month") return back((d) => d.setMonth(d.getMonth() - 6));
  if (p === "year") return back((d) => d.setFullYear(d.getFullYear() - 1));
  if (p === "byYear") return { start: `${year}-01-01`, end: `${year}-12-31` };
  if (p === "byMonth") return { start: ymd(new Date(year, month - 1, 1)), end: ymd(new Date(year, month, 0)) };
  return null;
}

// 부모는 presetRange(initialPreset)로 초기 range를 잡고, 조회할 때마다 onChange로 새 range를 받음
export function PeriodPicker({ initialPreset = "month", onChange, className = "" }: {
  initialPreset?: Preset;
  onChange: (r: DateRange) => void;
  className?: string;
}) {
  const now = new Date();
  const initial = presetRange(initialPreset)!;
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [startDate, setStartDate] = useState(initial.start); // 입력 중인 값
  const [endDate, setEndDate] = useState(initial.end);
  const [error, setError] = useState("");

  const years = useMemo(() => {
    const ys: number[] = [];
    for (let y = new Date().getFullYear(); y >= FIRST_YEAR; y--) ys.push(y);
    return ys;
  }, []);

  function applyPreset(p: Preset, y = year, m = month) {
    const r = presetRange(p, y, m);
    if (!r) return;
    setPreset(p);
    setStartDate(r.start);
    setEndDate(r.end);
    setError("");
    onChange(r);
  }

  function search() {
    if (!startDate || !endDate) { setError("시작일과 종료일을 선택하세요"); return; }
    if (startDate > endDate) { setError("시작일이 종료일보다 늦습니다"); return; }
    setError("");
    onChange({ start: startDate, end: endDate });
  }

  return (
    <div className={`p-3 rounded-lg border border-[#EBEBEB] bg-[#FCFCFC] ${className}`}>
      <div className="flex items-center gap-1.5 mb-2">
        <Calendar className="w-3.5 h-3.5 text-[#AAAAAA]" />
        <span className="text-[12px] font-semibold text-[#555555]">조회기간</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
        {PRESETS.map((p) => (
          <button key={p.key} onClick={() => applyPreset(p.key)}
            className={`py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
              preset === p.key ? "bg-[#25282B] border-[#25282B] text-white" : "bg-white border-[#DEDEDE] text-[#555555]"
            }`}>
            {p.label}
          </button>
        ))}
      </div>
      {(preset === "byYear" || preset === "byMonth") && (
        <div className="mt-2 flex items-center gap-2">
          <select value={year} onChange={(e) => { const y = Number(e.target.value); setYear(y); applyPreset(preset, y, month); }}
            className="px-2 py-1.5 rounded-md border border-[#DEDEDE] text-[12px] text-[#333333] bg-white">
            {years.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          {preset === "byMonth" && (
            <select value={month} onChange={(e) => { const m = Number(e.target.value); setMonth(m); applyPreset("byMonth", year, m); }}
              className="px-2 py-1.5 rounded-md border border-[#DEDEDE] text-[12px] text-[#333333] bg-white">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
            </select>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center gap-1.5">
        <input type="date" value={startDate} max={endDate || undefined}
          onChange={(e) => { setStartDate(e.target.value); setPreset("custom"); }}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#DEDEDE] text-[12px] text-[#333333] bg-white" />
        <span className="text-[12px] text-[#AAAAAA]">~</span>
        <input type="date" value={endDate} min={startDate || undefined}
          onChange={(e) => { setEndDate(e.target.value); setPreset("custom"); }}
          className="flex-1 min-w-0 px-2 py-1.5 rounded-md border border-[#DEDEDE] text-[12px] text-[#333333] bg-white" />
        <button onClick={search}
          className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-[#F26522] text-white shrink-0">
          조회
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-[#E64980]">{error}</p>}
    </div>
  );
}

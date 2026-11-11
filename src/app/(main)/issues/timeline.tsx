"use client";

import { useState } from "react";

export type Sent = "긍정" | "중립" | "부정" | "미분류";
export const SENTS: Sent[] = ["부정", "중립", "긍정", "미분류"];
// 부정(붉은색)·중립(회색)·긍정(파란색) — 색약 구분도 검증한 조합
export const COLOR: Record<Sent, string> = { 긍정: "#2A78D6", 중립: "#B4B9BF", 부정: "#E5484D", 미분류: "#E6E8EA" };

export interface Day { d: string; 긍정: number; 중립: number; 부정: number; 미분류: number; total: number }

export const md = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8, 10))}`;

function niceMax(v: number) {
  if (v <= 4) return 4;
  const step = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= v) return m * step;
  return 10 * step;
}

const STACK: Sent[] = ["부정", "중립", "긍정", "미분류"];

export function Timeline({
  daily,
  releases,
  peak,
  selected,
  onSelect,
}: {
  daily: Day[];
  releases: { title: string; d: string }[];
  peak: { d: string; total: number } | null;
  selected: string | null;
  onSelect: (d: string | null) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...daily.map((x) => x.total)));
  const relDays = new Map<string, string[]>();
  for (const r of releases) relDays.set(r.d, [...(relDays.get(r.d) || []), r.title]);
  const n = daily.length;
  const labelEvery = n <= 10 ? 1 : n <= 31 ? 7 : n <= 92 ? 14 : 60;
  const barMax = n <= 10 ? 28 : n <= 31 ? 16 : n <= 92 ? 7 : 3;
  const H = 180; // 막대 영역 높이
  const TOP = 26; // 보도자료 라벨 자리
  const AXIS = 20; // 날짜 라벨 자리
  const hx = hover !== null ? daily[hover] : null;

  return (
    <div className="select-none">
      <div className="relative pl-8">
        {/* 가로 기준선 + 눈금 */}
        {[0, 0.5, 1].map((r) => (
          <div key={r} className="absolute left-8 right-0" style={{ bottom: AXIS + r * H }}>
            <span className="absolute -left-8 w-6 -translate-y-1/2 text-right text-[10px] text-[#ADB5BD] tabular-nums">{Math.round(max * r)}</span>
            <div className={`w-full border-t ${r === 0 ? "border-[#CED4DA]" : "border-dashed border-[#EEF0F2]"}`} />
          </div>
        ))}

        <div className="relative flex items-end" style={{ height: TOP + H + AXIS }} onMouseLeave={() => setHover(null)}>
          {daily.map((x, i) => {
            const rel = relDays.get(x.d);
            const isSel = selected === x.d;
            const isPeak = peak?.d === x.d && x.total > 0;
            const segs = STACK.filter((s) => x[s] > 0);
            const h = (x.total / max) * H;
            const dim = selected && !isSel;
            return (
              <button
                key={x.d}
                onClick={() => onSelect(isSel ? null : x.d)}
                onMouseEnter={() => setHover(i)}
                aria-label={`${x.d} ${x.total}건`}
                className="relative flex-1 min-w-0 h-full flex flex-col justify-end items-center"
                style={{ paddingBottom: AXIS }}
              >
                {(hover === i || isSel) && (
                  <span className="absolute inset-x-[1px] rounded-md bg-[#25282B]/[0.04]" style={{ top: TOP, bottom: AXIS }} />
                )}
                {rel && (
                  <>
                    <span className="absolute left-1/2 border-l-[1.5px] border-dashed border-[#F26522]" style={{ top: TOP - 4, bottom: AXIS }} />
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 px-2 h-[20px] leading-[20px] rounded-full bg-[#F26522] text-white text-[10px] font-semibold whitespace-nowrap z-10 shadow-sm">
                      보도자료
                    </span>
                  </>
                )}
                {isPeak && <span className="relative z-10 mb-1 text-[11px] font-bold text-[#25282B] tabular-nums">{x.total}</span>}
                <div className="relative w-full flex flex-col-reverse" style={{ height: h, maxWidth: barMax, opacity: dim ? 0.3 : 1 }}>
                  {segs.map((s, k) => (
                    <div
                      key={s}
                      className={k === segs.length - 1 ? "rounded-t-[4px]" : ""}
                      style={{
                        height: `${(x[s] / x.total) * 100}%`,
                        minHeight: 2,
                        background: COLOR[s],
                        // 조각 사이 2px 틈 (배경색 테두리)
                        borderTop: k > 0 ? "2px solid #fff" : undefined,
                      }}
                    />
                  ))}
                </div>
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[10px] text-[#ADB5BD] whitespace-nowrap">
                  {(n - 1 - i) % labelEvery === 0 ? md(x.d) : ""}
                </span>
              </button>
            );
          })}

          {/* 말풍선 */}
          {hx && (hx.total > 0 || relDays.has(hx.d)) && (
            <div
              className="pointer-events-none absolute z-20 w-[160px] p-2.5 rounded-xl bg-white shadow-[0_6px_20px_rgba(0,0,0,0.12)] border border-[#EEF0F2] text-[11px]"
              // 막대를 가리지 않게 옆으로: 오른쪽 절반이면 왼편, 아니면 오른편
              style={
                hover! / n > 0.5
                  ? { top: TOP + 4, right: `calc(${((n - hover! - 0.5) / n) * 100}% + 14px)` }
                  : { top: TOP + 4, left: `calc(${((hover! + 0.5) / n) * 100}% + 14px)` }
              }
            >
              <p className="font-semibold text-[#25282B] mb-1">{hx.d.replace(/-/g, ".")} · {hx.total}건</p>
              {STACK.filter((s) => hx[s] > 0).map((s) => (
                <p key={s} className="flex items-center justify-between text-[#495057] leading-5">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: COLOR[s] }} />{s}</span>
                  <span className="tabular-nums font-medium">{hx[s]}</span>
                </p>
              ))}
              {relDays.get(hx.d)?.map((t) => (
                <p key={t} className="mt-1 pt-1 border-t border-[#F1F3F5] text-[#D9551A] line-clamp-2">보도자료 · {t}</p>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pl-8 text-[11px] text-[#868E96]">
        {SENTS.map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: COLOR[s] }} />{s}
          </span>
        ))}
        <span className="text-[#ADB5BD]">· 막대를 누르면 그날 기사만 봅니다</span>
      </div>
    </div>
  );
}

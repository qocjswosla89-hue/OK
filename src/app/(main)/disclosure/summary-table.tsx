"use client";

import { useState } from "react";
import { DisclosureTable, DisclosureTableData } from "@/lib/disclosure-boards";

const TOTAL_RE = /총계|합계|당기순이익/;

export function SummaryTable({
  table,
  onCell,
}: {
  table: DisclosureTable;
  onCell?: (r: number, c: number, v: string) => void;
}) {
  // 앞쪽에서 숫자가 아닌 칸이 대부분인 열을 "구분" 열로 본다 (보통 1~2개)
  const NUM = /^[△▲\-−+]?[\d,.]+%?$|^-$|^\(?[△\-−]?[\d,.]+\)?$/;
  const isLabelCol = (j: number) => {
    const vals = table.rows.map((r) => (r[j] || "").split(" ")[0]).filter(Boolean);
    return vals.length > 0 && vals.filter((v) => !NUM.test(v)).length / vals.length > 0.5;
  };
  const labelCols = isLabelCol(0) ? (table.headers.length > 2 && isLabelCol(1) ? 2 : 1) : 1;
  const twoLabelCols = labelCols === 2;
  return (
    <div>
      {(table.period || table.unit) && (
        <div className="mb-2 space-y-0.5 text-[11px] text-[#868E96]">
          {table.period?.split(" / ").map((p) => <p key={p}>{p}</p>)}
          {table.unit && <p className="text-right">(단위 : {table.unit})</p>}
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-[#EEF0F2]">
        <table className="w-full min-w-[520px] text-[12px] border-collapse">
          <thead>
            <tr className="bg-[#F8F9FA]">
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  className={`px-2.5 py-2 font-semibold text-[#495057] border-b border-[#EEF0F2] align-bottom ${i === 0 || (twoLabelCols && i === 1) ? "text-left min-w-[90px]" : "text-right min-w-[76px]"} ${i === 0 && !twoLabelCols ? "min-w-[150px]" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => {
              const label = row.slice(0, twoLabelCols ? 2 : 1).join(" ");
              const total = TOTAL_RE.test(label);
              return (
                <tr key={r} className={`border-b border-[#F1F3F5] last:border-0 ${total ? "bg-[#FFF8F3]" : ""}`}>
                  {row.map((cell, c) => {
                    const isLabel = c === 0 || (twoLabelCols && c === 1);
                    return (
                      <td
                        key={c}
                        className={`px-2.5 py-1.5 ${isLabel ? "text-left text-[#343A40]" : "text-right tabular-nums text-[#25282B]"} ${total || (twoLabelCols && c === 0) ? "font-semibold" : ""} ${isLabel ? (twoLabelCols ? "whitespace-nowrap" : "min-w-[150px]") : "whitespace-nowrap"}`}
                      >
                        {onCell ? (
                          <input
                            value={cell}
                            onChange={(e) => onCell(r, c, e.target.value)}
                            className={`w-full min-w-[60px] bg-transparent outline-none border-b border-dashed border-[#DEE2E6] focus:border-[#F26522] ${isLabel ? "" : "text-right"}`}
                          />
                        ) : (
                          cell
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {table.note && (
        <div className="mt-2 space-y-0.5 text-[11px] text-[#868E96]">
          {table.note.split("\n").map((n) => <p key={n}>{n}</p>)}
        </div>
      )}
    </div>
  );
}

export function SummaryTabs({
  data,
  onCell,
}: {
  data: DisclosureTableData;
  onCell?: (t: number, r: number, c: number, v: string) => void;
}) {
  const [tab, setTab] = useState(0);
  const cur = Math.min(tab, data.tables.length - 1);
  if (data.tables.length === 0) return null;
  return (
    <div>
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {data.tables.map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i)}
            className={`shrink-0 px-3.5 h-8 rounded-full text-[13px] font-medium transition-colors ${i === cur ? "bg-[#1A1A1A] text-white" : "bg-[#F1F3F5] text-[#495057] hover:bg-[#E9ECEF]"}`}
          >
            {t.name || `표 ${i + 1}`}
          </button>
        ))}
      </div>
      <SummaryTable
        table={data.tables[cur]}
        onCell={onCell ? (r, c, v) => onCell(cur, r, c, v) : undefined}
      />
    </div>
  );
}

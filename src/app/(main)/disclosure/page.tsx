"use client";

import { ExternalLink } from "lucide-react";

const BOARDS = [
  {
    id: "suisi",
    label: "수시공시",
    url: "https://www.oksavingsbank.com/#/bankMngmAntm?menuCd=00354",
    desc: "경영 관련 주요 사항 수시 공시",
  },
  {
    id: "summary",
    label: "요약공시",
    url: "https://www.oksavingsbank.com/#/bankMngmSmryBsns?menuCd=00352",
    desc: "영업현황, 재무현황, 손익현황 요약",
  },
  {
    id: "result",
    label: "결산공시",
    url: "https://www.oksavingsbank.com/#/bankMngmStac?menuCd=00353",
    desc: "결산·가결산 공시 내역",
  },
];

export default function DisclosurePage() {
  return (
    <div>
      {/* 페이지 타이틀 */}
      <div className="px-4 pt-5 pb-4 flex items-center justify-between">
        <h1 className="text-[18px] font-bold text-[#1A1A1A]">경영공시</h1>
        <a
          href="https://www.oksavingsbank.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[11px] text-[#AAAAAA] hover:text-[#F26522] transition-colors"
        >
          OK저축은행 공식 홈페이지
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* 링크 카드 목록 */}
      <div className="px-4 space-y-3">
        {BOARDS.map((board) => (
          <a
            key={board.id}
            href={board.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-4 py-4 rounded-2xl bg-[#F5F4F2] hover:bg-[#EEECEA] active:bg-[#E5E3E0] transition-colors group"
          >
            <div>
              <p className="text-[15px] font-semibold text-[#1A1A1A] group-hover:text-[#F26522] transition-colors">
                {board.label}
              </p>
              <p className="text-[12px] text-[#AAAAAA] mt-0.5">{board.desc}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-[#AAAAAA] group-hover:text-[#F26522] transition-colors shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
}

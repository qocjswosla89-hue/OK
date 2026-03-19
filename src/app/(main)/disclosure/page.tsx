"use client";

import { useState } from "react";
import { ExternalLink, RefreshCw, AlertCircle } from "lucide-react";

const BOARDS = [
  {
    id: "suisi",
    label: "수시공시",
    url: "https://www.oksavingsbank.com/#!/conts00000",
    desc: "경영 관련 주요 사항 수시 공시",
  },
  {
    id: "summary",
    label: "요약공시",
    url: "https://www.oksavingsbank.com/#!/conts00100",
    desc: "영업현황, 재무현황, 손익현황 요약",
  },
  {
    id: "result",
    label: "결산공시",
    url: "https://www.oksavingsbank.com/#!/conts00200",
    desc: "결산·가결산 공시 내역",
  },
];

export default function DisclosurePage() {
  const [activeTab, setActiveTab] = useState(BOARDS[0].id);
  const [iframeError, setIframeError] = useState<Record<string, boolean>>({});
  const [reloadKey, setReloadKey] = useState(0);

  const current = BOARDS.find((b) => b.id === activeTab)!;

  const handleIframeError = (id: string) => {
    setIframeError((prev) => ({ ...prev, [id]: true }));
  };

  const handleReload = () => {
    setIframeError((prev) => ({ ...prev, [activeTab]: false }));
    setReloadKey((k) => k + 1);
  };

  return (
    <div>
      {/* 페이지 타이틀 */}
      <div className="px-4 pt-5 pb-1 flex items-center justify-between">
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

      {/* 탭 */}
      <div className="flex border-b border-[#EBEBEB]">
        {BOARDS.map((board) => (
          <button
            key={board.id}
            onClick={() => setActiveTab(board.id)}
            className={`flex-1 py-3.5 text-[13px] font-medium transition-colors relative ${
              activeTab === board.id ? "text-[#F26522]" : "text-[#999999]"
            }`}
          >
            {board.label}
            {activeTab === board.id && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-[#F26522] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 현재 탭 설명 + 원문 링크 */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-[#F8F8F8] border-b border-[#EBEBEB]">
        <p className="text-[11px] text-[#999999]">{current.desc}</p>
        <div className="flex items-center gap-2">
          {iframeError[activeTab] && (
            <button
              onClick={handleReload}
              className="flex items-center gap-1 text-[11px] text-[#AAAAAA] hover:text-[#F26522]"
            >
              <RefreshCw className="w-3 h-3" /> 새로고침
            </button>
          )}
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-[#F26522] font-medium"
          >
            원문 바로가기 <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* iframe 영역 */}
      <div className="relative" style={{ height: "calc(100dvh - 14rem)" }}>
        {iframeError[activeTab] ? (
          /* iframe 차단 시 폴백 */
          <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center">
            <AlertCircle className="w-10 h-10 text-[#AAAAAA]" />
            <p className="text-sm font-medium text-[#333]">
              해당 페이지는 직접 임베드가 제한되어 있습니다
            </p>
            <p className="text-xs text-[#AAAAAA] leading-relaxed">
              OK저축은행 공식 사이트에서 확인해주세요
            </p>
            <a
              href={current.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-[#F26522] text-white text-sm font-semibold rounded-xl"
            >
              <ExternalLink className="w-4 h-4" />
              {current.label} 보러가기
            </a>
          </div>
        ) : (
          <iframe
            key={`${activeTab}-${reloadKey}`}
            src={current.url}
            title={current.label}
            className="w-full h-full border-0"
            onError={() => handleIframeError(activeTab)}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
          />
        )}
      </div>
    </div>
  );
}

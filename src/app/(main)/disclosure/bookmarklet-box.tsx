"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, ChevronDown, ChevronUp } from "lucide-react";
import { buildBookmarklet } from "@/lib/disclosure-bookmarklet";

// 관리자 전용: OK저축은행 홈페이지에서 누를 즐겨찾기 버튼 설치 안내
export function BookmarkletBox() {
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // React는 javascript: 주소를 막으므로 직접 속성으로 넣는다
    linkRef.current?.setAttribute("href", buildBookmarklet(window.location.origin));
  }, [open]);

  return (
    <div className="mx-4 mb-4 rounded-2xl border border-[#F0E4D9] bg-[#FFF8F3]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-[13px] font-semibold text-[#D9551A]">홈페이지 공시 가져오기 (관리자)</span>
        {open ? <ChevronUp className="w-4 h-4 text-[#D9551A]" /> : <ChevronDown className="w-4 h-4 text-[#D9551A]" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-[12px] text-[#495057] leading-relaxed">
          <div>
            <p className="font-semibold mb-1">① 처음 한 번만 — 아래 주황 버튼을 크롬 즐겨찾기바로 끌어다 놓기</p>
            <a
              ref={linkRef}
              onClick={(e) => { e.preventDefault(); alert("이 버튼은 여기서 누르는 게 아니라, 크롬 즐겨찾기바로 끌어다 놓은 뒤 OK저축은행 홈페이지에서 누르는 버튼입니다."); }}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-[#F26522] text-white font-semibold cursor-grab"
            >
              <Bookmark className="w-3.5 h-3.5" />
              okpr 공시 가져오기
            </a>
            <p className="text-[11px] text-[#868E96] mt-1">즐겨찾기바가 안 보이면 Ctrl+Shift+B</p>
          </div>
          <div>
            <p className="font-semibold mb-1">② 새 공시가 올라오면</p>
            <p>OK저축은행 홈페이지 → 은행소개 → 경영공시 → <b>수시공시 / 결산·가결산공시 / 요약공시</b> 화면을 열고 즐겨찾기바의 <b>okpr 공시 가져오기</b>를 누르세요.</p>
            <p>okpr로 넘어와 새로 올라온 공시만 보여줍니다. <b>등록</b>(요약공시는 <b>교체</b>)을 누르면 끝입니다.</p>
          </div>
          <p className="text-[11px] text-[#868E96]">이 크롬에서 okpr 관리자로 로그인돼 있어야 합니다. 요약공시는 4개 탭을 차례로 눌러 읽으므로 몇 초 걸립니다.</p>
        </div>
      )}
    </div>
  );
}

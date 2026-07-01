"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { getAdminSession, setAdminSession } from "@/lib/auth";

export default function Header({ title, description }: { title: string; description?: string }) {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { setIsAdmin(getAdminSession()); }, []);

  function handleLogout() {
    setAdminSession(false);
    setIsAdmin(false);
    window.location.reload();
  }

  return (
    <header className="bg-white border-b border-[#DEE2E6] px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-[#25282B]">{title}</h1>
        {description && (
          <p className="text-sm text-[#868E96] mt-0.5">{description}</p>
        )}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-3">
          <button className="relative w-10 h-10 rounded-xl bg-[#F8F9FA] flex items-center justify-center hover:bg-[#F0E4D9] transition-colors">
            <Bell className="w-[18px] h-[18px] text-[#868E96]" />
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#F26522] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              3
            </span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg border border-[#F0E4D9] text-[12px] font-medium text-[#8C6B58] hover:bg-[#FFF8F3] hover:text-[#F26522] transition-colors"
          >
            관리자 로그아웃
          </button>
        </div>
      )}
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PenTool,
  Archive,
  FilePlus,
  ClipboardList,
  FileText,
  MessageCircle,
  Eye,
  Settings,
  Flame,
} from "lucide-react";

const NAV = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/draft", label: "초안 생성", icon: PenTool },
  { href: "/archive", label: "아카이브", icon: Archive },
  { href: "/request", label: "보도자료 신청", icon: FilePlus },
  { href: "/dart", label: "DART 공시", icon: FileText },
  { href: "/chatbot", label: "Q&A 챗봇", icon: MessageCircle },
  { href: "/competitors", label: "경쟁사 동향", icon: Eye },
  { href: "/admin", label: "관리자", icon: Settings, adminOnly: true },
] as const;

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 min-h-screen bg-[#FFF8F3] border-r border-[#F0E4D9] flex flex-col">
      {/* 로고 */}
      <div className="px-5 pt-7 pb-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#F26522] flex items-center justify-center shadow-md shadow-orange-200">
            <Flame className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#25282B] tracking-tight">
              OK금융그룹
            </p>
            <p className="text-[10px] text-[#99857A] tracking-wide">
              보도자료 관리 시스템
            </p>
          </div>
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all duration-200 ${
                isActive
                  ? "bg-[#F26522]/10 text-[#F26522] font-semibold"
                  : "text-[#8C6B58] hover:bg-[#F26522]/5 hover:text-[#C44D15]"
              }`}
            >
              <Icon
                className={`w-[18px] h-[18px] ${
                  isActive ? "text-[#F26522]" : "text-[#C4A78F]"
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* 하단 */}
      <div className="px-5 py-4 border-t border-[#F0E4D9]">
        <p className="text-[11px] text-[#C4A78F]">
          &copy; OK금융그룹 홍보실
        </p>
      </div>
    </aside>
  );
}

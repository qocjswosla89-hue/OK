"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Archive, Sparkles, MessageCircle } from "lucide-react";
import NotificationDropdown from "@/components/NotificationDropdown";

const BOTTOM_NAV = [
  { href: "/", label: "홈", icon: Home },
  { href: "/archive", label: "아카이브", icon: Archive },
  { href: "/draft", label: "초안생성", icon: Sparkles },
  { href: "/chatbot", label: "챗봇", icon: MessageCircle },
];

const TOP_NAV = [
  { href: "/", label: "대시보드" },
  { href: "/archive", label: "아카이브" },
  { href: "/draft", label: "초안 생성" },
  { href: "/reporters", label: "출입기자" },
  { href: "/dart", label: "DART" },
  { href: "/chatbot", label: "AI 챗봇" },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-white">
      {/* Top Nav Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-[#EBEBEB] h-14">
        <div className="max-w-3xl mx-auto h-full px-4 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.gif"
              alt="OK금융그룹"
              className="h-8 w-auto object-contain"
            />
            <span className="hidden sm:inline text-[11px] text-[#AAAAAA] font-normal mt-0.5">
              미디어센터
            </span>
          </Link>

          {/* Center Nav (desktop only) */}
          <nav className="hidden md:flex items-center gap-1">
            {TOP_NAV.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-colors ${
                    isActive
                      ? "text-[#F26522] bg-[#F26522]/8"
                      : "text-[#555555] hover:text-[#F26522] hover:bg-[#F5F4F2]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Bell + Avatar */}
          <div className="flex items-center gap-2">
            <NotificationDropdown />
            <div className="w-8 h-8 rounded-full bg-[#F26522] flex items-center justify-center">
              <span className="text-white text-[11px] font-bold">관</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <main className="pt-14 pb-20 md:pb-6 max-w-3xl mx-auto w-full">
        {children}
      </main>

      {/* Bottom Nav (mobile only) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[#EBEBEB] h-16 safe-area-inset-bottom">
        <div className="flex h-full">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center gap-0.5"
              >
                <Icon
                  className={`w-5 h-5 ${
                    isActive ? "text-[#F26522]" : "text-[#AAAAAA]"
                  }`}
                />
                <span
                  className={`text-[10px] font-medium ${
                    isActive ? "text-[#F26522]" : "text-[#AAAAAA]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

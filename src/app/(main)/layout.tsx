"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Archive, Sparkles, MessageCircle } from "lucide-react";
import NotificationDropdown from "@/components/NotificationDropdown";
import { getAdminSession, setAdminSession } from "@/lib/auth";

const BOTTOM_NAV = [
  { href: "/", label: "홈", icon: Home },
  { href: "/archive", label: "아카이브", icon: Archive, adminOnly: true },
  { href: "/draft", label: "초안생성", icon: Sparkles, adminOnly: true },
  { href: "/chatbot", label: "챗봇", icon: MessageCircle },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => { setIsAdmin(getAdminSession()); }, []);

  function handleLogout() {
    setAdminSession(false);
    setIsAdmin(false);
    window.location.href = "/";
  }

  const visibleNav = BOTTOM_NAV.filter((item) => !item.adminOnly || isAdmin);

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

          {/* Right: Bell + Admin (admin only) */}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <>
                <NotificationDropdown />
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F5F4F2] hover:bg-[#F0E4D9] transition-colors"
                >
                  <div className="w-5 h-5 rounded-full bg-[#F26522] flex items-center justify-center">
                    <span className="text-white text-[9px] font-bold">관</span>
                  </div>
                  <span className="text-[11px] font-medium text-[#555555]">로그아웃</span>
                </button>
              </>
            )}
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
          {visibleNav.map((item) => {
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

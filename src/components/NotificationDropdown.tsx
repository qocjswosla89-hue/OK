"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  created_at: string;
  read: boolean;
  related_id: number | null;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay >= 1) return `${diffDay}일 전`;
  if (diffHour >= 1) return `${diffHour}시간 전`;
  if (diffMin >= 1) return `${diffMin}분 전`;
  return "방금 전";
}

const TYPE_ICON_COLOR: Record<string, string> = {
  info: "bg-[#327DF5]/10 text-[#327DF5]",
  success: "bg-[#40C057]/10 text-[#40C057]",
  warning: "bg-[#FDB913]/15 text-[#B8860B]",
  error: "bg-[#E64980]/10 text-[#E64980]",
};

export default function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [open]);

  const unreadCount = notifications.length;

  async function markAsRead(id: number) {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // silent
    }
  }

  async function markAllAsRead() {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications([]);
    } catch {
      // silent
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#F5F4F2] transition-colors"
        aria-label="알림"
      >
        <Bell className="w-[18px] h-[18px] text-[#666666]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] bg-[#F26522] rounded-full flex items-center justify-center">
            {unreadCount <= 9 ? (
              <span className="text-white text-[8px] font-bold leading-none px-0.5">
                {unreadCount}
              </span>
            ) : (
              <span className="text-white text-[8px] font-bold leading-none px-0.5">9+</span>
            )}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 w-80 bg-white border border-[#EBEBEB] rounded-2xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#EBEBEB]">
            <span className="text-[14px] font-semibold text-[#1A1A1A]">알림</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[12px] text-[#F26522] font-medium hover:underline"
              >
                모두 읽음
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-[13px] text-[#AAAAAA]">
                불러오는 중...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#AAAAAA]">
                새로운 알림이 없습니다
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className="px-4 py-3 hover:bg-[#FAFAFA] transition-colors cursor-pointer border-b border-[#F5F5F5] last:border-b-0"
                  onClick={() => markAsRead(n.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Type indicator dot */}
                    <div
                      className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                        n.type === "success"
                          ? "bg-[#40C057]"
                          : n.type === "warning"
                          ? "bg-[#FDB913]"
                          : n.type === "error"
                          ? "bg-[#E64980]"
                          : "bg-[#327DF5]"
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1A1A1A] leading-snug truncate">
                        {n.title}
                      </p>
                      {n.message && (
                        <p className="text-[12px] text-[#666666] mt-0.5 line-clamp-2 leading-snug">
                          {n.message}
                        </p>
                      )}
                      <p className="text-[11px] text-[#AAAAAA] mt-1">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {/* Type badge */}
                    {n.type && (
                      <span
                        className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                          TYPE_ICON_COLOR[n.type] || "bg-[#868E96]/10 text-[#868E96]"
                        }`}
                      >
                        {n.type === "info"
                          ? "정보"
                          : n.type === "success"
                          ? "완료"
                          : n.type === "warning"
                          ? "주의"
                          : n.type === "error"
                          ? "오류"
                          : n.type}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

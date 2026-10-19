"use client";

export async function checkAdmin(id: string, pw: string): Promise<boolean> {
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, pw }),
  });
  return res.ok;
}

export function getAdminSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem("ok-admin") === "true";
}

export function setAdminSession(value: boolean) {
  if (typeof window === "undefined") return;
  if (value) sessionStorage.setItem("ok-admin", "true");
  else sessionStorage.removeItem("ok-admin");
}

// 로그아웃: 서버 쿠키 삭제가 끝난 뒤에 화면을 이동해야 함
// (예전엔 기다리지 않고 바로 이동 → 새 화면의 세션 확인이 삭제보다 먼저 도착해 관리자 상태가 되살아났음)
export async function logoutAdmin(): Promise<void> {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem("ok-admin");
  try {
    await fetch("/api/admin/session", { method: "DELETE", cache: "no-store" });
  } catch { /* 네트워크 실패해도 화면 표시는 끔 */ }
}

// 화면의 관리자 표시를 서버 세션(쿠키)과 맞춘다.
// 쿠키가 만료됐으면 관리자 표시를 끄고, 새 탭이라도 쿠키가 유효하면 관리자 상태를 복원한다.
// 상태가 바뀌었으면 true (호출한 쪽에서 새로고침)
export async function syncAdminSession(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const res = await fetch("/api/admin/session", { cache: "no-store" });
    if (!res.ok) return false;
    const { admin } = await res.json();
    const local = getAdminSession();
    if (admin === local) return false;
    if (admin) sessionStorage.setItem("ok-admin", "true");
    else sessionStorage.removeItem("ok-admin");
    return true;
  } catch {
    return false;
  }
}

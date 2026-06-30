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
  if (value) {
    sessionStorage.setItem("ok-admin", "true");
  } else {
    sessionStorage.removeItem("ok-admin");
  }
}

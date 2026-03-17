"use client";

const ADMIN_ID = "OK01";
const ADMIN_PW = "OK01";

export function checkAdmin(id: string, pw: string): boolean {
  return id === ADMIN_ID && pw === ADMIN_PW;
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

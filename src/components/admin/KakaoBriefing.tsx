"use client";

import { useState, useEffect } from "react";
import { MessageCircle, Send, Link2, Unlink, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";

// 관리자 > 카톡 브리핑: 카카오톡 연결, 테스트 발송, 상태 표시

interface Status { configured: boolean; connected: boolean; refreshExpiresAt: string | null; lastBriefingKey: string | null }

const CALLBACK_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "카카오톡이 연결됐습니다. [테스트 발송]으로 확인해 보세요." },
  invalid_state: { ok: false, text: "연결 요청이 만료됐습니다. 다시 시도해 주세요." },
  access_denied: { ok: false, text: "카카오 동의가 취소됐습니다." },
  token_error: { ok: false, text: "카카오 토큰 발급에 실패했습니다. REST API 키·Redirect URI 설정을 확인해 주세요." },
};

export default function KakaoBriefing({ callbackResult }: { callbackResult: string | null }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    callbackResult ? CALLBACK_MESSAGES[callbackResult] || { ok: false, text: `연결 실패 (${callbackResult})` } : null,
  );
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/kakao/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setStatus(data);
    } catch (e) {
      setMsg({ ok: false, text: `상태 조회 실패: ${e instanceof Error ? e.message : String(e)}` });
    }
  }
  useEffect(() => { load(); }, []);

  async function testSend() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/kakao/status", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMsg(data.sent ? { ok: true, text: `${data.key} 브리핑을 카카오톡으로 보냈습니다.` } : { ok: false, text: data.reason || "발송되지 않았습니다" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    await fetch("/api/kakao/status", { method: "DELETE" }).catch(() => {});
    await load();
    setBusy(false);
    setMsg({ ok: true, text: "연결을 해제했습니다." });
  }

  // 카톡 없이도 지금 시간대 브리핑을 만들어 공유 페이지로 확인
  async function preview() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/briefing", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      window.open(`/briefing?key=${data.key}`, "_blank");
    } catch (e) {
      setMsg({ ok: false, text: `브리핑 생성 실패: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[#EBEBEB] p-4">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="w-4 h-4 text-[#FAB005]" />
          <h3 className="text-sm font-bold text-[#25282B]">이슈 브리핑 카톡 알림 (선택)</h3>
        </div>
        <p className="text-[12px] text-[#868E96] leading-relaxed">
          이슈 브리핑은 매일 오전·오후 <b>이슈 브리핑 게시판</b>(/briefing)에 자동으로 정리됩니다.
          카카오톡을 연결하면 정리될 때마다 <b>나와의 채팅</b>으로 알림과 바로가기 링크도 받을 수 있습니다.
        </p>

        <div className="mt-3 flex items-center gap-2 text-[12px]">
          {!status ? (
            <span className="text-[#AAAAAA]">상태 확인 중...</span>
          ) : !status.configured ? (
            <span className="flex items-center gap-1 text-[#E67700]"><AlertTriangle className="w-3.5 h-3.5" />카카오 앱 키(KAKAO_REST_API_KEY)가 아직 설정되지 않았습니다</span>
          ) : status.connected ? (
            <span className="flex items-center gap-1 text-[#2F9E44]"><CheckCircle2 className="w-3.5 h-3.5" />연결됨{status.lastBriefingKey && <span className="text-[#AAAAAA] ml-1">· 마지막 발송 {status.lastBriefingKey.replace(/-am$/, " 오전").replace(/-pm$/, " 오후")}</span>}</span>
          ) : (
            <span className="text-[#868E96]">연결 안 됨</span>
          )}
        </div>

        {status && (
          <div className="mt-3 flex flex-wrap gap-2">
            {!status.configured ? null : !status.connected ? (
              <a href="/api/kakao/connect" className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-[#FEE500] text-[#191919] text-[12px] font-semibold">
                <Link2 className="w-3.5 h-3.5" />카카오톡 연결
              </a>
            ) : (
              <>
                <button onClick={testSend} disabled={busy}
                  className="h-9 px-3 flex items-center gap-1.5 rounded-xl bg-[#F26522] text-white text-[12px] font-semibold disabled:opacity-50">
                  <Send className="w-3.5 h-3.5" />{busy ? "보내는 중..." : "지금 테스트 발송"}
                </button>
                <button onClick={disconnect} disabled={busy}
                  className="h-9 px-3 flex items-center gap-1.5 rounded-xl border border-[#DEDEDE] text-[#868E96] text-[12px] font-semibold disabled:opacity-50">
                  <Unlink className="w-3.5 h-3.5" />연결 해제
                </button>
              </>
            )}
            <button onClick={preview} disabled={busy}
              className="h-9 px-3 flex items-center gap-1.5 rounded-xl border border-[#DEDEDE] text-[#555555] text-[12px] font-semibold disabled:opacity-50">
              <ExternalLink className="w-3.5 h-3.5" />{busy ? "정리 중... (30초 내외)" : "지금 브리핑 정리해 보기"}
            </button>
          </div>
        )}

        {msg && (
          <p className={`mt-3 text-[12px] ${msg.ok ? "text-[#2F9E44]" : "text-[#E64980]"}`}>{msg.text}</p>
        )}
      </div>

      {status && !status.configured && (
        <div className="bg-[#FFF9DB] rounded-2xl border border-[#FFE066] p-4 text-[12px] text-[#5C4A00] leading-relaxed">
          <p className="font-bold mb-1">처음 한 번만 설정이 필요합니다</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li>developers.kakao.com → 내 애플리케이션 → 애플리케이션 추가</li>
            <li>앱 설정 → 플랫폼 → Web 사이트 도메인에 <code>https://okpr.vercel.app</code> 등록</li>
            <li>카카오 로그인 → 활성화 ON, Redirect URI에 <code>https://okpr.vercel.app/api/kakao/callback</code> 등록</li>
            <li>동의항목 → <b>카카오톡 메시지 전송</b> 선택 동의로 설정</li>
            <li>앱 키의 <b>REST API 키</b>를 Vercel 환경변수 <code>KAKAO_REST_API_KEY</code>로 추가 후 재배포</li>
          </ol>
        </div>
      )}
    </div>
  );
}

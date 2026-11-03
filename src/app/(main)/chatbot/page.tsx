"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp,
  Square,
  Copy,
  Check,
  RotateCcw,
  SquarePen,
  FileText,
  Newspaper,
  Landmark,
  MessageSquareQuote,
  Globe,
  Building2,
  CalendarDays,
  ExternalLink,
  Search,
  TrendingUp,
  ShieldAlert,
  Users,
} from "lucide-react";

const SUGGESTED_QUESTIONS = [
  { icon: TrendingUp, text: "OK저축은행 최근 실적 요약해줘" },
  { icon: FileText, text: "이번 달 배포한 보도자료 정리해줘" },
  { icon: Newspaper, text: "최근 OK금융그룹 부정 기사 있었어?" },
  { icon: ShieldAlert, text: "개인정보 관련 기자 문의 오면 어떻게 답해?" },
  { icon: Users, text: "ESG·사회공헌 관련 최근 보도 알려줘" },
  { icon: Search, text: "SBI저축은행 최근 동향은?" },
];

const SUBSIDIARIES = ["전체", "OK저축은행", "OK캐피탈", "OK금융그룹"];
const PERIODS = ["전체 기간", "최근 1개월", "최근 3개월", "최근 6개월", "최근 1년"];

interface DbSource {
  n: number;
  title: string;
  type: string;
  date: string;
  url?: string;
}

interface WebSource {
  url: string;
  title: string;
}

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  dbSources?: DbSource[];
  webSources?: WebSource[];
  status?: string;
  streaming?: boolean;
}

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function sourceIcon(type: string) {
  if (type === "보도자료") return FileText;
  if (type === "언론 보도") return Newspaper;
  if (type.startsWith("DART")) return Landmark;
  return MessageSquareQuote;
}

// 본문의 [1], [1, 2] 표기를 각주 링크로 바꿔 배지로 렌더링
function linkCitations(text: string, max: number): string {
  return text.replace(/\[(\d+(?:\s*,\s*\d+)*)\](?!\()/g, (whole, nums: string) => {
    const list = nums.split(",").map((s) => s.trim()).filter((s) => Number(s) >= 1 && Number(s) <= max);
    return list.length ? list.map((n) => `[${n}](#cite-${n})`).join("") : whole;
  });
}

function FilterChip({ icon: Icon, value, options, onChange }: {
  icon: typeof Building2; value: string; options: string[]; onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const active = value !== options[0];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors ${
          active ? "bg-[#FFF1E8] text-[#D9541A]" : "text-[#6C757D] hover:bg-[#F1F3F5]"
        }`}
      >
        <Icon className="w-3.5 h-3.5" />
        {value}
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-20 min-w-[140px] rounded-xl border border-[#E9ECEF] bg-white p-1 shadow-lg">
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setOpen(false); }}
              className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs ${
                o === value ? "bg-[#FFF1E8] text-[#D9541A] font-semibold" : "text-[#495057] hover:bg-[#F8F9FA]"
              }`}
            >
              {o}
              {o === value && <Check className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Answer({ msg, onCite }: { msg: ChatMessage; onCite: (n: number) => void }) {
  const max = msg.dbSources?.length ?? 0;
  const text = max > 0 ? linkCitations(msg.text, max) : msg.text.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, "");
  return (
    <div className="text-[14px] leading-[1.75] text-[#25282B] break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 space-y-1 pl-5 list-disc marker:text-[#CED4DA]">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 space-y-1 pl-5 list-decimal marker:text-[#ADB5BD]">{children}</ol>,
          strong: ({ children }) => <strong className="font-semibold text-[#1A1A1A]">{children}</strong>,
          h1: ({ children }) => <p className="mt-3 mb-1 font-semibold">{children}</p>,
          h2: ({ children }) => <p className="mt-3 mb-1 font-semibold">{children}</p>,
          h3: ({ children }) => <p className="mt-3 mb-1 font-semibold">{children}</p>,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-[#E9ECEF]">
              <table className="w-full text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="bg-[#F8F9FA] px-3 py-2 text-left font-semibold text-[#495057] whitespace-nowrap">{children}</th>,
          td: ({ children }) => <td className="border-t border-[#F1F3F5] px-3 py-2 whitespace-nowrap">{children}</td>,
          code: ({ children }) => <code className="rounded bg-[#F1F3F5] px-1 py-0.5 text-[13px]">{children}</code>,
          a: ({ href, children }) => {
            const m = href?.match(/^#cite-(\d+)$/);
            if (m) {
              return (
                <button
                  type="button"
                  onClick={() => onCite(Number(m[1]))}
                  className="mx-0.5 inline-flex h-[18px] min-w-[18px] -translate-y-px items-center justify-center rounded-md bg-[#F1F3F5] px-1 align-middle text-[10.5px] font-semibold text-[#868E96] hover:bg-[#FFE3D3] hover:text-[#D9541A]"
                >
                  {children}
                </button>
              );
            }
            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#D9541A] underline underline-offset-2">{children}</a>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
      {msg.streaming && msg.text && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-[#F26522]" />}
    </div>
  );
}

function Sources({ id, msg, highlight }: { id: number; msg: ChatMessage; highlight: string | null }) {
  const [showAll, setShowAll] = useState(false);
  const db = msg.dbSources ?? [];
  const web = msg.webSources ?? [];
  if (db.length === 0 && web.length === 0) return null;
  // 접힌 자료의 각주를 누르면 펼쳐서 보여줌
  const citedHidden = highlight?.startsWith(`src-${id}-`) && Number(highlight.split("-")[2]) > 4;
  const visible = showAll || citedHidden ? db : db.slice(0, 4);
  const card = (key: string, n: ReactNode, Icon: typeof FileText, title: string, meta: string, url?: string) => {
    const cls = `group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
      highlight === key ? "border-[#F26522] bg-[#FFF8F3]" : "border-[#EEF0F2] bg-white hover:border-[#DEE2E6] hover:bg-[#FAFAFA]"
    }`;
    const inner = (
      <>
        <span className="mt-0.5 flex h-5 min-w-5 items-center justify-center rounded-md bg-[#F1F3F5] px-1 text-[10.5px] font-semibold text-[#868E96]">{n}</span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[12px] font-medium leading-snug text-[#343A40]">{title}</p>
          <p className="mt-1 flex items-center gap-1 text-[10.5px] text-[#ADB5BD]">
            <Icon className="h-3 w-3" />
            {meta}
            {url && <ExternalLink className="ml-auto h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />}
          </p>
        </div>
      </>
    );
    return url
      ? <a key={key} id={key} href={url} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
      : <div key={key} id={key} className={cls}>{inner}</div>;
  };
  return (
    <div className="mt-4 space-y-2">
      {db.length > 0 && (
        <>
          <p className="text-[11px] font-semibold text-[#ADB5BD]">참고 자료 {db.length}건</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visible.map((s) => card(`src-${id}-${s.n}`, s.n, sourceIcon(s.type), s.title, `${s.type} · ${s.date}`, s.url))}
          </div>
          {db.length > 4 && (
            <button type="button" onClick={() => setShowAll(!showAll)} className="text-[11px] font-medium text-[#868E96] hover:text-[#D9541A]">
              {showAll ? "접기" : `${db.length - 4}건 더 보기`}
            </button>
          )}
        </>
      )}
      {web.length > 0 && (
        <>
          <p className="pt-1 text-[11px] font-semibold text-[#ADB5BD]">웹 검색</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {web.map((w, j) => card(`web-${id}-${j}`, <Globe className="h-3 w-3" />, Globe, w.title, "외부 웹", w.url))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedSub, setSelectedSub] = useState("전체");
  const [selectedPeriod, setSelectedPeriod] = useState("전체 기간");
  const [copied, setCopied] = useState<number | null>(null);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(() => generateSessionId());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stickRef = useRef(true);

  // 사용자가 위로 스크롤해 읽는 중이면 자동 스크롤을 멈춤
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [inputValue]);

  const updateLast = (patch: Partial<ChatMessage>) =>
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = { ...next[next.length - 1], ...patch };
      return next;
    });

  const saveChatLog = async (question: string, answer: string, dbSources: DbSource[], webSources: WebSource[]) => {
    try {
      await fetch("/api/data/chat-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, user_name: "anonymous", question, answer, sources: [...dbSources, ...webSources] }),
      });
    } catch (err) {
      console.error("Save chat log error:", err);
    }
  };

  const handleSend = async (text?: string, base: ChatMessage[] = messages) => {
    const question = (text ?? inputValue).trim();
    if (!question || busy) return;

    setInputValue("");
    stickRef.current = true;
    setMessages([...base, { role: "user", text: question }, { role: "ai", text: "", status: "질문을 이해하는 중", streaming: true }]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let streamText = "";
    let dbSources: DbSource[] = [];
    let webSources: WebSource[] = [];

    try {
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          question,
          history: base.filter((m) => m.text).map((m) => ({ role: m.role, text: m.text })),
          subsidiary: selectedSub !== "전체" ? selectedSub : undefined,
          period: selectedPeriod !== "전체 기간" ? selectedPeriod : undefined,
        }),
      });

      if (!res.ok || !res.body) {
        const t = await res.text().catch(() => "");
        streamText = `오류가 발생했습니다 (${res.status}). ${t.slice(0, 200)}`;
        updateLast({ text: streamText, status: undefined, streaming: false });
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            let json;
            try { json = JSON.parse(line.slice(6)); } catch { continue; }
            if (json.status === "searching") {
              const kws = (json.keywords as string[] | undefined)?.slice(0, 3).join(", ");
              updateLast({ status: kws ? `‘${kws}’ 자료 찾는 중` : "자료 찾는 중" });
            } else if (json.status === "writing") {
              updateLast({ status: json.count > 0 ? `자료 ${json.count}건을 읽고 답변 작성 중` : json.web ? "웹에서 찾아보는 중" : "답변 작성 중" });
            }
            if (json.text) {
              streamText += json.text;
              updateLast({ text: streamText, status: undefined });
            }
            if (json.done) {
              dbSources = json.dbSources || [];
              webSources = json.webSources || [];
              updateLast({ dbSources, webSources });
            }
            if (json.error) {
              streamText = `답변 중 오류가 발생했습니다: ${json.error}`;
              updateLast({ text: streamText, status: undefined });
            }
          }
        }
        updateLast({ streaming: false, status: undefined });
      }
    } catch (err) {
      if (controller.signal.aborted) {
        if (!streamText) streamText = "답변을 중단했습니다.";
        updateLast({ text: streamText, status: undefined, streaming: false });
      } else {
        streamText = `연결 오류: ${err instanceof Error ? err.message : String(err)}`;
        updateLast({ text: streamText, status: undefined, streaming: false });
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      inputRef.current?.focus();
    }
    if (streamText) saveChatLog(question, streamText, dbSources, webSources);
  };

  const regenerate = () => {
    const lastUser = [...messages].reverse().findIndex((m) => m.role === "user");
    if (lastUser < 0) return;
    const idx = messages.length - 1 - lastUser;
    handleSend(messages[idx].text, messages.slice(0, idx));
  };

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setSessionId(generateSessionId());
    inputRef.current?.focus();
  };

  const copy = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, "").replace(/\*\*/g, ""));
      setCopied(i);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* 클립보드 권한 없음 */ }
  };

  const cite = (i: number, n: number) => {
    const key = `src-${i}-${n}`;
    document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    setHighlight(key);
    setTimeout(() => setHighlight(null), 1600);
  };

  const empty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4rem)] md:h-[calc(100dvh-3.5rem-1.5rem)]">
      <div className="flex items-center justify-between px-4 pt-5 pb-2 shrink-0">
        <h1 className="text-[18px] font-bold text-[#1A1A1A]">AI 챗봇</h1>
        {!empty && (
          <button
            type="button"
            onClick={newChat}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium text-[#495057] hover:bg-[#F1F3F5]"
          >
            <SquarePen className="w-3.5 h-3.5" />
            새 대화
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="flex-1 overflow-y-auto min-h-0"
      >
        <div className={`mx-auto w-full max-w-3xl px-4 ${empty ? "h-full" : ""}`}>
          {empty ? (
            <div className="flex min-h-full flex-col items-center justify-center py-10 text-center">
              <img src="/imo/okman_2d_default_05.png" alt="읏맨" className="mb-4 h-auto w-20 object-contain" />
              <h3 className="mb-1.5 text-lg font-bold text-[#25282B]">무엇을 찾아드릴까요?</h3>
              <p className="mb-7 text-[13px] leading-relaxed text-[#868E96]">
                보도자료·언론 보도·FAQ·DART 공시를 찾아 근거와 함께 답합니다
              </p>
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map(({ icon: Icon, text }) => (
                  <button
                    key={text}
                    type="button"
                    onClick={() => handleSend(text)}
                    className="flex items-center gap-3 rounded-xl border border-[#EEF0F2] bg-white px-4 py-3 text-left text-[13px] text-[#495057] transition-colors hover:border-[#F5C6AA] hover:bg-[#FFF8F3]"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-[#F26522]" />
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-7 py-4">
              {messages.map((msg, i) =>
                msg.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-[#F1F3F5] px-4 py-2.5 text-[14px] leading-relaxed text-[#25282B]">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <img src="/imo/okman_2d_default_05.png" alt="" className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-[#FFF1E8] object-contain p-0.5" />
                    <div className="min-w-0 flex-1 pt-0.5">
                      {msg.status && !msg.text ? (
                        <div className="flex items-center gap-2 text-[13px] text-[#868E96]">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#F26522]/50" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#F26522]" />
                          </span>
                          <span className="animate-pulse">{msg.status}</span>
                        </div>
                      ) : (
                        <Answer msg={msg} onCite={(n) => cite(i, n)} />
                      )}
                      {!msg.streaming && <Sources id={i} msg={msg} highlight={highlight} />}
                      {!msg.streaming && msg.text && (
                        <div className="mt-2 flex items-center gap-0.5 text-[#ADB5BD]">
                          <button type="button" title="복사" onClick={() => copy(i, msg.text)} className="rounded-md p-1.5 hover:bg-[#F1F3F5] hover:text-[#495057]">
                            {copied === i ? <Check className="h-3.5 w-3.5 text-[#2F9E44]" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                          {i === messages.length - 1 && (
                            <button type="button" title="다시 답변" onClick={regenerate} className="rounded-md p-1.5 hover:bg-[#F1F3F5] hover:text-[#495057]">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 bg-white px-4 pb-3 pt-2">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl border border-[#DEE2E6] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.04)] focus-within:border-[#F5B48E]">
            <textarea
              ref={inputRef}
              rows={1}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                // 한글 조합 중 Enter는 글자 확정용이라 전송하면 마지막 글자가 중복됨
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="질문을 입력하세요 (Shift+Enter 줄바꿈)"
              className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[14px] leading-relaxed text-[#25282B] outline-none placeholder:text-[#ADB5BD]"
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center">
                <FilterChip icon={Building2} value={selectedSub} options={SUBSIDIARIES} onChange={setSelectedSub} />
                <FilterChip icon={CalendarDays} value={selectedPeriod} options={PERIODS} onChange={setSelectedPeriod} />
              </div>
              {busy ? (
                <button
                  type="button"
                  title="중단"
                  onClick={() => abortRef.current?.abort()}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#25282B] text-white hover:bg-[#495057]"
                >
                  <Square className="h-3 w-3 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  title="보내기"
                  onClick={() => handleSend()}
                  disabled={!inputValue.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F26522] text-white transition-colors hover:bg-[#D9541A] disabled:bg-[#E9ECEF] disabled:text-[#ADB5BD]"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-1.5 text-center text-[10.5px] text-[#ADB5BD]">
            AI 답변은 틀릴 수 있으니 숫자·인용은 참고 자료에서 확인하세요
          </p>
        </div>
      </div>
    </div>
  );
}

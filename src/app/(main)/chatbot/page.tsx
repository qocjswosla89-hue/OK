"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Sparkles,
  User,
  FileText,
  MessageCircle,
  Clock,
  Building2,
  CalendarDays,
  ChevronDown,
  Globe,
} from "lucide-react";

const SUGGESTED_QUESTIONS = [
  "OK저축은행 최근 실적 발표 내용을 요약해줘",
  "OK캐피탈 자동차금융 상품 관련 보도자료가 있어?",
  "ESG 관련 최근 보도자료를 찾아줘",
  "2025년 하반기 주요 공시 내용은?",
  "OK금융그룹 인사 발령 현황을 알려줘",
  "경쟁사 SBI저축은행 최근 동향은?",
];

const SUBSIDIARIES = ["전체", "OK저축은행", "OK캐피탈", "OK금융그룹"];
const PERIODS = ["전체 기간", "최근 1개월", "최근 3개월", "최근 6개월", "최근 1년"];

interface DbSource {
  title: string;
  type: string;
  date: string;
}

interface WebSource {
  url: string;
  title: string;
  type?: string;
  date?: string;
}

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  dbSources?: DbSource[];
  webSources?: WebSource[];
}

const INITIAL_MESSAGES: ChatMessage[] = [];

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export default function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSub, setSelectedSub] = useState("전체");
  const [selectedPeriod, setSelectedPeriod] = useState("전체 기간");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessionId] = useState(() => generateSessionId());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const saveChatLog = async (
    question: string,
    answer: string,
    dbSources?: DbSource[],
    webSources?: WebSource[]
  ) => {
    try {
      await fetch("/api/data/chat-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, user_name: "anonymous", question, answer, sources: [...(dbSources || []), ...(webSources || [])] }),
      });
    } catch (err) {
      console.error("Save chat log error:", err);
    }
  };

  const handleSend = async (text?: string) => {
    const question = text || inputValue.trim();
    if (!question) return;

    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setIsLoading(true);

    let aiText = "서버와 통신 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    let dbSources: DbSource[] = [];
    let webSources: WebSource[] = [];

    try {
      const history = messages.map((m) => ({ role: m.role, text: m.text }));
      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history,
          subsidiary: selectedSub !== "전체" ? selectedSub : undefined,
          period: selectedPeriod !== "전체 기간" ? selectedPeriod : undefined,
        }),
      });
      const data = await res.json();
      if (data.answer) {
        aiText = data.answer;
      }
      if (data.dbSources && data.dbSources.length > 0) {
        dbSources = data.dbSources;
      }
      if (data.sources && data.sources.length > 0) {
        webSources = data.sources.filter((s: WebSource) => s.url || s.title);
      }
    } catch (err) {
      console.error("챗봇 API 실패:", err);
    }

    const aiResponse: ChatMessage = { role: "ai", text: aiText, dbSources, webSources };
    setMessages((prev) => [...prev, aiResponse]);
    setIsLoading(false);

    saveChatLog(question, aiResponse.text, dbSources, webSources);
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem-4rem)] md:h-[calc(100dvh-3.5rem-1.5rem)]">
      {/* 페이지 타이틀 */}
      <div className="px-4 pt-5 pb-3 shrink-0">
        <h1 className="text-[18px] font-bold text-[#1A1A1A]">AI 챗봇</h1>
      </div>

      {/* 필터 토글 버튼 */}
      <div className="px-4 flex items-center gap-2 mb-2 shrink-0">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DEE2E6] text-xs font-medium text-[#495057] hover:bg-[#FFF8F3] transition-colors"
        >
          <Building2 className="w-3.5 h-3.5 text-[#C4A78F]" />
          {selectedSub}
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DEE2E6] text-xs font-medium text-[#495057] hover:bg-[#FFF8F3] transition-colors"
        >
          <CalendarDays className="w-3.5 h-3.5 text-[#C4A78F]" />
          {selectedPeriod}
          <ChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="px-4 mb-2 shrink-0">
          <div className="p-4 rounded-2xl border border-[#F0E4D9] bg-[#FFF8F3] space-y-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#868E96]">계열사</label>
              <div className="flex gap-1.5 flex-wrap">
                {SUBSIDIARIES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSub(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedSub === s
                        ? "bg-[#F26522] text-white"
                        : "bg-white border border-[#DEE2E6] text-[#495057] hover:border-[#F26522]/30"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#868E96]">기간</label>
              <div className="flex gap-1.5 flex-wrap">
                {PERIODS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setSelectedPeriod(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedPeriod === p
                        ? "bg-[#F26522] text-white"
                        : "bg-white border border-[#DEE2E6] text-[#495057] hover:border-[#F26522]/30"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 채팅 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 space-y-5 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-6">
            <img
              src="/imo/okman_2d_default_05.png"
              alt="읏맨"
              className="w-24 h-auto object-contain mb-4"
            />
            <h3 className="text-base font-bold text-[#25282B] mb-1">무엇이든 물어보세요</h3>
            <p className="text-xs text-[#868E96] mb-5 max-w-xs">
              보도자료, DART 공시, 경쟁사 동향 등<br />
              OK금융그룹 관련 자료를 AI가 검색하고 답변합니다
            </p>
            <div className="grid grid-cols-1 gap-2 w-full">
              {SUGGESTED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="text-left px-4 py-3 rounded-xl border border-[#F0E4D9] bg-[#FFF8F3] text-xs text-[#495057] hover:border-[#F26522]/40 hover:text-[#F26522] transition-all"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "ai" && (
                  <div className="w-8 h-8 rounded-full bg-[#F26522] flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className={`max-w-[80%] space-y-2 ${msg.role === "user" ? "order-first" : ""}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-[#F26522] text-white rounded-br-md"
                        : "bg-[#F8F9FA] text-[#25282B] border border-[#F0F0F0] rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* 내부 DB 출처 */}
                  {msg.dbSources && msg.dbSources.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-[#ADB5BD] uppercase tracking-wider">내부 참고 자료</p>
                      {(expandedSources[`db_${i}`] ? msg.dbSources : msg.dbSources.slice(0, 1)).map((s, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFF8F3] border border-[#F0E4D9]"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#F26522] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-[#25282B] truncate">{s.title}</p>
                            <p className="text-[10px] text-[#ADB5BD]">{s.type} · {s.date}</p>
                          </div>
                        </div>
                      ))}
                      {msg.dbSources.length > 1 && (
                        <button
                          onClick={() => setExpandedSources(prev => ({ ...prev, [`db_${i}`]: !prev[`db_${i}`] }))}
                          className="text-[10px] text-[#F26522] hover:underline pl-1"
                        >
                          {expandedSources[`db_${i}`] ? "접기" : `+${msg.dbSources.length - 1}개 더보기`}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Google 검색 출처 */}
                  {msg.webSources && msg.webSources.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold text-[#ADB5BD] uppercase tracking-wider">웹 검색 출처</p>
                      {(expandedSources[`web_${i}`] ? msg.webSources : msg.webSources.slice(0, 1)).map((s, j) => (
                        <a
                          key={j}
                          href={s.url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F8F9FA] border border-[#F0F0F0] hover:border-[#F26522]/30 transition-colors"
                        >
                          <Globe className="w-3.5 h-3.5 text-[#868E96] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium text-[#25282B] truncate">{s.title || s.url}</p>
                            {s.url && (
                              <p className="text-[10px] text-[#ADB5BD] truncate">{s.url}</p>
                            )}
                          </div>
                        </a>
                      ))}
                      {msg.webSources.length > 1 && (
                        <button
                          onClick={() => setExpandedSources(prev => ({ ...prev, [`web_${i}`]: !prev[`web_${i}`] }))}
                          className="text-[10px] text-[#F26522] hover:underline pl-1"
                        >
                          {expandedSources[`web_${i}`] ? "접기" : `+${msg.webSources.length - 1}개 더보기`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-[#F26522]/10 flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-[#F26522]" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-[#F26522] flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-[#F8F9FA] border border-[#F0F0F0]">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#F26522]/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 rounded-full bg-[#F26522]/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 rounded-full bg-[#F26522]/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 입력 영역 */}
      <div className="shrink-0 border-t border-[#F0F0F0] px-4 py-3 bg-white">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="질문을 입력하세요..."
            disabled={isLoading}
            className="flex-1 rounded-full border-[#DEE2E6] px-5"
          />
          <Button
            onClick={() => handleSend()}
            disabled={isLoading || !inputValue.trim()}
            className="rounded-full w-10 h-10 bg-[#F26522] hover:bg-[#D9551A] shadow-md shadow-orange-200 shrink-0"
            size="icon"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 px-1">
          <Clock className="w-3 h-3 text-[#ADB5BD]" />
          <p className="text-[10px] text-[#ADB5BD]">
            답변은 보도자료, DART 공시, Q&A 데이터를 기반으로 생성됩니다
          </p>
        </div>
      </div>
    </div>
  );
}

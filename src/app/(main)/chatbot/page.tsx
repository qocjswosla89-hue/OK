"use client";

import { useState, useRef, useEffect } from "react";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
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

interface ChatMessage {
  role: "user" | "ai";
  text: string;
  sources?: Array<{ title: string; type: string; date: string }>;
}

const INITIAL_MESSAGES: ChatMessage[] = [];

export default function ChatbotPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSub, setSelectedSub] = useState("전체");
  const [selectedPeriod, setSelectedPeriod] = useState("전체 기간");
  const [showFilters, setShowFilters] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text?: string) => {
    const question = text || inputValue.trim();
    if (!question) return;

    setInputValue("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setIsLoading(true);

    // 시뮬레이션
    await new Promise((r) => setTimeout(r, 1500));

    const aiResponse: ChatMessage = {
      role: "ai",
      text: getAIResponse(question),
      sources: [
        { title: "OK저축은행, 2025년 3분기 역대 최대 실적 달성", type: "보도자료", date: "2025.11.15" },
        { title: "분기보고서 (2025.09)", type: "DART 공시", date: "2025.11.14" },
      ],
    };

    setMessages((prev) => [...prev, aiResponse]);
    setIsLoading(false);
  };

  return (
    <>
      <Header title="Q&A 챗봇" description="보도자료와 공시 자료에 대해 AI에게 질문하세요" />
      <div className="p-8 h-[calc(100vh-73px)] flex flex-col">
        <div className="flex gap-6 flex-1 min-h-0">
          {/* 메인 채팅 영역 */}
          <div className="flex-1 flex flex-col min-h-0">
            {/* 필터 토글 */}
            <div className="flex items-center gap-3 mb-4">
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
              <Card className="p-4 border-[#F0E4D9] bg-[#FFF8F3] mb-4 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-[#868E96]">계열사</label>
                  <div className="flex gap-1.5">
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
                  <div className="flex gap-1.5">
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
              </Card>
            )}

            {/* 채팅 메시지 영역 */}
            <Card className="flex-1 border-[#DEE2E6] flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F26522] to-[#E07B54] flex items-center justify-center mb-5 shadow-lg shadow-orange-200">
                      <MessageCircle className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-[#25282B] mb-1">무엇이든 물어보세요</h3>
                    <p className="text-sm text-[#868E96] mb-6 max-w-sm">
                      보도자료, DART 공시, 경쟁사 동향 등<br />
                      OK금융그룹 관련 자료를 AI가 검색하고 답변합니다
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-w-lg w-full">
                      {SUGGESTED_QUESTIONS.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(q)}
                          className="text-left px-4 py-3 rounded-xl border border-[#F0E4D9] bg-[#FFF8F3] text-xs text-[#495057] hover:border-[#F26522]/40 hover:text-[#F26522] hover:bg-[#FFF8F3] transition-all"
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
                        <div className={`max-w-[75%] space-y-2 ${msg.role === "user" ? "order-first" : ""}`}>
                          <div
                            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                              msg.role === "user"
                                ? "bg-[#F26522] text-white rounded-br-md"
                                : "bg-[#F8F9FA] text-[#25282B] border border-[#F0F0F0] rounded-bl-md"
                            }`}
                          >
                            {msg.text}
                          </div>
                          {/* 출처 */}
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-[10px] font-semibold text-[#ADB5BD] uppercase tracking-wider">참고 자료</p>
                              {msg.sources.map((s, j) => (
                                <div
                                  key={j}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFF8F3] border border-[#F0E4D9] cursor-pointer hover:border-[#F26522]/30 transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#F26522] shrink-0" />
                                  <div className="min-w-0">
                                    <p className="text-[11px] font-medium text-[#25282B] truncate">{s.title}</p>
                                    <p className="text-[10px] text-[#ADB5BD]">{s.type} · {s.date}</p>
                                  </div>
                                </div>
                              ))}
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

              {/* 입력 */}
              <div className="border-t border-[#F0F0F0] px-6 py-4">
                <div className="flex gap-3">
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
                    className="rounded-full w-11 h-11 bg-[#F26522] hover:bg-[#D9551A] shadow-md shadow-orange-200"
                    size="icon"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-1.5 mt-2 px-2">
                  <Clock className="w-3 h-3 text-[#ADB5BD]" />
                  <p className="text-[10px] text-[#ADB5BD]">
                    답변은 보도자료, DART 공시, Q&A 데이터를 기반으로 생성됩니다
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

function getAIResponse(question: string): string {
  if (question.includes("실적")) {
    return "OK저축은행은 2025년 3분기에 영업이익 1,247억원을 기록하며 역대 최대 분기 실적을 달성했습니다. 이는 전년 동기 대비 35.2% 증가한 수치로, 건전성 관리 강화와 디지털 금융 서비스 확대가 주효했습니다. 당기순이익도 전년 동기 대비 28.7% 늘어난 982억원을 기록했습니다.";
  }
  if (question.includes("자동차") || question.includes("캐피탈")) {
    return "OK캐피탈은 최근 자동차금융 분야에서 '오케이 퍼스트론'이라는 중금리 대출 신상품을 출시했습니다. 또한 현대자동차와 금융 파트너십을 체결하여 자동차금융 시장에서의 입지를 강화하고 있습니다.";
  }
  if (question.includes("ESG")) {
    return "OK금융그룹은 ESG 경영 강화를 위해 지역사회 상생 프로그램을 적극 추진하고 있습니다. 특히 청년 금융교육 프로그램, 탄소중립 경영 선언 등의 활동을 통해 사회적 책임을 이행하고 있습니다.";
  }
  if (question.includes("경쟁사") || question.includes("SBI")) {
    return "SBI저축은행은 최근 디지털 전환 가속화와 함께 비대면 대출 상품을 확대하고 있습니다. 또한 AI 기반 신용평가 시스템 도입으로 중금리 시장에서의 경쟁력을 강화하는 추세입니다.";
  }
  return "질문하신 내용에 대해 관련 자료를 검색했습니다. OK금융그룹의 보도자료와 DART 공시 내역을 기반으로 확인한 결과, 해당 주제에 대한 최근 동향을 안내드립니다. 더 구체적인 내용이 필요하시면 계열사명이나 기간을 지정하여 다시 질문해주세요.";
}

"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  X,
  Upload,
  Download,
  History,
  Send,
  User,
  Info,
  ChevronDown,
  FileText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const SUBSIDIARIES = ["OK저축은행", "오케이저축은행", "OK캐피탈", "오케이캐피탈", "OK금융그룹", "오케이금융그룹"];
const RELEASE_TYPES = [
  { id: "earnings", label: "실적발표" },
  { id: "product", label: "신상품" },
  { id: "personnel", label: "인사" },
  { id: "esg", label: "ESG" },
  { id: "award", label: "수상" },
  { id: "partnership", label: "제휴" },
  { id: "event", label: "이벤트" },
  { id: "sports", label: "스포츠" },
  { id: "custom", label: "직접입력" },
];

const RELEASE_TYPE_LABEL_MAP: Record<string, string> = {
  earnings: "실적발표",
  product: "신상품",
  personnel: "인사",
  esg: "ESG",
  award: "수상",
  partnership: "제휴",
  event: "이벤트",
  sports: "스포츠",
  custom: "직접입력",
};

const SAMPLE_DRAFT = `OK저축은행(대표이사 OOO)이 2025년 3분기 영업이익 1,247억원을 기록하며 역대 최대 분기 실적을 달성했다고 17일 밝혔다.

이는 전년 동기 대비 35.2% 증가한 수치로, 건전성 관리 강화와 디지털 금융 서비스 확대가 주효했다는 분석이다. 당기순이익도 전년 동기 대비 28.7% 늘어난 982억원을 기록했다.

OK저축은행 관계자는 "고금리 환경에서도 안정적인 자산 관리와 디지털 전환을 통해 질적 성장을 이뤘다"며 "하반기에도 고객 중심 경영을 강화하겠다"고 말했다.`;

export default function DraftPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[#868E96]">로딩 중...</div>}>
      <DraftContent />
    </Suspense>
  );
}

function DraftContent() {
  const searchParams = useSearchParams();
  const [subsidiary, setSubsidiary] = useState("OK저축은행");
  const [selectedType, setSelectedType] = useState("earnings");
  const [customType, setCustomType] = useState("");
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [draft, setDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: string; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [savedPressReleaseId, setSavedPressReleaseId] = useState<number | null>(null);
  const [versionNumber, setVersionNumber] = useState(1);
  const [attachments, setAttachments] = useState<{ filename: string; url: string; textContent: string | null }[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [dartContext, setDartContext] = useState<string | null>(null);
  const [dartInfo, setDartInfo] = useState<{ title: string; type: string; date: string; rceptNo: string } | null>(null);
  const [savedTitle, setSavedTitle] = useState<string>("");

  // DART 공시에서 넘어온 경우 자동 세팅
  useEffect(() => {
    const dartId = searchParams.get("dartId");
    const dartSubsidiary = searchParams.get("subsidiary");
    const dartTopic = searchParams.get("topic");
    const dartType = searchParams.get("dartType");
    const dartDate = searchParams.get("dartDate");
    const rceptNo = searchParams.get("rceptNo");
    const keyFigures = searchParams.get("keyFigures");

    if (dartId && dartTopic) {
      if (dartSubsidiary) setSubsidiary(dartSubsidiary);
      setTopic(dartTopic);

      // DART 공시 유형 → 보도자료 유형 매핑
      if (dartType?.includes("사업보고서") || dartType?.includes("반기보고서") || dartType?.includes("분기보고서")) {
        setSelectedType("earnings");
      } else {
        setSelectedType("custom");
        setCustomType(dartType || "");
      }

      // DART 공시 정보를 AI 컨텍스트로 구성
      let context = `[DART 공시 참조]\n공시명: ${dartTopic}\n유형: ${dartType || ""}\n제출일: ${dartDate || ""}\n계열사: ${dartSubsidiary || ""}`;
      if (keyFigures) {
        try {
          const figures = JSON.parse(keyFigures);
          context += `\n주요 재무수치: ${JSON.stringify(figures, null, 2)}`;
        } catch { /* ignore */ }
      }
      setDartContext(context);
      setDartInfo({
        title: dartTopic,
        type: dartType || "",
        date: dartDate || "",
        rceptNo: rceptNo || "",
      });

      // DART 공시 관련 최근 공시 데이터도 추가 조회
      if (dartSubsidiary) {
        fetchRelatedDartData(dartSubsidiary, dartId);
      }
    }
  }, [searchParams]);

  const fetchRelatedDartData = async (sub: string, excludeId: string) => {
    try {
      const { data } = await supabase
        .from("dart_disclosures")
        .select("report_nm, report_type, rcept_dt, key_figures")
        .eq("subsidiary", sub)
        .neq("id", excludeId)
        .order("rcept_dt", { ascending: false })
        .limit(5);

      if (data && data.length > 0) {
        const relatedInfo = data.map((d) =>
          `- ${d.report_nm} (${d.rcept_dt})${d.key_figures ? ` | 수치: ${JSON.stringify(d.key_figures)}` : ""}`
        ).join("\n");
        setDartContext((prev) =>
          prev ? `${prev}\n\n[관련 최근 공시]\n${relatedInfo}` : null
        );
      }
    } catch (err) {
      console.error("Related DART fetch error:", err);
    }
  };

  const handleAttachmentUpload = async (file: File) => {
    setAttachmentUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload/attachment", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "업로드 실패");
      }

      const data = await res.json();
      setAttachments((prev) => [
        ...prev,
        {
          filename: data.filename,
          url: data.url,
          textContent: data.textContent || null,
        },
      ]);
    } catch (err) {
      console.error("Attachment upload error:", err);
      alert(`첨부파일 업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleAttachmentClick = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.csv,.json,.pdf,.doc,.docx,.hwp,.hwpx,.xlsx,.xls,.pptx,.ppt,.jpg,.jpeg,.png,.gif";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) handleAttachmentUpload(file);
    };
    input.click();
  };

  const handleAttachmentDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleAttachmentUpload(file);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const addKeyword = () => {
    const kw = keywordInput.trim();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
      setKeywordInput("");
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw));
  };

  const handleGenerate = async () => {
    if (!topic.trim()) {
      alert("주제를 입력해주세요.");
      return;
    }
    setIsGenerating(true);

    const releaseType = selectedType === "custom" ? customType : (RELEASE_TYPE_LABEL_MAP[selectedType] || selectedType);

    // 첨부파일 텍스트 합치기
    const attachmentContent = attachments
      .filter((a) => a.textContent)
      .map((a) => `[${a.filename}]\n${a.textContent}`)
      .join("\n\n") || undefined;

    let generatedDraft = "";
    let aiGeneratedTitle: string | null = null;
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subsidiary,
          releaseType,
          topic,
          keywords,
          attachmentContent,
          dartContext: dartContext || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `서버 오류 (${res.status})`);
      }
      generatedDraft = data.content || "";
      aiGeneratedTitle = data.aiTitle || null;
    } catch (err) {
      console.error("API 호출 실패:", err);
      alert(`보도자료 생성 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}\n\n다시 시도해주세요.`);
      setIsGenerating(false);
      return;
    }

    setDraft(generatedDraft);
    setIsGenerating(false);

    // Save to Supabase
    try {
      const title = aiGeneratedTitle || topic || `${subsidiary} ${RELEASE_TYPE_LABEL_MAP[selectedType] || selectedType} 보도자료`;
      const releaseType = selectedType === "custom" ? customType : (RELEASE_TYPE_LABEL_MAP[selectedType] || selectedType);

      const { data: prData, error: prError } = await supabase
        .from("press_releases")
        .insert({
          subsidiary,
          release_type: releaseType,
          title,
          content: generatedDraft,
          current_version: 1,
          status: "draft",
          keywords: keywords.length > 0 ? keywords : null,
        })
        .select();

      if (!prError && prData && prData.length > 0) {
        const pressReleaseId = prData[0].id;
        setSavedPressReleaseId(pressReleaseId);
        setSavedTitle(title);
        setVersionNumber(1);

        // Save first version
        await supabase.from("press_release_versions").insert({
          press_release_id: pressReleaseId,
          version_number: 1,
          title,
          content: generatedDraft,
          change_summary: "AI 초안 생성",
          edited_by: "AI",
        });
      }
    } catch (err) {
      console.error("Save draft error:", err);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const userMessage = chatInput;
    setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setChatInput("");

    // AI 수정 API 호출
    let aiResponse = "수정 완료! 요청하신 내용을 반영했습니다.";
    try {
      const res = await fetch("/api/draft/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentDraft: draft,
          instruction: userMessage,
          keywords,
        }),
      });
      const data = await res.json();
      if (data.content) {
        setDraft(data.content);
        aiResponse = `수정 완료! v${versionNumber + 1}.0으로 업데이트했습니다.\n\n${data.summary || "요청하신 내용을 반영했습니다."}`;
      }
    } catch (err) {
      console.error("수정 API 실패:", err);
      aiResponse = "수정 중 오류가 발생했습니다. 다시 시도해주세요.";
    }

    setChatMessages((prev) => [...prev, { role: "ai", text: aiResponse }]);

    // Save new version to Supabase if we have a press_release_id
    if (savedPressReleaseId) {
      try {
        const newVersion = versionNumber + 1;
        setVersionNumber(newVersion);

        await supabase.from("press_release_versions").insert({
          press_release_id: savedPressReleaseId,
          version_number: newVersion,
          title: savedTitle || topic || `${subsidiary} 보도자료`,
          content: draft,
          change_summary: userMessage,
          edited_by: "AI",
        });

        // Update current_version on press_releases
        await supabase
          .from("press_releases")
          .update({ current_version: newVersion })
          .eq("id", savedPressReleaseId);
      } catch (err) {
        console.error("Save version error:", err);
      }
    }
  };

  return (
    <>
      <Header title="보도자료 초안 생성" description="계열사와 유형을 선택하고 AI가 보도자료 초안을 작성합니다" />
      <div className="p-8 flex gap-6">
        {/* 왼쪽: 입력 폼 */}
        <div className="w-[420px] shrink-0 space-y-4">
          <h3 className="text-[11px] font-semibold text-[#868E96] tracking-widest uppercase">입력 정보</h3>

          {/* DART 공시 연동 배너 */}
          {dartInfo && (
            <Card className="p-4 border-[#F26522]/30 bg-[#FFF8F3]">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#F26522]/10 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-[#F26522]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-[#F26522] mb-1">DART 공시 연동</p>
                  <p className="text-xs text-[#495057] font-medium truncate">{dartInfo.title}</p>
                  <p className="text-[11px] text-[#868E96] mt-0.5">{dartInfo.type} · {dartInfo.date}</p>
                </div>
                {dartInfo.rceptNo && (
                  <a
                    href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${dartInfo.rceptNo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[#327DF5] hover:underline shrink-0"
                  >
                    원문 보기 →
                  </a>
                )}
              </div>
            </Card>
          )}

          <Card className="p-6 space-y-5 border-[#DEE2E6]">
            {/* 계열사 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#25282B]">계열사 (선택 또는 직접 입력)</label>
              <div className="relative">
                <Input
                  value={subsidiary}
                  onChange={(e) => setSubsidiary(e.target.value)}
                  placeholder="계열사명을 입력하거나 선택"
                  list="subsidiary-list"
                  className="pr-10"
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADB5BD]" />
                <datalist id="subsidiary-list">
                  {SUBSIDIARIES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* 유형 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#25282B]">보도자료 유형</label>
              <div className="flex flex-wrap gap-2">
                {RELEASE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedType(t.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                      selectedType === t.id
                        ? "bg-[#F26522] text-white shadow-sm shadow-orange-200"
                        : "bg-white border border-[#DEE2E6] text-[#495057] hover:border-[#F26522]/30 hover:text-[#F26522]"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              {selectedType === "custom" && (
                <Input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="유형명을 직접 입력하세요 (예: 후원, 협약, 공모전 등)"
                  className="mt-2"
                />
              )}
            </div>

            {/* 주제 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#25282B]">주제</label>
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="예: OK저축은행 2025년 3분기 실적 발표"
              />
            </div>

            {/* 키워드 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#25282B]">키워드 (직접 입력)</label>
              <div className="flex items-center gap-1.5 text-[#E07B54] mb-1">
                <Info className="w-3 h-3" />
                <span className="text-[11px]">입력한 키워드는 보도자료에 반드시 포함됩니다</span>
              </div>
              <div className="flex gap-2">
                <Input
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
                  placeholder="키워드를 입력하고 Enter"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" onClick={addKeyword} className="border-[#F0E4D9] text-[#8C6B58]">
                  추가
                </Button>
              </div>
              {keywords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {keywords.map((kw) => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F26522]/10 text-[#F26522] text-[11px] font-medium"
                    >
                      {kw}
                      <span className="px-1 py-px rounded text-[8px] font-bold bg-[#F26522] text-white">필수</span>
                      <button onClick={() => removeKeyword(kw)} className="hover:text-[#C44D15]">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 첨부파일 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#25282B]">첨부파일 (참고자료)</label>
              <div
                onClick={handleAttachmentClick}
                onDrop={handleAttachmentDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`border border-dashed rounded-xl bg-[#F8F9FA] p-6 text-center cursor-pointer hover:border-[#F26522]/40 transition-colors ${
                  attachmentUploading ? "border-[#F26522] bg-[#FFF8F3]" : "border-[#DEE2E6]"
                }`}
              >
                {attachmentUploading ? (
                  <>
                    <div className="w-5 h-5 mx-auto mb-1.5 border-2 border-[#F26522] border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-[#F26522]">업로드 중...</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 text-[#ADB5BD] mx-auto mb-1.5" />
                    <p className="text-xs text-[#ADB5BD]">파일을 드래그하거나 클릭하여 업로드</p>
                  </>
                )}
              </div>
              {attachments.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-[#DEE2E6]"
                    >
                      <span className="text-xs text-[#495057] truncate flex-1">{att.filename}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }}
                        className="ml-2 text-[#868E96] hover:text-[#E64980]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 생성 버튼 */}
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full h-12 bg-[#F26522] hover:bg-[#D9551A] text-white rounded-xl text-sm font-semibold shadow-md shadow-orange-200"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isGenerating ? "생성 중..." : "AI 초안 생성"}
            </Button>
          </Card>
        </div>

        {/* 오른쪽: 미리보기 + 수정 대화 */}
        <div className="flex-1 space-y-4 min-w-0">
          <h3 className="text-[11px] font-semibold text-[#868E96] tracking-widest uppercase">미리보기</h3>
          <Card className="border-[#DEE2E6] flex flex-col" style={{ minHeight: 600 }}>
            {/* 상단 툴바 */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#F0F0F0]">
              <span className="text-sm font-semibold text-[#25282B]">생성된 초안</span>
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DEE2E6] text-[11px] font-medium text-[#495057] hover:bg-[#F8F9FA]">
                  <Download className="w-3.5 h-3.5" /> HWP
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#DEE2E6] text-[11px] font-medium text-[#495057] hover:bg-[#F8F9FA]">
                  <History className="w-3.5 h-3.5" /> v{versionNumber}.0
                </button>
              </div>
            </div>

            {/* 본문 */}
            <div className="flex-1 px-6 py-5">
              {draft ? (
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-[#ADB5BD] tracking-wider">[보도자료]</p>
                  <h2 className="text-lg font-bold text-[#25282B]">
                    OK저축은행, 2025년 3분기 역대 최대 실적 달성
                  </h2>
                  <p className="text-sm text-[#495057] italic">
                    — 영업이익 전년 동기 대비 35.2% 증가한 1,247억원 기록
                  </p>
                  <div className="text-sm text-[#495057] leading-7 whitespace-pre-wrap">{draft}</div>
                  <div className="pt-3 border-t border-[#F0F0F0]">
                    <p className="text-[11px] text-[#ADB5BD]">문의: OK저축은행 홍보실 02-1234-5678</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center py-20">
                  <div className="w-16 h-16 rounded-2xl bg-[#FFF8F3] flex items-center justify-center mb-4">
                    <Sparkles className="w-7 h-7 text-[#F26522]" />
                  </div>
                  <p className="text-sm font-medium text-[#25282B] mb-1">초안을 생성해보세요</p>
                  <p className="text-xs text-[#ADB5BD]">왼쪽에서 정보를 입력하고 생성 버튼을 클릭하세요</p>
                </div>
              )}
            </div>

            {/* 수정 대화창 */}
            {draft && (
              <div className="border-t border-[#F0F0F0] px-6 py-4 space-y-3">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#F26522]" />
                  <span className="text-[13px] font-semibold text-[#25282B]">AI에게 수정 요청</span>
                </div>

                {/* 메시지들 */}
                <div className="max-h-48 overflow-y-auto space-y-2.5">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === "user" ? "bg-[#F26522]/10" : "bg-[#F26522]"
                      }`}>
                        {msg.role === "user" ? (
                          <User className="w-3.5 h-3.5 text-[#F26522]" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5 text-white" />
                        )}
                      </div>
                      <div className={`flex-1 px-3.5 py-2.5 rounded-xl text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-[#F5F6F7] text-[#25282B]"
                          : "bg-[#FFF8F3] border border-[#F0E4D9] text-[#495057]"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 입력 */}
                <div className="flex gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                    placeholder="수정할 내용을 입력하세요..."
                    className="flex-1 rounded-full"
                  />
                  <Button
                    onClick={handleChatSend}
                    size="icon"
                    className="rounded-full w-10 h-10 bg-[#F26522] hover:bg-[#D9551A] shadow-sm shadow-orange-200"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

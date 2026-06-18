"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Pencil,
} from "lucide-react";

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

export default function DraftPage() {
  return (
    <Suspense fallback={<div className="px-4 pt-10 text-center text-[#868E96] text-sm">로딩 중...</div>}>
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dartInfo, setDartInfo] = useState<{ title: string; type: string; date: string; rceptNo: string } | null>(null);
  const [pressTitle, setPressTitle] = useState<string>("");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

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

      if (dartType?.includes("사업보고서") || dartType?.includes("반기보고서") || dartType?.includes("분기보고서")) {
        setSelectedType("earnings");
      } else {
        setSelectedType("custom");
        setCustomType(dartType || "");
      }

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

      if (dartSubsidiary) {
        fetchRelatedDartData(dartSubsidiary, dartId);
      }
    }
  }, [searchParams]);

  const fetchRelatedDartData = async (sub: string, excludeId: string) => {
    try {
      const res = await fetch(`/api/data/dart-disclosures?subsidiary=${encodeURIComponent(sub)}&excludeId=${excludeId}&limit=5`);
      const data = await res.json();
      if (data && data.length > 0) {
        const relatedInfo = data.map((d: { report_nm: string; rcept_dt: string; key_figures?: Record<string, unknown> }) =>
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
      const res = await fetch("/api/upload/attachment", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "업로드 실패");
      }
      const data = await res.json();
      setAttachments((prev) => [...prev, { filename: data.filename, url: data.url, textContent: data.textContent || null }]);
    } catch (err) {
      console.error("Attachment upload error:", err);
      alert(`첨부파일 업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
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
        body: JSON.stringify({ subsidiary, releaseType, topic, keywords, attachmentContent, dartContext: dartContext || undefined }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `서버 오류 (${res.status})`);
      generatedDraft = data.content || "";
      aiGeneratedTitle = data.aiTitle || null;
    } catch (err) {
      console.error("API 호출 실패:", err);
      alert(`보도자료 생성 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}\n\n다시 시도해주세요.`);
      setIsGenerating(false);
      return;
    }

    const finalTitle = aiGeneratedTitle || topic || `${subsidiary} ${releaseType} 보도자료`;
    setDraft(generatedDraft);
    setPressTitle(finalTitle);
    setIsGenerating(false);

    // Save to Supabase
    try {
      const prRes = await fetch("/api/data/press-releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subsidiary, release_type: releaseType, title: finalTitle, content: generatedDraft, current_version: 1, status: "draft", keywords: keywords.length > 0 ? keywords : null }),
      });
      if (prRes.ok) {
        const prData = await prRes.json();
        const pressReleaseId = prData.id;
        setSavedPressReleaseId(pressReleaseId);
        setVersionNumber(1);
        await fetch("/api/data/press-release-versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ press_release_id: pressReleaseId, version_number: 1, title: finalTitle, content: generatedDraft, change_summary: "AI 초안 생성", edited_by: "AI" }),
        });
      }
    } catch (err) {
      console.error("Save draft error:", err);
    }
  };

  const handleTitleSave = async () => {
    setIsEditingTitle(false);
    if (savedPressReleaseId && pressTitle) {
      await fetch(`/api/data/press-releases/${savedPressReleaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: pressTitle }),
      });
    }
  };

  const handleExportHWP = async () => {
    if (!pressTitle && !draft) return;
    try {
      const res = await fetch("/api/export/hwp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(savedPressReleaseId ? { id: savedPressReleaseId } : { title: pressTitle, content: draft, subsidiary }),
      });
      if (!res.ok) throw new Error("내보내기 실패");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pressTitle || "보도자료"}.hwp`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("내보내기 실패: " + (err instanceof Error ? err.message : "오류"));
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const userMessage = chatInput;
    setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setChatInput("");

    let aiResponse = "수정 완료! 요청하신 내용을 반영했습니다.";
    try {
      const res = await fetch("/api/draft/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentDraft: draft, instruction: userMessage, keywords }),
      });
      const data = await res.json();
      if (data.content) {
        setDraft(data.content);
        if (data.newTitle) setPressTitle(data.newTitle);
        aiResponse = `수정 완료! v${versionNumber + 1}.0으로 업데이트했습니다.\n\n${data.summary || "요청하신 내용을 반영했습니다."}`;
      }
    } catch (err) {
      console.error("수정 API 실패:", err);
      aiResponse = "수정 중 오류가 발생했습니다. 다시 시도해주세요.";
    }

    setChatMessages((prev) => [...prev, { role: "ai", text: aiResponse }]);

    if (savedPressReleaseId) {
      try {
        const newVersion = versionNumber + 1;
        setVersionNumber(newVersion);
        await fetch("/api/data/press-release-versions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ press_release_id: savedPressReleaseId, version_number: newVersion, title: pressTitle || topic, content: draft, change_summary: userMessage, edited_by: "AI" }),
        });
        await fetch(`/api/data/press-releases/${savedPressReleaseId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: pressTitle, current_version: newVersion }),
        });
      } catch (err) {
        console.error("Save version error:", err);
      }
    }
  };

  return (
    <div className="px-4 space-y-4 pb-6">
      {/* 페이지 타이틀 */}
      <div className="pt-5 pb-1">
        <h1 className="text-[18px] font-bold text-[#1A1A1A]">초안 생성</h1>
      </div>

      {/* DART 연동 배너 */}
      {dartInfo && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#FFF8F3] border border-[#F26522]/20">
          <div className="w-7 h-7 rounded-lg bg-[#F26522]/10 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5 text-[#F26522]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#F26522]">DART 공시 연동</p>
            <p className="text-xs text-[#495057] truncate">{dartInfo.title}</p>
          </div>
          {dartInfo.rceptNo && (
            <a href={`https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${dartInfo.rceptNo}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#327DF5] shrink-0">
              원문 →
            </a>
          )}
        </div>
      )}

      {/* 입력 폼 */}
      <div className="space-y-4">
        {/* 계열사 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#555]">계열사</label>
          <div className="relative">
            <Input
              value={subsidiary}
              onChange={(e) => setSubsidiary(e.target.value)}
              placeholder="계열사명 선택 또는 직접 입력"
              list="subsidiary-list"
              className="h-11 rounded-xl border-[#EBEBEB] pr-9"
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AAAAAA]" />
            <datalist id="subsidiary-list">
              {SUBSIDIARIES.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>

        {/* 유형 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#555]">보도자료 유형</label>
          <div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap scrollbar-hide">
            {RELEASE_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  selectedType === t.id
                    ? "bg-[#F26522] text-white"
                    : "bg-white border border-[#EBEBEB] text-[#555]"
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
              placeholder="유형명 직접 입력 (예: 후원, 협약)"
              className="h-11 rounded-xl border-[#EBEBEB]"
            />
          )}
        </div>

        {/* 주제 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#555]">주제</label>
          <Input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: OK저축은행 2025년 3분기 실적 발표"
            className="h-11 rounded-xl border-[#EBEBEB]"
          />
        </div>

        {/* 키워드 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#555]">필수 포함 키워드</label>
          <div className="flex items-center gap-1 text-[#E07B54] mb-1">
            <Info className="w-3 h-3" />
            <span className="text-[11px]">입력한 키워드는 보도자료에 반드시 포함됩니다</span>
          </div>
          <div className="flex gap-2">
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
              placeholder="키워드 입력 후 Enter"
              className="flex-1 h-10 rounded-xl border-[#EBEBEB]"
            />
            <button
              onClick={addKeyword}
              className="px-4 h-10 rounded-xl border border-[#EBEBEB] text-xs font-medium text-[#555] hover:border-[#F26522]/40"
            >
              추가
            </button>
          </div>
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              {keywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#F26522]/10 text-[#F26522] text-[11px] font-medium">
                  {kw}
                  <button onClick={() => removeKeyword(kw)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 첨부파일 */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#555]">첨부파일 (참고자료)</label>
          <label
            htmlFor="attachment-input"
            onDrop={handleAttachmentDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`flex flex-col items-center gap-1 border border-dashed rounded-xl bg-[#F8F9FA] py-5 text-center cursor-pointer transition-colors ${
              attachmentUploading ? "border-[#F26522] bg-[#FFF8F3]" : "border-[#EBEBEB]"
            }`}
          >
            {attachmentUploading ? (
              <>
                <div className="w-5 h-5 border-2 border-[#F26522] border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-[#F26522]">업로드 중...</p>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-[#AAAAAA]" />
                <p className="text-xs text-[#AAAAAA]">파일을 드래그하거나 클릭</p>
              </>
            )}
          </label>
          <input
            id="attachment-input"
            ref={fileInputRef}
            type="file"
            accept=".txt,.csv,.json,.pdf,.doc,.docx,.hwp,.hwpx,.xlsx,.xls,.pptx,.ppt,.jpg,.jpeg,.png,.gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleAttachmentUpload(file);
              e.target.value = "";
            }}
          />
          {attachments.map((att, idx) => (
            <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white border border-[#EBEBEB]">
              <span className="text-xs text-[#555] truncate flex-1">{att.filename}</span>
              <button onClick={(e) => { e.stopPropagation(); removeAttachment(idx); }} className="ml-2 text-[#AAAAAA] hover:text-red-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* 생성 버튼 */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full h-12 bg-[#F26522] hover:bg-[#D9551A] disabled:opacity-60 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          {isGenerating ? "생성 중..." : "AI 초안 생성"}
        </button>
      </div>

      {/* 미리보기 영역 */}
      {(draft || isGenerating) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-[#868E96] tracking-widest uppercase">미리보기</h2>
            <div className="flex gap-2">
              <button
                onClick={handleExportHWP}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#EBEBEB] text-[11px] font-medium text-[#555] hover:bg-[#F8F9FA]"
              >
                <Download className="w-3.5 h-3.5" /> HWP
              </button>
              <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#EBEBEB] text-[11px] font-medium text-[#AAAAAA]">
                <History className="w-3.5 h-3.5" /> v{versionNumber}.0
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[#EBEBEB] bg-white overflow-hidden">
            {/* 보도자료 제목 (편집 가능) */}
            <div className="px-5 pt-5 pb-3 border-b border-[#F5F5F5]">
              <p className="text-[10px] font-semibold text-[#AAAAAA] tracking-wider mb-2">[보도자료]</p>
              {isEditingTitle ? (
                <div className="flex gap-2">
                  <input
                    value={pressTitle}
                    onChange={(e) => setPressTitle(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                    autoFocus
                    className="flex-1 text-base font-bold text-[#1A1A1A] border-b-2 border-[#F26522] outline-none bg-transparent"
                  />
                </div>
              ) : (
                <div className="flex items-start gap-2 group">
                  <h2 className="flex-1 text-base font-bold text-[#1A1A1A] leading-snug">
                    {pressTitle || "제목을 생성 중..."}
                  </h2>
                  {pressTitle && (
                    <button
                      onClick={() => setIsEditingTitle(true)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#AAAAAA] hover:text-[#F26522]" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 본문 */}
            <div className="px-5 py-4">
              {isGenerating ? (
                <div className="flex items-center gap-2 py-8 justify-center">
                  <div className="w-5 h-5 border-2 border-[#F26522] border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm text-[#868E96]">AI가 초안을 작성하고 있습니다...</span>
                </div>
              ) : (
                <div className="text-sm text-[#333] leading-7 whitespace-pre-wrap">{draft}</div>
              )}
            </div>
          </div>

          {/* AI 수정 대화창 */}
          {draft && (
            <div className="rounded-xl border border-[#EBEBEB] bg-white overflow-hidden">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[#F5F5F5]">
                <Sparkles className="w-3.5 h-3.5 text-[#F26522]" />
                <span className="text-[13px] font-semibold text-[#1A1A1A]">AI 수정 요청</span>
              </div>

              {chatMessages.length > 0 && (
                <div className="px-4 py-3 space-y-2.5 max-h-48 overflow-y-auto">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                        msg.role === "user" ? "bg-[#F26522]/10" : "bg-[#F26522]"
                      }`}>
                        {msg.role === "user" ? (
                          <User className="w-3 h-3 text-[#F26522]" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-white" />
                        )}
                      </div>
                      <div className={`flex-1 px-3 py-2 rounded-xl text-xs leading-relaxed ${
                        msg.role === "user" ? "bg-[#F5F5F5] text-[#333]" : "bg-[#FFF8F3] border border-[#F0E4D9] text-[#495057]"
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 px-4 py-3 border-t border-[#F5F5F5]">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                  placeholder="수정할 내용을 입력하세요... (예: 더 간결하게, 제목 바꿔줘)"
                  className="flex-1 h-10 rounded-full border border-[#EBEBEB] px-4 text-sm outline-none focus:border-[#F26522]/40"
                />
                <button
                  onClick={handleChatSend}
                  className="w-10 h-10 rounded-full bg-[#F26522] hover:bg-[#D9551A] flex items-center justify-center shrink-0 transition-colors"
                >
                  <Send className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 빈 상태 */}
      {!draft && !isGenerating && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <img
            src="/imo/okman_2d_work_01.png"
            alt="읏맨"
            className="w-24 h-auto object-contain mb-3"
          />
          <p className="text-sm font-medium text-[#1A1A1A] mb-1">위에서 정보를 입력하고</p>
          <p className="text-sm text-[#AAAAAA]">AI 초안 생성 버튼을 누르세요</p>
        </div>
      )}
    </div>
  );
}

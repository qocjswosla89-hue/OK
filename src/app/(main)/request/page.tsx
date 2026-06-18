"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  Sparkles,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Send,
} from "lucide-react";

const SUBSIDIARIES = ["OK저축은행", "OK캐피탈", "OK금융그룹"];
const RELEASE_TYPES = [
  { id: "earnings", label: "실적발표" },
  { id: "product", label: "신상품" },
  { id: "personnel", label: "인사" },
  { id: "esg", label: "ESG" },
  { id: "award", label: "수상" },
  { id: "partnership", label: "제휴" },
  { id: "event", label: "이벤트" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  접수: { label: "접수", color: "text-[#327DF5]", bg: "bg-[#327DF5]/10", icon: Clock },
  작업중: { label: "작업중", color: "text-[#F26522]", bg: "bg-[#F26522]/10", icon: FileEdit },
  검토중: { label: "검토중", color: "text-[#FDB913]", bg: "bg-[#FDB913]/15", icon: AlertCircle },
  완료: { label: "완료", color: "text-[#40C057]", bg: "bg-[#40C057]/10", icon: CheckCircle2 },
  pending: { label: "접수", color: "text-[#327DF5]", bg: "bg-[#327DF5]/10", icon: Clock },
  in_progress: { label: "작업중", color: "text-[#F26522]", bg: "bg-[#F26522]/10", icon: FileEdit },
  review: { label: "검토중", color: "text-[#FDB913]", bg: "bg-[#FDB913]/15", icon: AlertCircle },
  completed: { label: "완료", color: "text-[#40C057]", bg: "bg-[#40C057]/10", icon: CheckCircle2 },
};


const RELEASE_TYPE_LABEL_MAP: Record<string, string> = {
  earnings: "실적발표",
  product: "신상품",
  personnel: "인사",
  esg: "ESG",
  award: "수상",
  partnership: "제휴",
  event: "이벤트",
};

interface RequestItem {
  id: number;
  name: string;
  dept: string;
  subsidiary: string;
  type: string;
  topic: string;
  date: string;
  status: string;
}

export default function RequestPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    department: "",
    subsidiary: "",
    releaseType: "",
    topic: "",
    keywords: "",
    desiredDate: "",
  });
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchRequests() {
      try {
        const res = await fetch("/api/data/requests");
        const data = await res.json();
        if (data && data.length > 0) {
          setRequests(
            data.map((r: { id: number; requester_name: string; department: string; subsidiary: string; release_type: string; topic: string; desired_date: string; status: string }) => ({
              id: r.id,
              name: r.requester_name || "",
              dept: r.department || "",
              subsidiary: r.subsidiary || "",
              type: r.release_type || "",
              topic: r.topic || "",
              date: r.desired_date ? new Date(r.desired_date).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "") : "",
              status: r.status || "pending",
            }))
          );
        }
      } catch (err) {
        console.error("Fetch requests error:", err);
      }
    }
    fetchRequests();
  }, []);

  const handleFileUpload = async (file: File) => {
    setAttachmentUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/attachment", { method: "POST", body: formData });
      if (!res.ok) throw new Error("업로드 실패");
      const data = await res.json();
      setAttachmentUrl(data.url);
      setAttachmentName(data.filename);
    } catch (err) {
      alert("첨부파일 업로드 실패");
    } finally {
      setAttachmentUploading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreview = () => {
    if (!formData.subsidiary || !formData.topic) {
      alert("계열사와 주제를 입력하면 AI 초안 생성 페이지로 이동합니다.");
      return;
    }
    const params = new URLSearchParams({
      subsidiary: formData.subsidiary,
      topic: formData.topic,
      releaseType: RELEASE_TYPE_LABEL_MAP[formData.releaseType] || formData.releaseType,
      keywords: formData.keywords,
    });
    router.push(`/draft?${params.toString()}`);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.department || !formData.subsidiary || !formData.releaseType || !formData.topic) {
      alert("필수 항목을 모두 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/data/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: formData.department,
          requester_name: formData.name,
          subsidiary: formData.subsidiary,
          release_type: RELEASE_TYPE_LABEL_MAP[formData.releaseType] || formData.releaseType,
          topic: formData.topic,
          keywords: formData.keywords,
          desired_date: formData.desiredDate || null,
          attachment_url: attachmentUrl || null,
          attachment_name: attachmentName || null,
        }),
      });
      const data = res.ok ? await res.json() : null;

      if (!res.ok) {
        alert("신청 중 오류가 발생했습니다.");
      } else {
        if (data?.id) {
          await fetch("/api/data/notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: "새 보도자료 신청 접수", message: `${formData.name} (${formData.department}) - ${formData.topic}`, type: "request", related_id: data.id }),
          });
        }
        alert("신청이 접수되었습니다.");
        if (data?.id) {
          const newItem: RequestItem = {
            id: data.id,
            name: formData.name,
            dept: formData.department,
            subsidiary: formData.subsidiary,
            type: RELEASE_TYPE_LABEL_MAP[formData.releaseType] || formData.releaseType,
            topic: formData.topic,
            date: formData.desiredDate
              ? new Date(formData.desiredDate).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "")
              : "",
            status: "pending",
          };
          setRequests((prev) => [newItem, ...prev]);
        }
        // Reset form
        setFormData({ name: "", department: "", subsidiary: "", releaseType: "", topic: "", keywords: "", desiredDate: "" });
        setAttachmentUrl(""); setAttachmentName("");
      }
    } catch (err) {
      console.error("Submit request error:", err);
      alert("신청이 접수되었습니다. (데모)");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="px-4 space-y-4">
      {/* 페이지 타이틀 */}
      <div className="pt-5 pb-3">
        <h1 className="text-[18px] font-bold text-[#1A1A1A]">보도자료 신청</h1>
      </div>

      {/* 신청 폼 */}
      <Card className="rounded-xl border-[#EBEBEB] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#F0E4D9] bg-[#FFF8F3]">
          <h3 className="text-xs font-bold text-[#25282B] flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-[#F26522]" />
            새 보도자료 신청
          </h3>
          <p className="text-[11px] text-[#868E96] mt-0.5">아래 정보를 입력해주세요.</p>
        </div>

        <div className="p-4 space-y-4">
          {/* 신청자명 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#25282B]">신청자명 <span className="text-[#F26522]">*</span></label>
            <Input
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="이름을 입력하세요"
              className="rounded-xl border-[#EBEBEB] h-11"
            />
          </div>

          {/* 부서 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#25282B]">부서 <span className="text-[#F26522]">*</span></label>
            <Input
              value={formData.department}
              onChange={(e) => handleChange("department", e.target.value)}
              placeholder="부서명을 입력하세요"
              className="rounded-xl border-[#EBEBEB] h-11"
            />
          </div>

          {/* 계열사 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#25282B]">계열사 <span className="text-[#F26522]">*</span></label>
            <div className="relative">
              <Input
                value={formData.subsidiary}
                onChange={(e) => handleChange("subsidiary", e.target.value)}
                placeholder="계열사를 선택하거나 입력"
                list="sub-list"
                className="pr-10 rounded-xl border-[#EBEBEB] h-11"
              />
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#ADB5BD]" />
              <datalist id="sub-list">
                {SUBSIDIARIES.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          {/* 희망 배포일 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#25282B]">희망 배포일</label>
            <Input
              type="date"
              value={formData.desiredDate}
              onChange={(e) => handleChange("desiredDate", e.target.value)}
              className="rounded-xl border-[#EBEBEB] h-11"
            />
          </div>

          {/* 보도자료 유형 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#25282B]">보도자료 유형 <span className="text-[#F26522]">*</span></label>
            <div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap">
              {RELEASE_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleChange("releaseType", t.id)}
                  className={`flex-shrink-0 px-3 py-2 rounded-full text-xs font-medium transition-all ${
                    formData.releaseType === t.id
                      ? "bg-[#F26522] text-white shadow-sm shadow-orange-200"
                      : "bg-white border border-[#EBEBEB] text-[#495057]"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 주제 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#25282B]">주제 <span className="text-[#F26522]">*</span></label>
            <Textarea
              value={formData.topic}
              onChange={(e) => handleChange("topic", e.target.value)}
              placeholder="보도자료 주제를 상세히 입력하세요 (예: OK저축은행 모바일뱅킹 앱 3.0 리뉴얼 출시 관련 보도자료 요청)"
              rows={3}
              className="rounded-xl border-[#EBEBEB] resize-none text-sm"
            />
          </div>

          {/* 핵심 키워드 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#25282B]">핵심 키워드</label>
            <Input
              value={formData.keywords}
              onChange={(e) => handleChange("keywords", e.target.value)}
              placeholder="쉼표로 구분 (예: 모바일뱅킹, UX개선, 비대면)"
              className="rounded-xl border-[#EBEBEB] h-11"
            />
          </div>

          {/* 첨부파일 */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#25282B]">첨부파일 (참고자료)</label>
            <label htmlFor="request-file-input" className="border-2 border-dashed border-[#EBEBEB] rounded-xl bg-[#FAFAFA] p-5 text-center cursor-pointer hover:border-[#F26522]/40 hover:bg-[#FFF8F3] transition-all flex flex-col items-center">
              {attachmentUploading ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#F26522] border-t-transparent rounded-full animate-spin mb-1.5" />
                  <p className="text-xs text-[#F26522]">업로드 중...</p>
                </>
              ) : attachmentName ? (
                <>
                  <Upload className="w-6 h-6 text-[#F26522] mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-[#F26522]">{attachmentName}</p>
                  <p className="text-[11px] text-[#ADB5BD] mt-0.5">클릭하여 변경</p>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-[#C4A78F] mx-auto mb-1.5" />
                  <p className="text-xs font-medium text-[#495057]">파일을 드래그하거나 클릭하여 업로드</p>
                  <p className="text-[11px] text-[#ADB5BD] mt-0.5">PDF, DOCX, HWP, 이미지 (최대 20MB)</p>
                </>
              )}
            </label>
            <input
              id="request-file-input"
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.doc,.docx,.hwp,.hwpx,.xlsx,.xls,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          {/* 버튼 */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handlePreview}
              variant="outline"
              className="flex-1 h-12 rounded-xl border-[#F26522] text-[#F26522] hover:bg-[#FFF8F3] font-semibold text-sm"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              AI 초안
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] text-white font-semibold shadow-md shadow-orange-200 text-sm"
            >
              <Send className="w-4 h-4 mr-1.5" />
              {isSubmitting ? "접수 중..." : "신청하기"}
            </Button>
          </div>
        </div>
      </Card>

      {/* 내 신청 목록 */}
      <div className="space-y-3 pb-2">
        <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase">내 신청 목록</h3>
        <div className="space-y-3">
          {requests.map((r) => {
            const st = STATUS_CONFIG[r.status] || STATUS_CONFIG["접수"];
            const Icon = st.icon;
            return (
              <Card key={r.id} className="p-4 rounded-xl border-[#EBEBEB] hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm font-semibold text-[#25282B] leading-snug line-clamp-2">{r.topic}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-medium text-[#868E96] bg-[#F8F9FA] px-2 py-0.5 rounded-md">{r.subsidiary}</span>
                      <span className="text-[11px] text-[#ADB5BD]">{r.type}</span>
                      <span className="text-[11px] text-[#ADB5BD]">{r.name} · {r.dept}</span>
                    </div>
                    {r.date && (
                      <p className="text-[11px] text-[#ADB5BD]">희망 배포일: {r.date}</p>
                    )}
                  </div>
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg shrink-0 ${st.bg} ${st.color}`}>
                    <Icon className="w-3 h-3" />
                    {st.label}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

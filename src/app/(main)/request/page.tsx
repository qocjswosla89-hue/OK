"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
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
};

const MOCK_REQUESTS = [
  { id: 1, name: "김민수", dept: "디지털금융부", subsidiary: "OK저축은행", type: "신상품", topic: "모바일뱅킹 앱 리뉴얼 보도자료", date: "2026.03.20", status: "작업중" },
  { id: 2, name: "박지현", dept: "영업기획부", subsidiary: "OK캐피탈", type: "제휴", topic: "자동차금융 MOU 체결 보도자료", date: "2026.03.25", status: "접수" },
  { id: 3, name: "이정호", dept: "경영지원부", subsidiary: "OK금융그룹", type: "인사", topic: "2026년 상반기 인사 발령", date: "2026.03.18", status: "접수" },
  { id: 4, name: "최서연", dept: "ESG경영실", subsidiary: "OK금융그룹", type: "ESG", topic: "탄소중립 경영 선언 보도자료", date: "2026.03.10", status: "검토중" },
  { id: 5, name: "정우진", dept: "리스크관리부", subsidiary: "OK저축은행", type: "실적발표", topic: "2025년 연간 실적 보도자료", date: "2026.02.28", status: "완료" },
];

export default function RequestPage() {
  const [formData, setFormData] = useState({
    name: "",
    department: "",
    subsidiary: "",
    releaseType: "",
    topic: "",
    keywords: "",
    desiredDate: "",
  });
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setIsPreviewLoading(false);
    alert("AI 초안 미리보기가 생성되었습니다. (데모)");
  };

  const handleSubmit = () => {
    alert("신청이 접수되었습니다. (데모)");
  };

  return (
    <>
      <Header title="보도자료 신청" description="보도자료 작성을 신청하고 진행 상황을 확인하세요" />
      <div className="p-8 space-y-8">
        {/* 신청 폼 */}
        <Card className="border-[#DEE2E6] overflow-hidden">
          <div className="bg-gradient-to-r from-[#FFF8F3] to-white px-6 py-4 border-b border-[#F0E4D9]">
            <h3 className="text-sm font-bold text-[#25282B] flex items-center gap-2">
              <Send className="w-4 h-4 text-[#F26522]" />
              새 보도자료 신청
            </h3>
            <p className="text-xs text-[#868E96] mt-0.5">아래 정보를 입력해주세요. AI가 초안을 미리 확인할 수 있습니다.</p>
          </div>

          <div className="p-6 space-y-5">
            {/* 2열 레이아웃 */}
            <div className="grid grid-cols-2 gap-5">
              {/* 이름 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#25282B]">신청자명 <span className="text-[#F26522]">*</span></label>
                <Input
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="이름을 입력하세요"
                  className="rounded-xl border-[#DEE2E6]"
                />
              </div>

              {/* 부서 */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#25282B]">부서 <span className="text-[#F26522]">*</span></label>
                <Input
                  value={formData.department}
                  onChange={(e) => handleChange("department", e.target.value)}
                  placeholder="부서명을 입력하세요"
                  className="rounded-xl border-[#DEE2E6]"
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
                    className="pr-10 rounded-xl border-[#DEE2E6]"
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
                  className="rounded-xl border-[#DEE2E6]"
                />
              </div>
            </div>

            {/* 보도자료 유형 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#25282B]">보도자료 유형 <span className="text-[#F26522]">*</span></label>
              <div className="flex flex-wrap gap-2">
                {RELEASE_TYPES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleChange("releaseType", t.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                      formData.releaseType === t.id
                        ? "bg-[#F26522] text-white shadow-sm shadow-orange-200"
                        : "bg-white border border-[#DEE2E6] text-[#495057] hover:border-[#F26522]/30 hover:text-[#F26522]"
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
                className="rounded-xl border-[#DEE2E6] resize-none"
              />
            </div>

            {/* 키워드 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#25282B]">핵심 키워드</label>
              <Input
                value={formData.keywords}
                onChange={(e) => handleChange("keywords", e.target.value)}
                placeholder="쉼표로 구분하여 입력 (예: 모바일뱅킹, UX개선, 비대면)"
                className="rounded-xl border-[#DEE2E6]"
              />
            </div>

            {/* 첨부파일 */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#25282B]">첨부파일 (참고자료)</label>
              <div className="border-2 border-dashed border-[#DEE2E6] rounded-2xl bg-[#FAFAFA] p-8 text-center cursor-pointer hover:border-[#F26522]/40 hover:bg-[#FFF8F3] transition-all">
                <Upload className="w-8 h-8 text-[#C4A78F] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#495057]">파일을 드래그하거나 클릭하여 업로드</p>
                <p className="text-xs text-[#ADB5BD] mt-1">PDF, DOCX, HWP, 이미지 파일 (최대 10MB)</p>
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex gap-3 pt-2">
              <Button
                onClick={handlePreview}
                disabled={isPreviewLoading}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-[#F26522] text-[#F26522] hover:bg-[#FFF8F3] font-semibold"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isPreviewLoading ? "생성 중..." : "AI 초안 미리보기"}
              </Button>
              <Button
                onClick={handleSubmit}
                className="flex-1 h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] text-white font-semibold shadow-md shadow-orange-200"
              >
                <Send className="w-4 h-4 mr-2" />
                신청하기
              </Button>
            </div>
          </div>
        </Card>

        {/* 내 신청 목록 */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase">내 신청 목록</h3>
          <Card className="border-[#DEE2E6] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#F0F0F0]">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#868E96]">신청자</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#868E96]">계열사</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#868E96]">유형</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#868E96]">주제</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#868E96]">희망일</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#868E96]">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {MOCK_REQUESTS.map((r) => {
                  const st = STATUS_CONFIG[r.status];
                  const Icon = st.icon;
                  return (
                    <tr key={r.id} className="hover:bg-[#FAFAFA] transition-colors cursor-pointer">
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-medium text-[#25282B]">{r.name}</span>
                        <span className="text-[11px] text-[#ADB5BD] ml-1.5">{r.dept}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] font-medium text-[#868E96] bg-[#F8F9FA] px-2 py-0.5 rounded-md">{r.subsidiary}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] text-[#495057]">{r.type}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-[#25282B]">{r.topic}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] text-[#ADB5BD]">{r.date}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg ${st.bg} ${st.color}`}>
                          <Icon className="w-3 h-3" />
                          {st.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </>
  );
}

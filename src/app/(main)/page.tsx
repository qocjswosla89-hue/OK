import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Clock,
  Send,
  BarChart3,
  ArrowRight,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

const STATS = [
  { label: "전체 보도자료", value: "247", unit: "건", icon: FileText, color: "text-[#25282B]" },
  { label: "진행 중 신청", value: "12", unit: "건", icon: Clock, color: "text-[#F26522]" },
  { label: "이번 달 배포", value: "8", unit: "건", icon: Send, color: "text-[#40C057]" },
  { label: "DART 공시", value: "34", unit: "건", icon: BarChart3, color: "text-[#327DF5]" },
];

const RECENT_RELEASES = [
  { title: "OK저축은행, 2025년 3분기 역대 최대 실적 달성", type: "실적발표", typeColor: "bg-[#F26522]/10 text-[#F26522]", subsidiary: "OK저축은행", date: "2025.03.15", status: "배포완료", statusColor: "text-[#40C057]" },
  { title: "OK캐피탈, 중금리 대출 신상품 '오케이 퍼스트론' 출시", type: "신상품", typeColor: "bg-[#FDB913]/15 text-[#B8860B]", subsidiary: "OK캐피탈", date: "2025.03.12", status: "배포완료", statusColor: "text-[#40C057]" },
  { title: "OK금융그룹, 지역사회 상생 ESG 경영 강화", type: "ESG", typeColor: "bg-[#40C057]/10 text-[#40C057]", subsidiary: "OK금융그룹", date: "2025.03.10", status: "검토중", statusColor: "text-[#F26522]" },
  { title: "OK저축은행, '대한민국 금융대상' 최우수상 수상", type: "수상", typeColor: "bg-[#327DF5]/10 text-[#327DF5]", subsidiary: "OK저축은행", date: "2025.03.08", status: "초안", statusColor: "text-[#868E96]" },
];

const RECENT_REQUESTS = [
  { dept: "디지털금융부", name: "김민수", topic: "OK저축은행 모바일뱅킹 앱 리뉴얼 보도자료 요청", date: "2025.03.20", status: "작업중", statusColor: "bg-[#F26522]/10 text-[#F26522]" },
  { dept: "영업기획부", name: "박지현", topic: "OK캐피탈 자동차금융 MOU 체결 보도자료", date: "2025.03.25", status: "접수", statusColor: "bg-[#327DF5]/10 text-[#327DF5]" },
  { dept: "경영지원부", name: "이정호", topic: "OK금융그룹 2025년 인사 발령 관련 보도자료", date: "2025.03.18", status: "접수", statusColor: "bg-[#327DF5]/10 text-[#327DF5]" },
];

export default function Dashboard() {
  return (
    <>
      <Header title="대시보드" description="OK금융그룹 보도자료 현황을 한눈에 확인하세요" />
      <div className="p-8 space-y-8">
        {/* 빠른 액션 배너 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#F26522] to-[#E07B54] p-6 text-white">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-medium opacity-90">AI 보도자료</span>
            </div>
            <h2 className="text-2xl font-bold mb-1">새 보도자료를 작성해보세요</h2>
            <p className="text-sm opacity-80 mb-4">계열사와 유형을 선택하면 AI가 초안을 작성합니다</p>
            <Link
              href="/draft"
              className="inline-flex items-center gap-2 bg-white text-[#F26522] px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-50 transition-colors"
            >
              초안 생성하기
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="absolute right-8 top-4 opacity-10">
            <TrendingUp className="w-40 h-40" />
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-5">
          {STATS.map((stat) => (
            <Card key={stat.label} className="p-5 border-[#DEE2E6] hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-[#868E96]">{stat.label}</span>
                <stat.icon className="w-4 h-4 text-[#C4A78F]" />
              </div>
              <div className="flex items-end gap-1.5">
                <span className={`text-3xl font-bold tracking-tight ${stat.color}`}>{stat.value}</span>
                <span className="text-sm text-[#ADB5BD] mb-1">{stat.unit}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* 2단 레이아웃 */}
        <div className="grid grid-cols-2 gap-6">
          {/* 최근 보도자료 */}
          <Card className="border-[#DEE2E6]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase">최근 보도자료</h3>
              <Link href="/archive" className="text-xs font-medium text-[#F26522] hover:underline">전체보기 →</Link>
            </div>
            <div className="divide-y divide-[#F0F0F0]">
              {RECENT_RELEASES.map((r, i) => (
                <div key={i} className="px-5 py-3.5 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors cursor-pointer">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#25282B] truncate">{r.title}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${r.typeColor}`}>{r.type}</span>
                      <span className="text-[11px] text-[#ADB5BD]">{r.subsidiary} · {r.date}</span>
                    </div>
                  </div>
                  <span className={`text-[11px] font-semibold ml-4 ${r.statusColor}`}>{r.status}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* 최근 신청 */}
          <Card className="border-[#DEE2E6]">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase">최근 신청</h3>
              <Link href="/request" className="text-xs font-medium text-[#F26522] hover:underline">전체보기 →</Link>
            </div>
            <div className="divide-y divide-[#F0F0F0]">
              {RECENT_REQUESTS.map((r, i) => (
                <div key={i} className="px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-[#25282B]">{r.dept} · {r.name}</span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${r.statusColor}`}>{r.status}</span>
                  </div>
                  <p className="text-sm text-[#495057] mb-1">{r.topic}</p>
                  <span className="text-[10px] text-[#ADB5BD]">희망일: {r.date}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

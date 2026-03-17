"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Lock,
  LogIn,
  RefreshCw,
  FileText,
  BarChart3,
  MessageCircle,
  Eye,
  Database,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Settings,
  BookOpen,
  FileEdit,
  Plus,
  Trash2,
  Save,
  Image,
  Type,
  Palette,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface CrawlJob {
  id: string;
  label: string;
  icon: typeof FileText;
  description: string;
  lastRun: string;
  status: "idle" | "running" | "success" | "error";
}

const INITIAL_CRAWL_JOBS: CrawlJob[] = [
  { id: "press", label: "보도자료 크롤링", icon: FileText, description: "OK금융그룹 보도자료 수집", lastRun: "2026.03.17 09:00", status: "success" },
  { id: "dart", label: "DART 공시 크롤링", icon: BarChart3, description: "금감원 전자공시 수집", lastRun: "2026.03.17 09:00", status: "success" },
  { id: "qa", label: "Q&A 데이터 수집", icon: MessageCircle, description: "FAQ 및 Q&A 데이터 수집", lastRun: "2026.03.16 18:00", status: "idle" },
  { id: "competitors", label: "경쟁사 크롤링", icon: Eye, description: "경쟁사 보도자료 수집", lastRun: "2026.03.17 06:00", status: "success" },
  { id: "embedding", label: "임베딩 생성", icon: Database, description: "벡터 임베딩 업데이트", lastRun: "2026.03.16 22:00", status: "idle" },
];

const STATUS_CONFIG = {
  idle: { label: "대기", color: "text-[#868E96]", bg: "bg-[#868E96]/10", icon: Clock },
  running: { label: "실행 중", color: "text-[#327DF5]", bg: "bg-[#327DF5]/10", icon: RefreshCw },
  success: { label: "완료", color: "text-[#40C057]", bg: "bg-[#40C057]/10", icon: CheckCircle2 },
  error: { label: "오류", color: "text-[#E64980]", bg: "bg-[#E64980]/10", icon: AlertTriangle },
};

const MOCK_STYLE_GUIDES = [
  { id: 1, name: "OK저축은행 기본 스타일", rules: "존칭 사용, 회사명 풀네임 기재, 금액 단위 '억원'으로 통일", active: true },
  { id: 2, name: "OK캐피탈 기본 스타일", rules: "전문용어 최소화, 쉬운 표현 사용, 고객 중심 어투", active: true },
  { id: 3, name: "ESG 보도자료 스타일", rules: "지속가능경영 용어 사용, 사회적 가치 강조, 수치 기반 성과 기술", active: false },
];

const MOCK_TEMPLATES = [
  { id: 1, name: "실적발표 템플릿", type: "실적발표", lastModified: "2026.03.10" },
  { id: 2, name: "신상품 출시 템플릿", type: "신상품", lastModified: "2026.03.05" },
  { id: 3, name: "인사 발령 템플릿", type: "인사", lastModified: "2026.02.28" },
  { id: 4, name: "ESG 활동 템플릿", type: "ESG", lastModified: "2026.02.20" },
  { id: 5, name: "제휴/MOU 템플릿", type: "제휴", lastModified: "2026.02.15" },
];

interface SiteConfig {
  dashboardTitle: string;
  dashboardDescription: string;
  bannerTitle: string;
  bannerDescription: string;
  sidebarLogoText: string;
  sidebarSubText: string;
  bannerImageUrl: string;
  sidebarCharacterUrl: string;
  chatbotCharacterUrl: string;
  emptyStateCharacterUrl: string;
}

const DEFAULT_CONFIG: SiteConfig = {
  dashboardTitle: "대시보드",
  dashboardDescription: "OK금융그룹 보도자료 현황을 한눈에 확인하세요",
  bannerTitle: "새 보도자료를 작성해보세요",
  bannerDescription: "계열사와 유형을 선택하면 AI가 초안을 작성합니다",
  sidebarLogoText: "OK금융그룹",
  sidebarSubText: "보도자료 관리 시스템",
  bannerImageUrl: "",
  sidebarCharacterUrl: "",
  chatbotCharacterUrl: "",
  emptyStateCharacterUrl: "",
};

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginError, setLoginError] = useState("");
  const [crawlJobs, setCrawlJobs] = useState(INITIAL_CRAWL_JOBS);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [configSaved, setConfigSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"crawl" | "customize" | "style" | "template">("customize");

  // Load site_config from Supabase on login
  useEffect(() => {
    if (!isLoggedIn) return;
    async function loadConfig() {
      try {
        const { data, error } = await supabase
          .from("site_config")
          .select("key, value");

        if (!error && data && data.length > 0) {
          const configFromDb: Partial<SiteConfig> = {};
          data.forEach((row: { key: string; value: string }) => {
            if (row.key in DEFAULT_CONFIG) {
              (configFromDb as Record<string, string>)[row.key] = row.value;
            }
          });
          setSiteConfig((prev) => ({ ...prev, ...configFromDb }));
        } else {
          // Fallback: try localStorage
          const stored = localStorage.getItem("ok-site-config");
          if (stored) {
            try {
              setSiteConfig(JSON.parse(stored));
            } catch { /* ignore */ }
          }
        }
      } catch (err) {
        console.error("Load config error:", err);
        // Fallback: try localStorage
        const stored = localStorage.getItem("ok-site-config");
        if (stored) {
          try {
            setSiteConfig(JSON.parse(stored));
          } catch { /* ignore */ }
        }
      }
    }
    loadConfig();
  }, [isLoggedIn]);

  const handleConfigChange = (key: keyof SiteConfig, value: string) => {
    setSiteConfig(prev => ({ ...prev, [key]: value }));
    setConfigSaved(false);
  };

  const handleSaveConfig = async () => {
    // Save to localStorage as well for fallback
    localStorage.setItem("ok-site-config", JSON.stringify(siteConfig));

    try {
      // Upsert each config key to site_config table
      const entries = Object.entries(siteConfig);
      for (const [key, value] of entries) {
        await supabase
          .from("site_config")
          .upsert({ key, value: value as string }, { onConflict: "key" });
      }
    } catch (err) {
      console.error("Save config error:", err);
    }

    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  const [imageUploading, setImageUploading] = useState<string | null>(null);

  const handleImageUpload = (key: keyof SiteConfig) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      setImageUploading(key);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "업로드 실패");
        }

        const data = await res.json();
        handleConfigChange(key, data.url);
      } catch (err) {
        console.error("Image upload error:", err);
        alert(`이미지 업로드 실패: ${err instanceof Error ? err.message : "알 수 없는 오류"}`);
      } finally {
        setImageUploading(null);
      }
    };
    input.click();
  };

  const handleLogin = () => {
    if (loginId === "OK01" && loginPw === "OK01") {
      setIsLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  const handleCrawl = async (jobId: string) => {
    setCrawlJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "running" as const } : j))
    );

    await new Promise((r) => setTimeout(r, 2000));

    setCrawlJobs((prev) =>
      prev.map((j) =>
        j.id === jobId
          ? { ...j, status: "success" as const, lastRun: new Date().toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "") }
          : j
      )
    );
  };

  const handleCrawlAll = async () => {
    for (const job of crawlJobs) {
      await handleCrawl(job.id);
    }
  };

  if (!isLoggedIn) {
    return (
      <>
        <Header title="관리자" description="관리자 기능에 접근하려면 로그인하세요" />
        <div className="p-8 flex items-center justify-center" style={{ minHeight: "calc(100vh - 200px)" }}>
          <Card className="w-full max-w-md p-8 border-[#DEE2E6]">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#F26522] to-[#E07B54] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-200">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-[#25282B]">관리자 로그인</h2>
              <p className="text-sm text-[#868E96] mt-1">관리자 권한이 필요합니다</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#25282B]">아이디</label>
                <Input
                  value={loginId}
                  onChange={(e) => { setLoginId(e.target.value); setLoginError(""); }}
                  placeholder="관리자 아이디"
                  className="rounded-xl border-[#DEE2E6] h-11"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#25282B]">비밀번호</label>
                <Input
                  type="password"
                  value={loginPw}
                  onChange={(e) => { setLoginPw(e.target.value); setLoginError(""); }}
                  placeholder="비밀번호"
                  className="rounded-xl border-[#DEE2E6] h-11"
                  onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>

              {loginError && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[#E64980]/10 text-[#E64980]">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span className="text-xs font-medium">{loginError}</span>
                </div>
              )}

              <Button
                onClick={handleLogin}
                className="w-full h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] text-white font-semibold shadow-md shadow-orange-200"
              >
                <LogIn className="w-4 h-4 mr-2" />
                로그인
              </Button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="관리자" description="사이트 커스터마이징, 크롤링, 스타일 가이드, 템플릿을 관리하세요" />
      <div className="p-8 space-y-6">
        {/* 탭 네비게이션 */}
        <div className="flex gap-1 bg-[#F5F6F7] p-1 rounded-xl w-fit">
          {[
            { id: "customize" as const, label: "사이트 꾸미기", icon: Palette },
            { id: "crawl" as const, label: "크롤링 관리", icon: RefreshCw },
            { id: "style" as const, label: "스타일 가이드", icon: BookOpen },
            { id: "template" as const, label: "템플릿 관리", icon: FileText },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-[#F26522] shadow-sm"
                  : "text-[#868E96] hover:text-[#495057]"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* 사이트 꾸미기 탭 */}
        {activeTab === "customize" && (
          <div className="space-y-6">
            {/* 텍스트 수정 */}
            <Card className="p-6 border-[#DEE2E6]">
              <div className="flex items-center gap-2 mb-5">
                <Type className="w-5 h-5 text-[#F26522]" />
                <h3 className="text-sm font-bold text-[#25282B]">텍스트 수정</h3>
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#495057]">대시보드 제목</label>
                  <Input value={siteConfig.dashboardTitle} onChange={(e) => handleConfigChange("dashboardTitle", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#495057]">대시보드 설명</label>
                  <Input value={siteConfig.dashboardDescription} onChange={(e) => handleConfigChange("dashboardDescription", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#495057]">배너 제목</label>
                  <Input value={siteConfig.bannerTitle} onChange={(e) => handleConfigChange("bannerTitle", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#495057]">배너 설명</label>
                  <Input value={siteConfig.bannerDescription} onChange={(e) => handleConfigChange("bannerDescription", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#495057]">사이드바 로고 텍스트</label>
                  <Input value={siteConfig.sidebarLogoText} onChange={(e) => handleConfigChange("sidebarLogoText", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#495057]">사이드바 보조 텍스트</label>
                  <Input value={siteConfig.sidebarSubText} onChange={(e) => handleConfigChange("sidebarSubText", e.target.value)} />
                </div>
              </div>
            </Card>

            {/* 이미지 관리 */}
            <Card className="p-6 border-[#DEE2E6]">
              <div className="flex items-center gap-2 mb-5">
                <Image className="w-5 h-5 text-[#F26522]" />
                <h3 className="text-sm font-bold text-[#25282B]">이미지 관리</h3>
                <span className="text-[11px] text-[#868E96]">읏맨 캐릭터 등 원하는 이미지를 업로드하세요</span>
              </div>
              <div className="grid grid-cols-2 gap-5">
                {[
                  { key: "bannerImageUrl" as const, label: "대시보드 배너 배경", desc: "배너 영역의 배경 이미지" },
                  { key: "sidebarCharacterUrl" as const, label: "사이드바 캐릭터", desc: "사이드바 하단에 표시될 캐릭터" },
                  { key: "chatbotCharacterUrl" as const, label: "챗봇 캐릭터", desc: "챗봇 빈 상태에 표시될 캐릭터" },
                  { key: "emptyStateCharacterUrl" as const, label: "빈 상태 캐릭터", desc: "초안 생성 전 빈 화면에 표시" },
                ].map((item) => (
                  <div key={item.key} className="space-y-2">
                    <label className="text-xs font-medium text-[#495057]">{item.label}</label>
                    <p className="text-[10px] text-[#ADB5BD]">{item.desc}</p>
                    {siteConfig[item.key] ? (
                      <div className="relative group">
                        <div className="w-full h-32 rounded-xl border border-[#DEE2E6] overflow-hidden bg-[#F8F9FA]">
                          <img src={siteConfig[item.key]} alt={item.label} className="w-full h-full object-contain" />
                        </div>
                        <button
                          onClick={() => handleConfigChange(item.key, "")}
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#E64980] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleImageUpload(item.key)}
                          className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-white/90 border border-[#DEE2E6] text-[11px] text-[#495057] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          변경
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleImageUpload(item.key)}
                        disabled={imageUploading === item.key}
                        className="w-full h-32 rounded-xl border-2 border-dashed border-[#DEE2E6] bg-[#F8F9FA] flex flex-col items-center justify-center gap-2 hover:border-[#F26522]/40 hover:bg-[#FFF8F3] transition-all cursor-pointer disabled:opacity-50"
                      >
                        {imageUploading === item.key ? (
                          <>
                            <RefreshCw className="w-5 h-5 text-[#F26522] animate-spin" />
                            <span className="text-xs text-[#F26522]">업로드 중...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-5 h-5 text-[#C4A78F]" />
                            <span className="text-xs text-[#868E96]">이미지 업로드</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* 저장 버튼 */}
            <div className="flex justify-end">
              <Button
                onClick={handleSaveConfig}
                className="bg-[#F26522] hover:bg-[#D9551A] text-white rounded-xl shadow-md shadow-orange-200 px-8"
              >
                <Save className="w-4 h-4 mr-2" />
                {configSaved ? "저장 완료!" : "변경사항 저장"}
              </Button>
            </div>
          </div>
        )}

        {/* 크롤링 관리 탭 */}
        {activeTab === "crawl" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase flex items-center gap-2">
              <Settings className="w-4 h-4" />
              크롤링 관리
            </h3>
            <Button
              onClick={handleCrawlAll}
              variant="outline"
              size="sm"
              className="border-[#F26522] text-[#F26522] hover:bg-[#FFF8F3] rounded-xl"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              전체 실행
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {crawlJobs.map((job) => {
              const st = STATUS_CONFIG[job.status];
              const StIcon = st.icon;
              const JobIcon = job.icon;
              return (
                <Card key={job.id} className="p-5 border-[#DEE2E6] hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#FFF8F3] flex items-center justify-center">
                        <JobIcon className="w-5 h-5 text-[#F26522]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#25282B]">{job.label}</p>
                        <p className="text-[11px] text-[#868E96]">{job.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg ${st.bg} ${st.color}`}>
                          <StIcon className={`w-3 h-3 ${job.status === "running" ? "animate-spin" : ""}`} />
                          {st.label}
                        </span>
                        <p className="text-[10px] text-[#ADB5BD] mt-1">마지막 실행: {job.lastRun}</p>
                      </div>
                      <Button
                        onClick={() => handleCrawl(job.id)}
                        disabled={job.status === "running"}
                        size="sm"
                        className="bg-[#F26522] hover:bg-[#D9551A] text-white rounded-xl shadow-sm shadow-orange-200"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${job.status === "running" ? "animate-spin" : ""}`} />
                        실행
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
        )}

        {/* 스타일 가이드 관리 탭 */}
        {activeTab === "style" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              스타일 가이드 관리
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="border-[#F0E4D9] text-[#8C6B58] hover:bg-[#FFF8F3] rounded-xl"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              새 스타일 추가
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {MOCK_STYLE_GUIDES.map((guide) => (
              <Card key={guide.id} className="p-5 border-[#DEE2E6]">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-semibold text-[#25282B]">{guide.name}</p>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                        guide.active
                          ? "bg-[#40C057]/10 text-[#40C057]"
                          : "bg-[#868E96]/10 text-[#868E96]"
                      }`}>
                        {guide.active ? "활성" : "비활성"}
                      </span>
                    </div>
                    <p className="text-xs text-[#495057] leading-relaxed">{guide.rules}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button className="w-8 h-8 rounded-lg border border-[#DEE2E6] flex items-center justify-center text-[#868E96] hover:bg-[#FFF8F3] hover:text-[#F26522] hover:border-[#F26522]/30 transition-all">
                      <FileEdit className="w-3.5 h-3.5" />
                    </button>
                    <button className="w-8 h-8 rounded-lg border border-[#DEE2E6] flex items-center justify-center text-[#868E96] hover:bg-[#E64980]/5 hover:text-[#E64980] hover:border-[#E64980]/30 transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
        )}

        {/* 템플릿 관리 탭 */}
        {activeTab === "template" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase flex items-center gap-2">
              <FileText className="w-4 h-4" />
              템플릿 관리
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="border-[#F0E4D9] text-[#8C6B58] hover:bg-[#FFF8F3] rounded-xl"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              새 템플릿 추가
            </Button>
          </div>

          <Card className="border-[#DEE2E6] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAFAFA] border-b border-[#F0F0F0]">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#868E96]">템플릿명</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#868E96]">유형</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#868E96]">최종 수정</th>
                  <th className="text-right px-5 py-3 text-[11px] font-semibold text-[#868E96]">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F0F0]">
                {MOCK_TEMPLATES.map((t) => (
                  <tr key={t.id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-[#25282B]">{t.name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] font-medium text-[#868E96] bg-[#F8F9FA] px-2 py-0.5 rounded-md">{t.type}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[11px] text-[#ADB5BD]">{t.lastModified}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5 justify-end">
                        <button className="w-7 h-7 rounded-lg border border-[#DEE2E6] flex items-center justify-center text-[#868E96] hover:bg-[#FFF8F3] hover:text-[#F26522] hover:border-[#F26522]/30 transition-all">
                          <FileEdit className="w-3 h-3" />
                        </button>
                        <button className="w-7 h-7 rounded-lg border border-[#DEE2E6] flex items-center justify-center text-[#868E96] hover:bg-[#E64980]/5 hover:text-[#E64980] hover:border-[#E64980]/30 transition-all">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        )}
      </div>
    </>
  );
}

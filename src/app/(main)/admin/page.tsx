"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkAdmin, setAdminSession } from "@/lib/auth";
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
  LayoutGrid,
  ClipboardList,
  ExternalLink,
} from "lucide-react";

interface CrawlJob {
  id: string;
  label: string;
  icon: typeof FileText;
  description: string;
  lastRun: string;
  status: "idle" | "running" | "success" | "error";
}

const INITIAL_CRAWL_JOBS: CrawlJob[] = [
  { id: "press", label: "보도자료 크롤링", icon: FileText, description: "OK금융그룹 보도자료 수집", lastRun: "-", status: "idle" },
  { id: "dart", label: "DART 공시 크롤링", icon: BarChart3, description: "금감원 전자공시 수집", lastRun: "-", status: "idle" },
  { id: "qa", label: "Q&A 데이터 수집", icon: MessageCircle, description: "FAQ 및 Q&A 데이터 수집", lastRun: "-", status: "idle" },
  { id: "competitors", label: "경쟁사 크롤링", icon: Eye, description: "경쟁사 보도자료 수집", lastRun: "-", status: "idle" },
  { id: "embedding", label: "임베딩 생성", icon: Database, description: "벡터 임베딩 업데이트", lastRun: "-", status: "idle" },
];

const STATUS_CONFIG = {
  idle: { label: "대기", color: "text-[#868E96]", bg: "bg-[#868E96]/10", icon: Clock },
  running: { label: "실행 중", color: "text-[#327DF5]", bg: "bg-[#327DF5]/10", icon: RefreshCw },
  success: { label: "완료", color: "text-[#40C057]", bg: "bg-[#40C057]/10", icon: CheckCircle2 },
  error: { label: "오류", color: "text-[#E64980]", bg: "bg-[#E64980]/10", icon: AlertTriangle },
};

interface StyleGuide { id: number; name: string; rules: string; active: boolean; }
interface Template { id: number; name: string; type: string; lastModified: string; }

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
  iconLabel_draft: string;
  iconLabel_archive: string;
  iconLabel_dart: string;
  iconLabel_competitors: string;
  iconLabel_chatbot: string;
  iconLabel_request: string;
  iconLabel_disclosure: string;
  iconLabel_admin: string;
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
  iconLabel_draft: "초안 생성",
  iconLabel_archive: "아카이브",
  iconLabel_dart: "DART",
  iconLabel_competitors: "경쟁사",
  iconLabel_chatbot: "AI 챗봇",
  iconLabel_request: "신청",
  iconLabel_disclosure: "경영공시",
  iconLabel_admin: "관리자",
};

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginError, setLoginError] = useState("");
  const [crawlJobs, setCrawlJobs] = useState(INITIAL_CRAWL_JOBS);
  const [siteConfig, setSiteConfig] = useState<SiteConfig>(DEFAULT_CONFIG);
  const [configSaved, setConfigSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<"crawl" | "customize" | "style" | "template" | "requests">("customize");
  const [styleGuides, setStyleGuides] = useState<StyleGuide[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);

  interface RequestItem {
    id: number;
    name: string;
    dept: string;
    subsidiary: string;
    type: string;
    topic: string;
    date: string;
    status: string;
    keywords: string;
    attachment_url: string;
    attachment_name: string;
  }
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);

  // Load site_config from Supabase on login
  useEffect(() => {
    if (!isLoggedIn) return;
    async function loadConfig() {
      try {
        const res = await fetch("/api/data/site-config");
        const configMap = await res.json();
        if (Object.keys(configMap).length > 0) {
          const configFromDb: Partial<SiteConfig> = {};
          Object.entries(configMap).forEach(([key, value]) => {
            if (key in DEFAULT_CONFIG) (configFromDb as Record<string, string>)[key] = value as string;
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
    const loadRequests = async () => {
      setRequestsLoading(true);
      try {
        const reqRes2 = await fetch("/api/data/requests");
        const data = await reqRes2.json();
        if (data) {
          setRequests(data.map((r: any) => ({
            id: r.id,
            name: r.requester_name || "",
            dept: r.department || "",
            subsidiary: r.subsidiary || "",
            type: r.release_type || "",
            topic: r.topic || "",
            date: r.desired_date ? new Date(r.desired_date).toLocaleDateString("ko-KR") : "",
            status: r.status || "pending",
            keywords: r.keywords || "",
            attachment_url: r.attachment_url || "",
            attachment_name: r.attachment_name || "",
          })));
        }
      } catch (err) {
        console.error("Load requests error:", err);
      } finally {
        setRequestsLoading(false);
      }
    };

    loadConfig();
    loadRequests();
  }, [isLoggedIn]);

  const loadRequests = async () => {
    setRequestsLoading(true);
    try {
      const reqRes = await fetch("/api/data/requests");
      const data = await reqRes.json();
      if (data) {
        setRequests(data.map((r: any) => ({
          id: r.id,
          name: r.requester_name || "",
          dept: r.department || "",
          subsidiary: r.subsidiary || "",
          type: r.release_type || "",
          topic: r.topic || "",
          date: r.desired_date ? new Date(r.desired_date).toLocaleDateString("ko-KR") : "",
          status: r.status || "pending",
          keywords: r.keywords || "",
          attachment_url: r.attachment_url || "",
          attachment_name: r.attachment_name || "",
        })));
      }
    } catch (err) {
      console.error("Load requests error:", err);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleConfigChange = (key: keyof SiteConfig, value: string) => {
    setSiteConfig(prev => ({ ...prev, [key]: value }));
    setConfigSaved(false);
  };

  const handleSaveConfig = async () => {
    // Save to localStorage as well for fallback
    localStorage.setItem("ok-site-config", JSON.stringify(siteConfig));

    try {
      // Upsert each config key to site_config table
      await fetch("/api/data/site-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(siteConfig),
      });
    } catch (err) {
      console.error("Save config error:", err);
    }

    setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  };

  const [imageUploading, setImageUploading] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const [currentImageKey, setCurrentImageKey] = useState<keyof SiteConfig | null>(null);

  const handleImageUpload = (key: keyof SiteConfig) => {
    setCurrentImageKey(key);
    imageFileInputRef.current?.click();
  };

  const handleLogin = async () => {
    const ok = await checkAdmin(loginId, loginPw);
    if (ok) {
      setAdminSession(true);
      setIsLoggedIn(true);
      setLoginError("");
    } else {
      setLoginError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  const handleRequestStatusChange = async (requestId: number, newStatus: string, requestTitle?: string) => {
    await fetch(`/api/data/requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
    if (newStatus === "completed" || newStatus === "review") {
      await fetch("/api/data/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newStatus === "completed" ? "보도자료 신청 완료" : "보도자료 검토 시작", message: requestTitle ? `"${requestTitle}" 신청이 변경되었습니다.` : `신청 #${requestId}이(가) 변경되었습니다.`, type: "request", related_id: requestId }),
      });
    }
  };

  const handleCrawl = async (jobId: string) => {
    setCrawlJobs((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, status: "running" as const } : j))
    );

    let resultMessage = "";
    try {
      if (jobId === "press") {
        const res = await fetch("/api/crawl/ok-news", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          resultMessage = data.message || `${data.inserted}건 추가됨`;
        } else {
          throw new Error("크롤링 요청 실패");
        }
      } else if (jobId === "competitors") {
        const res = await fetch("/api/crawl/competitors", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          resultMessage = `경쟁사 ${data.inserted}건 추가됨`;
        } else {
          throw new Error("크롤링 요청 실패");
        }
      } else if (jobId === "dart") {
        const res = await fetch("/api/crawl/dart", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          resultMessage = data.message || `DART 공시 ${data.inserted}건 추가됨`;
        } else {
          throw new Error("DART 크롤링 요청 실패");
        }
      } else {
        await new Promise((r) => setTimeout(r, 2000));
      }
    } catch {
      setCrawlJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: "error" as const } : j))
      );
      return;
    }

    const job = INITIAL_CRAWL_JOBS.find((j) => j.id === jobId);
    if (job) {
      await fetch("/api/data/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "크롤링 완료", message: resultMessage || `${job.label} 작업이 완료되었습니다.`, type: "crawl" }),
      });
    }

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

  // 로그인 화면
  if (!isLoggedIn) {
    return (
      <div className="px-4">
        <div className="pt-5 pb-3">
          <h1 className="text-[18px] font-bold text-[#1A1A1A]">관리자</h1>
        </div>
        <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 160px)" }}>
          <Card className="w-full max-w-sm p-6 rounded-xl border-[#EBEBEB]">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F26522] to-[#E07B54] flex items-center justify-center mx-auto mb-3 shadow-lg shadow-orange-200">
                <Lock className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-[17px] font-bold text-[#25282B]">관리자 로그인</h2>
              <p className="text-xs text-[#868E96] mt-1">관리자 권한이 필요합니다</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#25282B]">아이디</label>
                <Input
                  value={loginId}
                  onChange={(e) => { setLoginId(e.target.value); setLoginError(""); }}
                  placeholder="관리자 아이디"
                  className="rounded-xl border-[#EBEBEB] h-11"
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
                  className="rounded-xl border-[#EBEBEB] h-11"
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
      </div>
    );
  }

  return (
    <div className="px-4 space-y-4">
      {/* 페이지 타이틀 */}
      <div className="pt-5 pb-3">
        <h1 className="text-[18px] font-bold text-[#1A1A1A]">관리자</h1>
      </div>

      {/* 탭 네비게이션 - 수평 스크롤 */}
      <div className="flex gap-2 overflow-x-auto pb-1 flex-nowrap">
        {[
          { id: "customize" as const, label: "사이트 꾸미기", icon: Palette },
          { id: "crawl" as const, label: "크롤링 관리", icon: RefreshCw },
          { id: "style" as const, label: "스타일 가이드", icon: BookOpen },
          { id: "template" as const, label: "템플릿 관리", icon: FileText },
          { id: "requests" as const, label: "신청 관리", icon: ClipboardList },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all ${
              activeTab === tab.id
                ? "bg-[#F26522] text-white shadow-sm shadow-orange-200"
                : "bg-white border border-[#EBEBEB] text-[#495057]"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 사이트 꾸미기 탭 */}
      {activeTab === "customize" && (
        <div className="space-y-4 pb-2">
          {/* 텍스트 수정 */}
          <Card className="p-4 rounded-xl border-[#EBEBEB]">
            <div className="flex items-center gap-2 mb-4">
              <Type className="w-4 h-4 text-[#F26522]" />
              <h3 className="text-sm font-bold text-[#25282B]">텍스트 수정</h3>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#495057]">대시보드 제목</label>
                <Input value={siteConfig.dashboardTitle} onChange={(e) => handleConfigChange("dashboardTitle", e.target.value)} className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#495057]">대시보드 설명</label>
                <Input value={siteConfig.dashboardDescription} onChange={(e) => handleConfigChange("dashboardDescription", e.target.value)} className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#495057]">배너 제목</label>
                <Input value={siteConfig.bannerTitle} onChange={(e) => handleConfigChange("bannerTitle", e.target.value)} className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#495057]">배너 설명</label>
                <Input value={siteConfig.bannerDescription} onChange={(e) => handleConfigChange("bannerDescription", e.target.value)} className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#495057]">사이드바 로고 텍스트</label>
                <Input value={siteConfig.sidebarLogoText} onChange={(e) => handleConfigChange("sidebarLogoText", e.target.value)} className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#495057]">사이드바 보조 텍스트</label>
                <Input value={siteConfig.sidebarSubText} onChange={(e) => handleConfigChange("sidebarSubText", e.target.value)} className="rounded-xl border-[#EBEBEB] h-10" />
              </div>
            </div>
          </Card>

          {/* 홈 아이콘 이름 */}
          <Card className="p-4 rounded-xl border-[#EBEBEB]">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="w-4 h-4 text-[#F26522]" />
              <h3 className="text-sm font-bold text-[#25282B]">홈 아이콘 이름</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "iconLabel_draft" as const, placeholder: "초안 생성" },
                { key: "iconLabel_archive" as const, placeholder: "아카이브" },
                { key: "iconLabel_dart" as const, placeholder: "DART" },
                { key: "iconLabel_competitors" as const, placeholder: "경쟁사" },
                { key: "iconLabel_chatbot" as const, placeholder: "AI 챗봇" },
                { key: "iconLabel_request" as const, placeholder: "신청" },
                { key: "iconLabel_disclosure" as const, placeholder: "경영공시" },
                { key: "iconLabel_admin" as const, placeholder: "관리자" },
              ]).map((item) => (
                <div key={item.key} className="space-y-1">
                  <label className="text-[11px] text-[#ADB5BD]">{item.placeholder}</label>
                  <Input
                    value={siteConfig[item.key]}
                    onChange={(e) => handleConfigChange(item.key, e.target.value)}
                    placeholder={item.placeholder}
                    className="rounded-xl border-[#EBEBEB] h-9 text-sm"
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* 이미지 관리 */}
          <Card className="p-4 rounded-xl border-[#EBEBEB]">
            <div className="flex items-center gap-2 mb-4">
              <Image className="w-4 h-4 text-[#F26522]" />
              <h3 className="text-sm font-bold text-[#25282B]">이미지 관리</h3>
            </div>
            <div className="space-y-4">
              {[
                { key: "bannerImageUrl" as const, label: "대시보드 배너 배경", desc: "배너 영역의 배경 이미지" },
                { key: "sidebarCharacterUrl" as const, label: "사이드바 캐릭터", desc: "사이드바 하단에 표시될 캐릭터" },
                { key: "chatbotCharacterUrl" as const, label: "챗봇 캐릭터", desc: "챗봇 빈 상태에 표시될 캐릭터" },
                { key: "emptyStateCharacterUrl" as const, label: "빈 상태 캐릭터", desc: "초안 생성 전 빈 화면에 표시" },
              ].map((item) => (
                <div key={item.key} className="space-y-1.5">
                  <div>
                    <label className="text-xs font-medium text-[#495057]">{item.label}</label>
                    <p className="text-[11px] text-[#ADB5BD]">{item.desc}</p>
                  </div>
                  {siteConfig[item.key] ? (
                    <div className="relative group">
                      <div className="w-full h-28 rounded-xl border border-[#EBEBEB] overflow-hidden bg-[#F8F9FA]">
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
                        className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-white/90 border border-[#EBEBEB] text-[11px] text-[#495057] opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        변경
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleImageUpload(item.key)}
                      disabled={imageUploading === item.key}
                      className="w-full h-24 rounded-xl border-2 border-dashed border-[#EBEBEB] bg-[#F8F9FA] flex flex-col items-center justify-center gap-1.5 hover:border-[#F26522]/40 hover:bg-[#FFF8F3] transition-all cursor-pointer disabled:opacity-50"
                    >
                      {imageUploading === item.key ? (
                        <>
                          <RefreshCw className="w-4 h-4 text-[#F26522] animate-spin" />
                          <span className="text-xs text-[#F26522]">업로드 중...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 text-[#C4A78F]" />
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
          <Button
            onClick={handleSaveConfig}
            className="w-full h-12 rounded-xl bg-[#F26522] hover:bg-[#D9551A] text-white font-semibold shadow-md shadow-orange-200"
          >
            <Save className="w-4 h-4 mr-2" />
            {configSaved ? "저장 완료!" : "변경사항 저장"}
          </Button>
          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file || !currentImageKey) return;
              setImageUploading(currentImageKey);
              try {
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/upload", { method: "POST", body: formData });
                if (!res.ok) throw new Error("업로드 실패");
                const data = await res.json();
                handleConfigChange(currentImageKey, data.url);
              } catch (err) {
                alert(`이미지 업로드 실패: ${err instanceof Error ? err.message : "오류"}`);
              } finally {
                setImageUploading(null);
                e.target.value = "";
              }
            }}
          />
        </div>
      )}

      {/* 크롤링 관리 탭 */}
      {activeTab === "crawl" && (
        <div className="space-y-3 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" />
              크롤링 관리
            </h3>
            <Button
              onClick={handleCrawlAll}
              variant="outline"
              size="sm"
              className="border-[#F26522] text-[#F26522] hover:bg-[#FFF8F3] rounded-xl text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              전체 실행
            </Button>
          </div>

          <div className="space-y-3">
            {crawlJobs.map((job) => {
              const st = STATUS_CONFIG[job.status];
              const StIcon = st.icon;
              const JobIcon = job.icon;
              return (
                <Card key={job.id} className="p-4 rounded-xl border-[#EBEBEB] hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#FFF8F3] flex items-center justify-center shrink-0">
                        <JobIcon className="w-4 h-4 text-[#F26522]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#25282B]">{job.label}</p>
                        <p className="text-[11px] text-[#868E96]">{job.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg ${st.bg} ${st.color}`}>
                          <StIcon className={`w-3 h-3 ${job.status === "running" ? "animate-spin" : ""}`} />
                          {st.label}
                        </span>
                        <p className="text-[10px] text-[#ADB5BD] mt-0.5">{job.lastRun}</p>
                      </div>
                      <Button
                        onClick={() => handleCrawl(job.id)}
                        disabled={job.status === "running"}
                        size="sm"
                        className="bg-[#F26522] hover:bg-[#D9551A] text-white rounded-xl shadow-sm shadow-orange-200 text-xs px-3"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${job.status === "running" ? "animate-spin" : ""}`} />
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
        <div className="space-y-3 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              스타일 가이드
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="border-[#F0E4D9] text-[#8C6B58] hover:bg-[#FFF8F3] rounded-xl text-xs"
              onClick={() => {
                const name = prompt("스타일 가이드 이름:");
                if (!name) return;
                const rules = prompt("규칙 (쉼표 구분):") || "";
                setStyleGuides(prev => [...prev, { id: Date.now(), name, rules, active: true }]);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              새 스타일 추가
            </Button>
          </div>

          <div className="space-y-3">
            {styleGuides.length === 0 && (
              <p className="text-xs text-[#ADB5BD] text-center py-6">등록된 스타일 가이드가 없습니다</p>
            )}
            {styleGuides.map((guide) => (
              <Card key={guide.id} className="p-4 rounded-xl border-[#EBEBEB]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#25282B]">{guide.name}</p>
                      <button
                        onClick={() => setStyleGuides(prev => prev.map(g => g.id === guide.id ? { ...g, active: !g.active } : g))}
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-md cursor-pointer ${
                          guide.active ? "bg-[#40C057]/10 text-[#40C057]" : "bg-[#868E96]/10 text-[#868E96]"
                        }`}
                      >
                        {guide.active ? "활성" : "비활성"}
                      </button>
                    </div>
                    <p className="text-xs text-[#495057] leading-relaxed">{guide.rules}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        const rules = prompt("규칙 수정:", guide.rules);
                        if (rules === null) return;
                        setStyleGuides(prev => prev.map(g => g.id === guide.id ? { ...g, rules } : g));
                      }}
                      className="w-8 h-8 rounded-lg border border-[#EBEBEB] flex items-center justify-center text-[#868E96] hover:bg-[#FFF8F3] hover:text-[#F26522] hover:border-[#F26522]/30 transition-all"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm("삭제하시겠습니까?")) setStyleGuides(prev => prev.filter(g => g.id !== guide.id)); }}
                      className="w-8 h-8 rounded-lg border border-[#EBEBEB] flex items-center justify-center text-[#868E96] hover:bg-[#E64980]/5 hover:text-[#E64980] hover:border-[#E64980]/30 transition-all"
                    >
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
        <div className="space-y-3 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              템플릿 관리
            </h3>
            <Button
              variant="outline"
              size="sm"
              className="border-[#F0E4D9] text-[#8C6B58] hover:bg-[#FFF8F3] rounded-xl text-xs"
              onClick={() => {
                const name = prompt("템플릿 이름:");
                if (!name) return;
                const type = prompt("유형 (실적발표/신상품/인사/ESG/수상/제휴/이벤트):") || "";
                const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "");
                setTemplates(prev => [...prev, { id: Date.now(), name, type, lastModified: today }]);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              새 템플릿 추가
            </Button>
          </div>

          <div className="space-y-3">
            {templates.length === 0 && (
              <p className="text-xs text-[#ADB5BD] text-center py-6">등록된 템플릿이 없습니다</p>
            )}
            {templates.map((t) => (
              <Card key={t.id} className="p-4 rounded-xl border-[#EBEBEB]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-[#25282B]">{t.name}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-[#868E96] bg-[#F8F9FA] px-2 py-0.5 rounded-md">{t.type}</span>
                      <span className="text-[11px] text-[#ADB5BD]">수정: {t.lastModified}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        const name = prompt("템플릿 이름 수정:", t.name);
                        if (name === null) return;
                        const today = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).replace(/\. /g, ".").replace(/\.$/, "");
                        setTemplates(prev => prev.map(item => item.id === t.id ? { ...item, name, lastModified: today } : item));
                      }}
                      className="w-8 h-8 rounded-lg border border-[#EBEBEB] flex items-center justify-center text-[#868E96] hover:bg-[#FFF8F3] hover:text-[#F26522] hover:border-[#F26522]/30 transition-all"
                    >
                      <FileEdit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { if (confirm("삭제하시겠습니까?")) setTemplates(prev => prev.filter(item => item.id !== t.id)); }}
                      className="w-8 h-8 rounded-lg border border-[#EBEBEB] flex items-center justify-center text-[#868E96] hover:bg-[#E64980]/5 hover:text-[#E64980] hover:border-[#E64980]/30 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 신청 관리 탭 */}
      {activeTab === "requests" && (
        <div className="space-y-3 pb-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#868E96] tracking-widest uppercase flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              신청 관리
            </h3>
            <button onClick={loadRequests} className="text-xs text-[#F26522] flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              새로고침
            </button>
          </div>

          {requestsLoading ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-5 h-5 text-[#F26522] animate-spin" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-10 text-sm text-[#ADB5BD]">접수된 신청이 없습니다</div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const STATUS_OPTIONS = [
                  { value: "pending", label: "접수" },
                  { value: "in_progress", label: "작업중" },
                  { value: "review", label: "검토중" },
                  { value: "completed", label: "완료" },
                ];
                const STATUS_COLORS: Record<string, string> = {
                  pending: "text-[#327DF5] bg-[#327DF5]/10",
                  in_progress: "text-[#F26522] bg-[#F26522]/10",
                  review: "text-[#FDB913] bg-[#FDB913]/15",
                  completed: "text-[#40C057] bg-[#40C057]/10",
                  접수: "text-[#327DF5] bg-[#327DF5]/10",
                  작업중: "text-[#F26522] bg-[#F26522]/10",
                  검토중: "text-[#FDB913] bg-[#FDB913]/15",
                  완료: "text-[#40C057] bg-[#40C057]/10",
                };
                return (
                  <Card key={r.id} className="p-4 rounded-xl border-[#EBEBEB]">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-[#25282B] leading-snug flex-1">{r.topic}</p>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg shrink-0 ${STATUS_COLORS[r.status] || "text-[#868E96] bg-[#868E96]/10"}`}>
                          {STATUS_OPTIONS.find(s => s.value === r.status)?.label || r.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px] text-[#868E96]">
                        <span className="bg-[#F8F9FA] px-2 py-0.5 rounded-md">{r.subsidiary}</span>
                        <span>{r.type}</span>
                        <span>{r.name} · {r.dept}</span>
                        {r.date && <span>희망: {r.date}</span>}
                      </div>
                      {r.keywords && (
                        <p className="text-[11px] text-[#ADB5BD]">키워드: {r.keywords}</p>
                      )}
                      {r.attachment_url && (
                        <a href={r.attachment_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#327DF5] hover:underline">
                          <ExternalLink className="w-3 h-3" />
                          {r.attachment_name || "첨부파일 보기"}
                        </a>
                      )}
                      <div className="flex gap-1.5 pt-1">
                        {STATUS_OPTIONS.map(s => (
                          <button
                            key={s.value}
                            onClick={() => handleRequestStatusChange(r.id, s.value, r.topic)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                              r.status === s.value
                                ? "bg-[#F26522] text-white border-[#F26522]"
                                : "bg-white text-[#495057] border-[#EBEBEB] hover:border-[#F26522]/40"
                            }`}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

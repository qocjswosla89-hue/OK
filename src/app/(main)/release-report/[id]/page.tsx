"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ExternalLink, Loader2, Sparkles } from "lucide-react";
import { getAdminSession } from "@/lib/auth";
import { Day, md, Sent, Timeline } from "../../issues/timeline";

const BADGE: Record<Sent, string> = {
  긍정: "bg-[#EDF4FD] text-[#1F5FAE]",
  중립: "bg-[#F1F3F5] text-[#495057]",
  부정: "bg-[#FFF5F5] text-[#C92A2A]",
  미분류: "bg-[#F8F9FA] text-[#ADB5BD]",
};

interface Article { id: number; title: string; url: string; outlet: string; reporter: string; sentiment: Sent; at: string; kst: string }
interface Peer { id: number; title: string; d: string; articles: number }
interface Report {
  release: { id: number; title: string; source_url: string | null; release_type?: string; subsidiary?: string; d: string };
  total: number;
  outletCount: number;
  within24: number;
  sentiment: Record<Sent, number>;
  first: Article | null;
  last: string | null;
  unit: "hour" | "day";
  buckets: Day[];
  peak: { d: string; total: number } | null;
  outlets: { name: string; count: number; first: string; reporters: string[] }[];
  articles: Article[];
  compare: { peers: Peer[]; rank: number; of: number; avg: number };
}

const hourLabel = (k: string) => (k.slice(11, 13) === "00" ? md(k) : `${Number(k.slice(11, 13))}시`);
const hourTip = (k: string) => `${md(k)} ${Number(k.slice(11, 13))}시`;
const short = (kst: string) => `${md(kst)} ${kst.slice(11, 16)}`;

export default function ReleaseReportPage() {
  const { id } = useParams<{ id: string }>();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    const admin = getAdminSession();
    setIsAdmin(admin);
    if (!admin) return;
    setData(null);
    setSelected(null);
    setSummary("");
    fetch(`/api/admin/release-report?id=${id}`)
      .then(async (r) => { const j = await r.json(); if (r.ok) setData(j); else setError(j.error || "리포트를 불러오지 못했습니다."); })
      .catch(() => setError("리포트를 불러오지 못했습니다."));
  }, [id]);

  const shown = useMemo(() => {
    if (!data) return [];
    const len = data.unit === "hour" ? 13 : 10;
    return data.articles.filter((a) => !selected || a.kst.slice(0, len) === selected);
  }, [data, selected]);

  async function evaluate() {
    if (!data) return;
    setSummarizing(true);
    try {
      const res = await fetch("/api/admin/release-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.release.title, total: data.total, outletCount: data.outletCount, within24: data.within24,
          sentiment: data.sentiment, first: data.first, outlets: data.outlets, compare: { rank: data.compare.rank, of: data.compare.of, avg: data.compare.avg },
          titles: data.articles.map((a) => `${a.kst} [${a.outlet}·${a.sentiment}] ${a.title}`),
        }),
      });
      const j = await res.json();
      setSummary(res.ok ? j.summary : j.error || "평가에 실패했습니다.");
    } finally {
      setSummarizing(false);
    }
  }

  if (isAdmin === false) {
    return (
      <div className="px-4 pt-5">
        <h1 className="text-[18px] font-bold text-[#1A1A1A] mb-2">보도자료 성과</h1>
        <p className="text-[13px] text-[#868E96]">관리자 전용 화면입니다. <Link href="/admin" className="text-[#F26522] underline">관리자 로그인</Link> 후 이용해 주세요.</p>
      </div>
    );
  }
  if (error) return <div className="px-4 pt-5 text-[13px] text-[#E03131]">{error}</div>;
  if (!data) {
    return (
      <div className="py-24 flex flex-col items-center gap-2 text-[13px] text-[#ADB5BD]">
        <Loader2 className="w-5 h-5 animate-spin" />같은 보도자료로 나간 기사를 모으는 중...
      </div>
    );
  }

  const r = data.release;
  const ratio = data.compare.avg > 0 ? data.total / data.compare.avg : 0;
  const negPct = data.total ? Math.round((data.sentiment.부정 / data.total) * 100) : 0;
  const maxOutlet = Math.max(1, ...data.outlets.map((o) => o.count));

  return (
    <div className="px-4 pt-4 pb-10">
      <Link href="/" className="inline-flex items-center gap-0.5 text-[12px] text-[#868E96] hover:text-[#F26522] mb-3">
        <ChevronLeft className="w-3.5 h-3.5" />보도자료 목록
      </Link>

      {/* 제목 */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap text-[11px] text-[#ADB5BD]">
        <span className="font-semibold text-[#F26522]">보도자료 성과</span>
        {r.release_type && <><span>·</span><span>{r.release_type}</span></>}
        {r.subsidiary && <><span>·</span><span>{r.subsidiary}</span></>}
        <span>·</span><span>{r.d.slice(0, 10).replace(/-/g, ".")}</span>
        {r.source_url && (
          <a href={r.source_url} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 hover:text-[#327DF5]">
            <ExternalLink className="w-3 h-3" />원문
          </a>
        )}
      </div>
      <h1 className="text-[17px] font-bold text-[#1A1A1A] leading-snug">{r.title}</h1>

      {data.total === 0 ? (
        <div className="mt-6 p-5 rounded-2xl bg-[#F8F9FA] text-[13px] text-[#868E96] leading-relaxed">
          이 보도자료로 묶인 기사를 찾지 못했습니다. 직접 작성한 보도자료라 기사 제목이 많이 다르거나, 기사가 아직 수집되지 않았을 수 있습니다.
        </div>
      ) : (
        <>
          {/* 핵심 숫자 */}
          <div className="mt-4 p-5 rounded-2xl bg-gradient-to-br from-[#FFF4EC] to-[#FFFFFF] border border-[#FFE3D1]">
            <div className="flex items-end gap-5 flex-wrap">
              <div>
                <p className="text-[12px] text-[#868E96]">보도 기사</p>
                <p className="text-[40px] font-extrabold text-[#25282B] leading-none tabular-nums">{data.total}<span className="text-[18px] font-bold ml-0.5">건</span></p>
              </div>
              <div className="pb-1">
                <p className="text-[12px] text-[#868E96]">보도 매체</p>
                <p className="text-[24px] font-bold text-[#25282B] leading-none tabular-nums">{data.outletCount}<span className="text-[14px] ml-0.5">곳</span></p>
              </div>
            </div>
            {data.compare.of > 1 && (
              <p className="mt-3 text-[13px] text-[#495057]">
                최근 90일 보도자료 {data.compare.of}건 중 <b className="text-[#F26522]">{data.compare.rank}위</b>
                <span className="text-[#ADB5BD]"> · </span>평균 {data.compare.avg}건의{" "}
                <b className={ratio >= 1 ? "text-[#F26522]" : "text-[#495057]"}>{ratio.toFixed(1)}배</b>
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-3">
            <Stat label="첫 보도" value={data.first ? short(data.first.kst) : "-"} sub={data.first?.outlet} />
            <Stat label="첫 기사 후 24시간" value={`${data.within24}건`} sub={`전체의 ${Math.round((data.within24 / data.total) * 100)}%`} />
            <Stat label="부정 기사" value={`${data.sentiment.부정}건`} sub={`${negPct}%`} warn={negPct >= 20} />
          </div>

          {/* AI 평가 */}
          <div className="mt-3">
            {summary ? (
              <div className="p-4 rounded-2xl bg-[#F8F9FA] text-[13px] text-[#343A40] leading-relaxed">
                <p className="flex items-center gap-1 text-[11px] font-semibold text-[#F26522] mb-1"><Sparkles className="w-3.5 h-3.5" />AI 평가</p>
                {summary}
              </div>
            ) : (
              <button onClick={evaluate} disabled={summarizing}
                className="w-full h-11 rounded-2xl border border-[#FFD8BF] text-[13px] font-semibold text-[#F26522] hover:bg-[#FFF8F3] disabled:opacity-60 flex items-center justify-center gap-1.5">
                {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI 평가 받기
              </button>
            )}
          </div>

          {/* 확산 */}
          <Section title="얼마나 빨리 퍼졌나" sub={data.unit === "hour" ? "시간대별 기사 수" : "날짜별 기사 수"}>
            <Timeline
              daily={data.buckets}
              releases={[]}
              peak={data.peak}
              selected={selected}
              onSelect={setSelected}
              {...(data.unit === "hour" ? { label: hourLabel, tip: hourTip, every: data.buckets.length > 36 ? 12 : 6, hint: "막대를 누르면 그 시간 기사만 봅니다" } : {})}
            />
          </Section>

          {/* 최근 보도자료 비교 */}
          {data.compare.peers.length > 1 && (
            <Section title="다른 보도자료와 비교" sub="최근 90일 · 보도자료별 기사 수">
              <PeerBars peers={data.compare.peers} current={r.id} avg={data.compare.avg} />
            </Section>
          )}

          {/* 매체 */}
          <Section title="어디서 받아썼나" sub={`${data.outletCount}개 매체 · 먼저 보도한 순서는 기사 목록 참고`}>
            <div className="space-y-2">
              {data.outlets.map((o) => (
                <div key={o.name} className="flex items-center gap-2 text-[12px]">
                  <span className="w-[88px] shrink-0 truncate text-[#343A40]">{o.name}</span>
                  <div className="flex-1 h-2">
                    <div className="h-full rounded-r-[4px] bg-[#FDBA8C]" style={{ width: `${(o.count / maxOutlet) * 100}%`, minWidth: 4 }} />
                  </div>
                  <span className="w-6 text-right tabular-nums text-[#495057]">{o.count}</span>
                  <span className="w-[72px] shrink-0 truncate text-[11px] text-[#ADB5BD]">{o.reporters.join(", ")}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* 기사 목록 */}
          <Section
            title="기사 목록"
            sub={selected ? `${data.unit === "hour" ? hourTip(selected) : md(selected)} · ${shown.length}건` : `보도 순 · ${data.total}건`}
            action={selected ? <button onClick={() => setSelected(null)} className="text-[11px] text-[#F26522]">전체 보기</button> : null}
          >
            <div className="divide-y divide-[#F1F3F5] -mx-1">
              {shown.map((a, i) => (
                <a key={a.id} href={a.url} target="_blank" rel="noopener noreferrer" className="block px-1 py-2.5 hover:bg-[#FAFAFA]">
                  <div className="flex items-center gap-1.5 text-[11px] mb-0.5">
                    <span className="w-5 text-[#CED4DA] tabular-nums">{i + 1}</span>
                    <span className={`px-1.5 py-[1px] rounded text-[10px] font-semibold ${BADGE[a.sentiment]}`}>{a.sentiment}</span>
                    <span className="text-[#327DF5]">{a.outlet}</span>
                    {a.reporter && <span className="text-[#868E96]">{a.reporter}</span>}
                    <span className="ml-auto text-[#ADB5BD] tabular-nums">{short(a.kst)}</span>
                  </div>
                  <p className="pl-[26px] text-[13px] text-[#212529] leading-snug line-clamp-2">{a.title}</p>
                </a>
              ))}
            </div>
          </Section>

          <p className="mt-4 text-[11px] text-[#ADB5BD] leading-relaxed">
            수집된 뉴스 중 보도자료 판별과 같은 기준(36시간 안, 제목 핵심어 공유)으로 묶인 기사입니다. 제목을 크게 바꾼 기사나 수집되지 않은 매체는 빠질 수 있습니다.
          </p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="p-3 rounded-2xl border border-[#F1F3F5] bg-white">
      <p className="text-[11px] text-[#868E96]">{label}</p>
      <p className={`mt-0.5 text-[15px] font-bold tabular-nums ${warn ? "text-[#E5484D]" : "text-[#25282B]"}`}>{value}</p>
      {sub && <p className="text-[11px] text-[#ADB5BD] truncate">{sub}</p>}
    </div>
  );
}

function Section({ title, sub, action, children }: { title: string; sub?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline gap-2 mb-3">
        <h2 className="text-[14px] font-bold text-[#25282B]">{title}</h2>
        {sub && <span className="text-[11px] text-[#ADB5BD]">{sub}</span>}
        {action && <span className="ml-auto">{action}</span>}
      </div>
      {children}
    </section>
  );
}

// 최근 보도자료별 기사 수 — 이 건만 주황, 나머지 회색, 평균선
function PeerBars({ peers, current, avg }: { peers: Peer[]; current: number; avg: number }) {
  const router = useRouter();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...peers.map((p) => p.articles));
  const H = 110;
  const n = peers.length;
  const hp = hover !== null ? peers[hover] : null;
  return (
    <div className="relative select-none">
      <div className="relative flex items-end gap-[2px]" style={{ height: H }} onMouseLeave={() => setHover(null)}>
        <div className="pointer-events-none absolute left-0 right-0 z-10 border-t border-dashed border-[#868E96]" style={{ bottom: (avg / max) * H }}>
          <span className="absolute left-0 -top-[9px] px-1 bg-white text-[10px] leading-[16px] text-[#868E96] z-10">평균 {avg}건</span>
        </div>
        {peers.map((p, i) => {
          const me = p.id === current;
          return (
            <button
              key={p.id}
              onMouseEnter={() => setHover(i)}
              onClick={() => !me && router.push(`/release-report/${p.id}`)}
              aria-label={`${p.title} ${p.articles}건`}
              className="relative flex-1 min-w-0 h-full flex items-end justify-center"
            >
              <div
                className="w-full rounded-t-[3px]"
                style={{ maxWidth: 14, height: Math.max(2, (p.articles / max) * H), background: me ? "#F26522" : hover === i ? "#868E96" : "#DEE2E6" }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[10px] text-[#ADB5BD]">
        <span>{md(peers[0].d)}</span>
        <span>{md(peers[n - 1].d)}</span>
      </div>
      {hp && (
        <div
          className="pointer-events-none absolute z-20 w-[200px] p-2.5 rounded-xl bg-white shadow-[0_6px_20px_rgba(0,0,0,0.12)] border border-[#EEF0F2] text-[11px]"
          style={hover! / n > 0.5 ? { top: 0, right: `calc(${((n - hover! - 0.5) / n) * 100}% + 10px)` } : { top: 0, left: `calc(${((hover! + 0.5) / n) * 100}% + 10px)` }}
        >
          <p className="text-[#ADB5BD]">{hp.d.replace(/-/g, ".")} · <b className="text-[#25282B]">{hp.articles}건</b></p>
          <p className="mt-0.5 text-[#343A40] line-clamp-2">{hp.title}</p>
        </div>
      )}
      <div className="flex items-center gap-3 mt-2 text-[11px] text-[#868E96]">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#F26522]" />이 보도자료</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#DEE2E6]" />다른 보도자료</span>
        <span className="text-[#ADB5BD]">· 막대를 누르면 그 보도자료 리포트로</span>
      </div>
    </div>
  );
}

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mclahufkvvhhknumgkpg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1jbGFodWZrdnZoaGtudW1na3BnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3MTI5OTAsImV4cCI6MjA4OTI4ODk5MH0.2TVwKfEewTQ399v9MSim7VVI74EsjlhS3cB7JMmPn_4";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const RELEASES = [
  {
    title: "OK금융그룹 최윤 회장, 2026년 신년사 금융으로 서민 삶의 질 향상",
    release_type: "인사",
    subsidiary: "OK금융그룹",
    published_date: "2026-01-02T09:00:00+09:00",
    status: "published",
    content: "OK금융그룹 최윤 회장은 2일 신년사를 통해 올해는 AI 기반 금융 서비스 혁신과 서민 금융 지원 확대에 집중할 것이라고 밝혔다. 최 회장은 OK금융그룹은 창립 이래 서민들의 금융 접근성을 높이는 데 전력해왔으며 2026년에도 이 사명을 더욱 강화해 나가겠다고 강조했다. 또한 디지털 전환과 ESG 경영을 통해 지속 가능한 성장을 추구하겠다고 덧붙였다.",
    source_url: "https://www.okfinancialgroup.com/newsroom/2026/01/02/",
  },
  {
    title: "OK금융그룹 최윤 회장, 중소벤처기업부 장관 면담 서민금융 협력 방안 논의",
    release_type: "제휴",
    subsidiary: "OK금융그룹",
    published_date: "2026-01-15T10:30:00+09:00",
    status: "published",
    content: "OK금융그룹 최윤 회장은 15일 중소벤처기업부 장관과 면담을 갖고 서민 금융 지원 확대 및 소상공인 자금 지원 협력 방안을 논의했다. 이번 면담에서 최 회장은 OK저축은행의 소상공인 전용 금융상품 확대 계획을 소개하고 정부의 서민 금융 정책과의 연계 강화를 제안했다.",
    source_url: "https://www.okfinancialgroup.com/newsroom/2026/01/15/",
  },
  {
    title: "최윤 OK금융그룹 회장, CEO 사회공헌대상 수상",
    release_type: "수상",
    subsidiary: "OK금융그룹",
    published_date: "2026-02-10T14:00:00+09:00",
    status: "published",
    content: "OK금융그룹 최윤 회장이 10일 한국사회공헌협의회 주관 2026 CEO 사회공헌대상을 수상했다. 이 상은 서민 금융 접근성 확대와 금융 소외계층 지원에 기여한 공로를 인정받아 수여됐다. 최 회장은 수상 소감에서 금융이 모든 국민에게 공평한 기회를 제공해야 한다는 신념으로 경영해왔다고 말했다.",
    source_url: "https://www.okfinancialgroup.com/newsroom/2026/02/10/",
  },
  {
    title: "OK금융그룹 최윤 회장, ESG위원회 출범식 참석 지속가능경영 최우선 과제",
    release_type: "ESG",
    subsidiary: "OK금융그룹",
    published_date: "2026-02-20T11:00:00+09:00",
    status: "published",
    content: "OK금융그룹 최윤 회장은 20일 그룹 ESG위원회 출범식에 참석해 지속가능경영은 단기 수익보다 중요한 최우선 과제라고 강조했다. OK금융그룹은 2026년부터 그룹 전체 ESG 전략을 통합 관리하는 ESG위원회를 신설하고 2030년까지 탄소중립 달성과 사회적 가치 창출을 목표로 설정했다.",
    source_url: "https://www.okfinancialgroup.com/newsroom/2026/02/20/",
  },
  {
    title: "OK금융그룹 최윤 회장, 핀테크 스타트업 투자 협약 체결 디지털 금융 혁신 가속",
    release_type: "제휴",
    subsidiary: "OK금융그룹",
    published_date: "2026-03-05T10:00:00+09:00",
    status: "published",
    content: "OK금융그룹 최윤 회장은 5일 국내 주요 핀테크 스타트업 3개사와 전략적 투자 협약을 체결하고 디지털 금융 혁신 협력을 본격화했다. 이번 협약을 통해 AI 기반 신용평가, 자동화 대출 심사, 금융 데이터 분석 분야에서 협력할 예정이다. 최 회장은 디지털 혁신은 선택이 아닌 필수라며 스타트업과의 협업으로 서비스 품질을 혁신적으로 개선하겠다고 밝혔다.",
    source_url: "https://www.okfinancialgroup.com/newsroom/2026/03/05/",
  },
  {
    title: "OK저축은행 2025년 연간 실적 발표 당기순이익 전년 대비 12% 성장",
    release_type: "실적발표",
    subsidiary: "OK저축은행",
    published_date: "2026-02-14T10:00:00+09:00",
    status: "published",
    content: "OK저축은행은 14일 2025년 연간 경영실적을 발표했다. 2025년 당기순이익은 전년 대비 12% 성장했으며 총자산은 25조원을 돌파했다. 연체율은 전년 대비 개선됐으며 BIS자기자본비율은 금융당국 권고 기준을 상회했다. 건전성 지표 전반이 개선되는 가운데 서민 금융 공급 규모도 확대됐다.",
    source_url: "https://www.okfinancialgroup.com/newsroom/2026/02/14/",
  },
  {
    title: "OK저축은행 2026 서민금융 우수기관 선정 금융위원회 표창 수상",
    release_type: "수상",
    subsidiary: "OK저축은행",
    published_date: "2026-01-22T14:00:00+09:00",
    status: "published",
    content: "OK저축은행이 22일 금융위원회로부터 2026 서민금융 우수기관으로 선정돼 표창을 수상했다. 서민 금융 접근성 확대, 금리 인하, 취약계층 맞춤형 상품 제공 등에서 탁월한 성과를 인정받았다.",
    source_url: "https://www.okfinancialgroup.com/newsroom/2026/01/22/",
  },
  {
    title: "OK캐피탈, AI 기반 자동차금융 플랫폼 OK드라이브 론칭 심사 시간 80% 단축",
    release_type: "신상품",
    subsidiary: "OK캐피탈",
    published_date: "2026-01-28T10:00:00+09:00",
    status: "published",
    content: "OK캐피탈은 28일 AI 기반 자동차금융 플랫폼 OK드라이브를 정식 론칭했다. AI 자동 심사 시스템 도입으로 대출 심사 시간을 기존 대비 80% 단축했으며 24시간 자동 승인 서비스를 제공한다. OK캐피탈은 비대면 자동차금융 분야 선두주자로 도약하겠다고 밝혔다.",
    source_url: "https://www.okfinancialgroup.com/newsroom/2026/01/28/",
  },
  {
    title: "OK금융그룹 2026년 상반기 공채 실시 신입사원 200명 채용",
    release_type: "인사",
    subsidiary: "OK금융그룹",
    published_date: "2026-03-10T09:00:00+09:00",
    status: "published",
    content: "OK금융그룹은 10일 2026년 상반기 신입사원 공개채용을 실시한다고 밝혔다. 이번 채용에서는 디지털금융, AI, 데이터분석 등 미래 금융 핵심 직군을 중심으로 200명을 선발할 예정이다. 서류전형부터 최종 면접까지 AI 기반 블라인드 채용 방식을 도입해 공정성을 높였다.",
    source_url: "https://www.okfinancialgroup.com/newsroom/2026/03/10/",
  },
  {
    title: "OK금융그룹 지역 청소년 금융교육 OK머니스쿨 전국 100개 학교 확대",
    release_type: "ESG",
    subsidiary: "OK금융그룹",
    published_date: "2026-03-15T10:00:00+09:00",
    status: "published",
    content: "OK금융그룹은 15일 청소년 금융교육 프로그램 OK머니스쿨을 전국 17개 시도 100개 학교로 확대 실시한다고 밝혔다. 최윤 회장이 직접 발의해 추진해온 이 프로그램은 저축, 투자, 부채 관리 등 실생활 금융 교육을 제공하며 올해부터 취약계층 청소년을 대상으로 장학금도 지원한다.",
    source_url: "https://www.okfinancialgroup.com/newsroom/2026/03/15/",
  },
];

async function insertReleases() {
  console.log("Inserting " + RELEASES.length + " press releases...");

  const { data: existing } = await supabase
    .from("press_releases")
    .select("title");

  const existingTitles = new Set((existing || []).map(r => r.title));

  let inserted = 0;
  let skipped = 0;

  for (const release of RELEASES) {
    if (existingTitles.has(release.title)) {
      console.log("SKIP (duplicate): " + release.title);
      skipped++;
      continue;
    }

    const { error } = await supabase.from("press_releases").insert(release);
    if (error) {
      console.error("ERROR: " + release.title, error.message);
    } else {
      console.log("OK: " + release.title);
      inserted++;
    }
  }

  console.log("\nDone: " + inserted + " inserted, " + skipped + " skipped");
}

insertReleases().catch(console.error);

// 경영공시 종류 — OK저축은행 홈페이지 게시판 주소 (링크가 비어 있는 등록 건은 여기로 연결)
export type DisclosureKind = "suisi" | "summary" | "result";

export const DISCLOSURE_BOARDS: { id: DisclosureKind; label: string; url: string; desc: string }[] = [
  {
    id: "suisi",
    label: "수시공시",
    url: "https://www.oksavingsbank.com/#/bankMngmAntm?menuCd=00354",
    desc: "경영 관련 주요 사항 수시 공시",
  },
  {
    id: "summary",
    label: "요약공시",
    url: "https://www.oksavingsbank.com/#/bankMngmSmryBsns?menuCd=00352",
    desc: "영업현황, 재무현황, 손익현황 요약",
  },
  {
    id: "result",
    label: "결산/가결산공시",
    url: "https://www.oksavingsbank.com/#/bankMngmStac?menuCd=00353",
    desc: "결산·가결산 공시 내역",
  },
];

export interface DisclosureTable {
  name: string;
  unit: string;
  period?: string;
  headers: string[];
  rows: string[][];
  note?: string;
}

export interface DisclosureTableData {
  base_date: string;
  note?: string;
  tables: DisclosureTable[];
}

export interface DisclosureItem {
  id: number;
  kind: DisclosureKind;
  title: string;
  disclosed_date: string;
  url: string | null;
  has_table?: boolean;
  table_data?: DisclosureTableData | null;
}

export const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

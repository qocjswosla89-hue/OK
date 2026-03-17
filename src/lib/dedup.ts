/**
 * 보도자료 중복 판단 모듈
 *
 * 규칙: 1주일(7일) 이내, 본문 유사도 80% 이상이면 동일 보도자료로 판단
 */

const SIMILARITY_THRESHOLD = 0.8;
const DEDUP_WINDOW_DAYS = 7;

/**
 * 두 문자열의 유사도를 계산 (0~1)
 * SequenceMatcher 방식: 공통 부분 문자열 길이 기반
 */
export function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;

  // 전처리: 공백 정규화, 소문자
  const normalize = (s: string) =>
    s.replace(/\s+/g, " ").trim().toLowerCase();
  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1;

  // bigram 기반 유사도 (Dice coefficient) - 빠르고 효과적
  const bigrams = (s: string): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.slice(i, i + 2));
    }
    return set;
  };

  const aBigrams = bigrams(na);
  const bBigrams = bigrams(nb);

  let intersection = 0;
  for (const bg of aBigrams) {
    if (bBigrams.has(bg)) intersection++;
  }

  return (2 * intersection) / (aBigrams.size + bBigrams.size);
}

/**
 * 날짜가 기준일로부터 7일 이내인지 확인
 */
export function isWithinWindow(
  dateA: string | Date,
  dateB: string | Date
): boolean {
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  const diffMs = Math.abs(a - b);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= DEDUP_WINDOW_DAYS;
}

export interface PressReleaseItem {
  id: string | number;
  title: string;
  content: string;
  date: string;
  sourceUrl?: string;
}

export interface DuplicateGroup {
  original: PressReleaseItem;
  duplicates: { item: PressReleaseItem; similarity: number }[];
}

/**
 * 보도자료 목록에서 중복 그룹을 찾아 반환
 */
export function findDuplicates(
  items: PressReleaseItem[]
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string | number>();

  for (let i = 0; i < items.length; i++) {
    if (processed.has(items[i].id)) continue;

    const group: DuplicateGroup = {
      original: items[i],
      duplicates: [],
    };

    for (let j = i + 1; j < items.length; j++) {
      if (processed.has(items[j].id)) continue;

      // 1주일 이내인지 확인
      if (!isWithinWindow(items[i].date, items[j].date)) continue;

      // 유사도 계산
      const sim = similarity(items[i].content, items[j].content);

      if (sim >= SIMILARITY_THRESHOLD) {
        group.duplicates.push({ item: items[j], similarity: sim });
        processed.add(items[j].id);
      }
    }

    if (group.duplicates.length > 0) {
      groups.push(group);
      processed.add(items[i].id);
    }
  }

  return groups;
}

/**
 * 새 보도자료가 기존 목록과 중복인지 확인
 */
export function checkDuplicate(
  newItem: PressReleaseItem,
  existingItems: PressReleaseItem[]
): { isDuplicate: boolean; match?: PressReleaseItem; similarity: number } {
  for (const existing of existingItems) {
    if (!isWithinWindow(newItem.date, existing.date)) continue;

    const sim = similarity(newItem.content, existing.content);
    if (sim >= SIMILARITY_THRESHOLD) {
      return { isDuplicate: true, match: existing, similarity: sim };
    }
  }

  return { isDuplicate: false, similarity: 0 };
}

export type UnderstandingValue = "UNDERSTOOD" | "NOT_UNDERSTOOD";

export function distinctVisitedPages(visits: Array<{ page: number }>) {
  return [...new Set(visits.map((visit) => visit.page).filter((page) => Number.isInteger(page) && page > 0))].sort((a, b) => a - b);
}

export function completionPercent(visitedCount: number, pageCount: number | null | undefined) {
  if (!pageCount || pageCount <= 0) return null;
  return Math.min(100, Math.round((visitedCount / pageCount) * 100));
}

export function pageListLabel(pages: number[]) {
  if (pages.length === 0) return "—";
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const groups: string[] = [];
  let start = sorted[0];
  let previous = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const current = sorted[i];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    groups.push(start === previous ? `P.${start}` : `P.${start}–P.${previous}`);
    start = current;
    previous = current;
  }
  return groups.join("、");
}

export function understandingLabel(value: UnderstandingValue) {
  return value === "UNDERSTOOD" ? "我懂了" : "我不懂";
}

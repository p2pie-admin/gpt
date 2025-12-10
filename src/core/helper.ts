export type ClasterRow = Record<string, any>;
export type GroupedClasters = Record<string, ClasterRow[]>;

/**
 * Group rows by their `claster` (or `cluster`) field and remove that field from the grouped entries.
 * Rows without a claster are skipped.
 */
export function groupByClaster(rows: ClasterRow[]): GroupedClasters {
  return rows.reduce<GroupedClasters>((acc, row) => {
    const claster = row.claster ?? row.cluster;
    if (claster === undefined || claster === null) return acc;

    const { claster: _c, cluster: _cl, ...rest } = row;
    const key = String(claster);
    if (!acc[key]) acc[key] = [];
    acc[key].push(rest);
    return acc;
  }, {});
}

/**
 * Enrich grouped clasters with computed "value" and sort each group descending by it.
 * value = (wordstat * commercial ** 2) / (difficultyTop + 1) ** 3
 */

function calcValue(
  wordstat: number,
  commercial: number,
  difficultyTop: number,
  length: number
) {
  const C = 10000; // просто для масштабирования, можно =1

  const volume = Math.log(1 + wordstat * 1.2); // ln(1 + wordstat)
  const commercialFactor = 0.9 + 0.03 * commercial; // 0.9–1.3
  const difficultyPenalty = Math.exp(0.4 * difficultyTop); // e^(2*d)

  const value = (C * volume * commercialFactor) / difficultyPenalty;

  return Math.round(value / (length + 15));
}
export function addValueAndSort(grouped: GroupedClasters): GroupedClasters {
  const result: GroupedClasters = {};
  Object.entries(grouped).forEach(([key, rows]) => {
    const enriched = rows.map((row: any) => {
      const wordstat = Number(row.wordstat) || 0;
      const commercial = Number(row.commercial) || 0;
      const difficultyTop = Number(row.difficultyTop) || 0;
      const length = Number(row.request.length) || 0;
      const value = calcValue(wordstat, commercial, difficultyTop, length);
      return { ...row, value };
    });
    const cutOutLowWordstat = enriched.filter(
      (row) => (row.wordstat ?? 0) >= 10 + enriched.length / 2
    );

    const filtered = cutOutLowWordstat
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      .filter((row) => (row.value ?? 0) >= 100)
      .slice(0, 15);

    if (!cutOutLowWordstat?.[0]) return;
    result[key] = filtered.length ? filtered : [cutOutLowWordstat?.[0]]; // оставляем хоть один элемент
  });
  return result;
}

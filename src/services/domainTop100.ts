import { promises as fs } from "fs";
import path from "path";
import dotenv from "dotenv";
import OpenAI from "openai";

type DomainStatus = "available" | "taken" | "unknown" | "error";

type DomainResult = {
  domain: string;
  status: DomainStatus;
  checkedAt: string;
  details?: string;
};

type DomainState = {
  checked: Record<string, DomainResult>;
  history: DomainResult[];
  updatedAt: string;
};

const RESULTS_FILE = path.resolve(
  process.cwd(),
  "some_data/domains/domain_checks.json"
);

const BATCH_SIZE = 20;
const TARGET_TOP = 100;
const PROMPT_PREFIX =
  "Find the most valuable domain name among this list. Return only one of them as a single string with .com in the end";

dotenv.config();
const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;
if (!OPENAI_API_KEY) {
  throw new Error("OpenAI API key is missing. Please set OPENAI_API_KEY in .env.");
}
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

function normalizeDomain(value: string): string | null {
  const raw = value.trim().toLowerCase();
  const domain = raw.endsWith(".com") ? raw : `${raw}.com`;
  if (!/^[a-z0-9-]{2,30}\.com$/.test(domain)) {
    return null;
  }
  return domain;
}

function chunk<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    output.push(items.slice(i, i + size));
  }
  return output;
}

function sortByScoreThenName(
  a: string,
  b: string,
  scores: Map<string, number>
): number {
  const scoreDiff = (scores.get(b) ?? 0) - (scores.get(a) ?? 0);
  if (scoreDiff !== 0) {
    return scoreDiff;
  }
  return a.length - b.length || a.localeCompare(b);
}

async function readAvailableDomains(): Promise<string[]> {
  const content = await fs.readFile(RESULTS_FILE, "utf8");
  const parsed = JSON.parse(content) as DomainState;

  const set = new Set<string>();
  for (const item of Object.values(parsed.checked || {})) {
    if (item.status === "available") {
      const normalized = normalizeDomain(item.domain);
      if (normalized) {
        set.add(normalized);
      }
    }
  }

  return [...set];
}

async function pickBestFromBatch(
  domains: string[],
  round: number,
  batchIndex: number
): Promise<string | null> {
  const prompt = `${PROMPT_PREFIX}\n\n${domains.join("\n")}`;
  let response: string | null = null;
  const id = `domain_top_${round}_${batchIndex}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
      });

      const content = completion.choices?.[0]?.message?.content?.trim();
      if (content) {
        response = content;
        break;
      }
    } catch (error) {
      if (attempt === 3) {
        console.log(`[domain_top100] ${id} failed after 3 attempts`);
      }
    }
  }

  if (!response) {
    return null;
  }

  const direct = normalizeDomain(response);
  if (direct && domains.includes(direct)) {
    return direct;
  }

  const firstToken = response
    .split(/\s+/)
    .map((part) => part.trim())
    .find((part) => part.includes(".com"));

  const fromToken = firstToken
    ? normalizeDomain(firstToken.replace(/[^a-z0-9.-]/gi, ""))
    : null;
  if (fromToken && domains.includes(fromToken)) {
    return fromToken;
  }

  const lowered = response.toLowerCase();
  const fromContains = domains.find((domain) => lowered.includes(domain));
  return fromContains || null;
}

export async function runDomainTop100Service() {
  const available = await readAvailableDomains();

  if (available.length === 0) {
    console.log("[domain_top100] no available domains in domain_checks.json");
    return {
      sourceCount: 0,
      resultCount: 0,
      topDomains: [] as string[],
    };
  }

  if (available.length <= TARGET_TOP) {
    const ready = [...available].sort(
      (a, b) => a.length - b.length || a.localeCompare(b)
    );
    console.log(
      `[domain_top100] source has ${available.length} domains (<= ${TARGET_TOP}), returning as is`
    );
    console.log("[domain_top100] final top domains:");
    for (const domain of ready) {
      console.log(domain);
    }

    return {
      sourceCount: available.length,
      resultCount: ready.length,
      topDomains: ready,
    };
  }

  let pool = [...available];
  let round = 1;
  const scores = new Map<string, number>();

  while (pool.length > TARGET_TOP) {
    const groups = chunk(pool, BATCH_SIZE);
    const winners: string[] = [];

    for (let i = 0; i < groups.length; i += 1) {
      const batch = groups[i];
      const best = await pickBestFromBatch(batch, round, i + 1);
      const selected = best || batch[0];

      winners.push(selected);
      scores.set(selected, (scores.get(selected) ?? 0) + 1);

      const leftInRound = Math.max(
        0,
        pool.length - Math.min((i + 1) * BATCH_SIZE, pool.length)
      );
      console.log(
        `[domain_top100] round=${round} batch=${i + 1}/${groups.length} left=${leftInRound}`
      );
    }

    const dedupWinners = [...new Set(winners)];

    if (dedupWinners.length === pool.length) {
      break;
    }

    if (dedupWinners.length < TARGET_TOP) {
      const ranked = [...new Set(pool)].sort((a, b) =>
        sortByScoreThenName(a, b, scores)
      );
      const kept = [...dedupWinners];

      for (const domain of ranked) {
        if (kept.length >= TARGET_TOP) {
          break;
        }
        if (!kept.includes(domain)) {
          kept.push(domain);
        }
      }

      pool = kept;
      break;
    }

    pool = dedupWinners;
    round += 1;
  }

  const finalTop = [...new Set(pool)]
    .sort((a, b) => sortByScoreThenName(a, b, scores))
    .slice(0, TARGET_TOP);

  console.log("[domain_top100] final top domains:");
  for (const domain of finalTop) {
    console.log(domain);
  }

  return {
    sourceCount: available.length,
    resultCount: finalTop.length,
    topDomains: finalTop,
  };
}

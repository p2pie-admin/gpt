import { promises as fs } from "fs";
import path from "path";
import net from "net";

const CANDIDATES_FILE = path.resolve(
  process.cwd(),
  "some_data/domains/domain_candidates.txt"
);
const RESULTS_FILE = path.resolve(
  process.cwd(),
  "some_data/domains/domain_checks.json"
);

const WHOIS_HOST = "whois.verisign-grs.com";
const WHOIS_PORT = 43;

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

function normalizeDomain(raw: string): string | null {
  const line = raw.trim().toLowerCase();
  if (!line || line.startsWith("#")) {
    return null;
  }

  const withoutTld = line.endsWith(".com") ? line.slice(0, -4) : line;
  if (!/^[a-z0-9-]{2,12}$/.test(withoutTld)) {
    return null;
  }

  return `${withoutTld}.com`;
}

async function readCandidates(): Promise<string[]> {
  const content = await fs.readFile(CANDIDATES_FILE, "utf8");
  const unique = new Set<string>();

  for (const line of content.split(/\r?\n/)) {
    const normalized = normalizeDomain(line);
    if (normalized) {
      unique.add(normalized);
    }
  }

  return [...unique];
}

async function readState(): Promise<DomainState> {
  try {
    const content = await fs.readFile(RESULTS_FILE, "utf8");
    const parsed = JSON.parse(content) as DomainState;

    return {
      checked: parsed.checked || {},
      history: parsed.history || [],
      updatedAt: parsed.updatedAt || new Date(0).toISOString(),
    };
  } catch {
    return {
      checked: {},
      history: [],
      updatedAt: new Date(0).toISOString(),
    };
  }
}

async function writeState(state: DomainState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await fs.writeFile(RESULTS_FILE, JSON.stringify(state, null, 2), "utf8");
}

function whoisQuery(domain: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = net.createConnection({ host: WHOIS_HOST, port: WHOIS_PORT });
    let data = "";

    client.setTimeout(10000);

    client.on("connect", () => {
      client.write(`${domain}\r\n`);
    });

    client.on("data", (chunk: Buffer) => {
      data += chunk.toString("utf8");
    });

    client.on("timeout", () => {
      client.destroy(new Error("WHOIS timeout"));
    });

    client.on("error", (error) => {
      reject(error);
    });

    client.on("end", () => {
      resolve(data);
    });
  });
}

async function checkDomain(domain: string): Promise<DomainResult> {
  const checkedAt = new Date().toISOString();

  try {
    const raw = await whoisQuery(domain);
    const upper = raw.toUpperCase();
    const domainUpper = domain.toUpperCase();

    if (upper.includes(`NO MATCH FOR "${domainUpper}"`)) {
      return { domain, status: "available", checkedAt };
    }

    if (upper.includes(`DOMAIN NAME: ${domainUpper}`)) {
      return { domain, status: "taken", checkedAt };
    }

    return {
      domain,
      status: "unknown",
      checkedAt,
      details: "WHOIS response requires manual verification",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      domain,
      status: "error",
      checkedAt,
      details: message,
    };
  }
}

type RunOptions = {
  limit?: number;
  saveEvery?: number;
  progressEvery?: number;
  onProgress?: (snapshot: {
    processedInRun: number;
    totalChecked: number;
    remaining: number;
    availableDomains: string[];
  }) => void;
};

function sortByLengthThenName(values: string[]): string[] {
  return [...values].sort((a, b) => a.length - b.length || a.localeCompare(b));
}

export async function getAvailableDomains(): Promise<string[]> {
  const state = await readState();
  const domains = Object.values(state.checked)
    .filter((item) => item.status === "available")
    .map((item) => item.domain);

  return sortByLengthThenName(domains);
}

export async function runDomainCheckService(options: RunOptions = {}) {
  const explicitLimit =
    typeof options.limit === "number" && Number.isFinite(options.limit)
      ? Math.max(1, Math.floor(options.limit))
      : undefined;
  const saveEvery = Math.max(1, options.saveEvery ?? 5);
  const progressEvery = Math.max(1, options.progressEvery ?? 10);

  const [candidates, state] = await Promise.all([readCandidates(), readState()]);
  const allowed = new Set(candidates);
  const checkedBefore = Object.keys(state.checked).length;
  const historyBefore = state.history.length;

  // Keep checks strictly in sync with current candidates list.
  for (const domain of Object.keys(state.checked)) {
    if (!allowed.has(domain)) {
      delete state.checked[domain];
    }
  }
  state.history = state.history.filter((item) => allowed.has(item.domain));
  const stateSanitized =
    Object.keys(state.checked).length !== checkedBefore ||
    state.history.length !== historyBefore;

  const pending = candidates.filter((domain) => !state.checked[domain]);
  const toProcess = explicitLimit ? pending.slice(0, explicitLimit) : pending;

  const batchResults: DomainResult[] = [];

  for (let i = 0; i < toProcess.length; i += 1) {
    const domain = toProcess[i];
    const result = await checkDomain(domain);

    state.checked[domain] = result;
    state.history.push(result);
    batchResults.push(result);

    if ((i + 1) % progressEvery === 0) {
      const availableDomains = sortByLengthThenName(
        Object.values(state.checked)
          .filter((item) => item.status === "available")
          .map((item) => item.domain)
      );
      options.onProgress?.({
        processedInRun: i + 1,
        totalChecked: Object.keys(state.checked).length,
        remaining: Math.max(0, pending.length - (i + 1)),
        availableDomains,
      });
    }

    if ((i + 1) % saveEvery === 0) {
      await writeState(state);
    }
  }

  if (batchResults.length > 0 || stateSanitized) {
    await writeState(state);
  }

  const allChecked = Object.values(state.checked);
  const availableTotal = allChecked.filter((item) => item.status === "available");

  return {
    totalCandidates: candidates.length,
    alreadyChecked: candidates.length - pending.length,
    checkedTotal: allChecked.length,
    processedNow: batchResults.length,
    remaining: Math.max(0, pending.length - batchResults.length),
    availableNow: batchResults.filter((item) => item.status === "available"),
    availableTotal,
    latest: batchResults,
    resultsFile: RESULTS_FILE,
    candidatesFile: CANDIDATES_FILE,
  };
}

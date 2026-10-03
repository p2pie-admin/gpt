import dotenv from "dotenv";
import axios from "axios";
import { callGPT } from "../services/gpt";
import { delay, mylog, saveProgress } from "../helper";

dotenv.config();

const FOURSQUARE_API_KEY = process.env.FOURSQUARE_API_KEY as string;
const FOURSQUARE_API_BASE =
  process.env.FOURSQUARE_API_BASE || "https://api.foursquare.com/v3";
const FOURSQUARE_API_VERSION = process.env.FOURSQUARE_API_VERSION || "";
const FOURSQUARE_API_KEY_HEADER =
  process.env.FOURSQUARE_API_KEY_HEADER || "Authorization";
const FOURSQUARE_AUTH_SCHEME = process.env.FOURSQUARE_AUTH_SCHEME || "";
const LAT = Number(process.env.LAT);
const LONG = Number(process.env.LONG);
const RADIUS_METERS = Number(process.env.RADIUS_METERS || 5000);
const OUTPUT_PATH = process.env.MAPS_BUSINESS_OUTPUT || "maps-business.json";
const GPT_MODEL = process.env.MAPS_BUSINESS_MODEL || "gpt-4o-mini";
const GPT_BATCH_SIZE = Number(process.env.MAPS_BUSINESS_BATCH || 8);
const DISABLE_GPT = process.env.MAPS_BUSINESS_DISABLE_GPT === "true";
const SEARCH_LIMIT = Number(process.env.FOURSQUARE_LIMIT || 50);
const CATEGORY_FILTER = process.env.FOURSQUARE_CATEGORIES || "";
const RAW_QUERIES = process.env.FOURSQUARE_QUERIES || "";
const NEAR = process.env.FOURSQUARE_NEAR || "";
const SEARCH_FIELDS = process.env.FOURSQUARE_SEARCH_FIELDS || "";
const SEARCH_SORT = process.env.FOURSQUARE_SORT || "RELEVANCE";
const EXCLUDE_CHAINS = process.env.FOURSQUARE_EXCLUDE_CHAINS === "true";
const DEBUG_RESPONSE = process.env.FOURSQUARE_DEBUG === "true";
const DETAILS_FIELDS = process.env.FOURSQUARE_DETAILS_FIELDS || "";

type FsqCategory = {
  id?: number;
  name?: string;
};

type FsqSearchPlace = {
  fsq_id?: string;
  fsq_place_id?: string;
  name: string;
  location?: {
    formatted_address?: string;
  };
  categories?: FsqCategory[];
  chains?: { id?: string; name?: string }[];
};

type FsqDetails = {
  fsq_id?: string;
  fsq_place_id?: string;
  name: string;
  location?: {
    formatted_address?: string;
  };
  categories?: FsqCategory[];
  website?: string;
  tel?: string;
  email?: string;
  social_media?: Record<string, string>;
  chains?: { id?: string; name?: string }[];
};

type LeadRecord = {
  fsq_id: string;
  name: string;
  address?: string;
  categories?: string[];
  website?: string;
  phone?: string;
  email?: string;
  social?: Record<string, string>;
  needs_website_or_automation: boolean;
  need_score: number;
  reason: string;
};

type GptResult = {
  fsq_id: string;
  needs_website_or_automation: boolean;
  reason?: string;
  need_score?: number;
};

const DEFAULT_QUERIES = [
  "hair salon",
  "nail salon",
  "spa",
  "barber",
  "dentist",
  "dental clinic",
  "medical clinic",
  "doctor",
  "lawyer",
  "notary",
  "accountant",
  "tax services",
  "plumber",
  "hvac",
  "electrician",
  "cleaning service",
  "moving company",
  "handyman",
  "auto repair",
  "car detailing",
  "body shop",
  "restaurant",
  "cafe",
  "takeout",
  "delivery",
  "tutoring",
  "daycare",
  "private school",
  "real estate agent",
  "mortgage broker",
];

const SITE_BUILDER_HINTS = [
  "wixsite.com",
  "squarespace.com",
  "tilda",
  "webflow",
  "weebly",
  "yolasite.com",
];

const normalizeQueries = () => {
  if (!RAW_QUERIES.trim()) return DEFAULT_QUERIES;
  return RAW_QUERIES.split(";")
    .map((value) => value.trim())
    .filter(Boolean);
};

const validateEnv = () => {
  if (!FOURSQUARE_API_KEY) {
    throw new Error("FOURSQUARE_API_KEY is missing in .env");
  }
  if (!Number.isFinite(LAT) || !Number.isFinite(LONG)) {
    throw new Error("LAT/LONG must be valid numbers in .env");
  }
};

const buildFsqHeaders = () => {
  const value = FOURSQUARE_AUTH_SCHEME
    ? `${FOURSQUARE_AUTH_SCHEME} ${FOURSQUARE_API_KEY}`
    : FOURSQUARE_API_KEY;
  const headers: Record<string, string> = {
    Accept: "application/json",
    [FOURSQUARE_API_KEY_HEADER]: value,
  };
  if (FOURSQUARE_API_VERSION) {
    headers["X-Places-Api-Version"] = FOURSQUARE_API_VERSION;
  }
  return headers;
};

const fetchSearchPage = async (query: string, cursor?: string) => {
  try {
    const { data } = await axios.get(`${FOURSQUARE_API_BASE}/places/search`, {
      headers: buildFsqHeaders(),
      params: {
        ...(NEAR
          ? { near: NEAR }
          : { ll: `${LAT},${LONG}`, radius: RADIUS_METERS }),
        query,
        limit: SEARCH_LIMIT,
        categories: CATEGORY_FILTER || undefined,
        fields: SEARCH_FIELDS || undefined,
        sort: SEARCH_SORT,
        exclude_all_chains: EXCLUDE_CHAINS || undefined,
        cursor,
      },
      timeout: 15000,
    });

    if (DEBUG_RESPONSE && !data?.results?.length) {
      mylog(`Search "${query}" debug: ${JSON.stringify(data)}`, "warning");
    }

    return data as {
      results: FsqSearchPlace[];
      context?: { next_cursor?: string; next?: string };
      next_cursor?: string;
    };
  } catch (error: any) {
    const status = error?.response?.status;
    const body = error?.response?.data;
    mylog(
      `Search "${query}" failed (${status || "no status"}): ${
        body ? JSON.stringify(body) : error?.message || "unknown error"
      }`,
      "error"
    );
    throw error;
  }
};

const fetchPlacesByQuery = async (query: string): Promise<FsqSearchPlace[]> => {
  const all: FsqSearchPlace[] = [];
  let cursor: string | undefined;
  let page = 1;

  do {
    const data = await fetchSearchPage(query, cursor);
    const results = (data?.results || []).filter(
      (p) => (p?.fsq_id || p?.fsq_place_id) && p?.name
    );
    mylog(`Search "${query}" page ${page}: ${results.length} places`, "info");
    all.push(...results);
    cursor =
      data?.context?.next_cursor || data?.next_cursor || data?.context?.next;
    page += 1;
    if (cursor) await delay(1200);
  } while (cursor);

  return all;
};

const fetchPlaceDetails = async (fsqId: string): Promise<FsqDetails | null> => {
  try {
    const { data } = await axios.get(
      `${FOURSQUARE_API_BASE}/places/${fsqId}`,
      {
        headers: buildFsqHeaders(),
        params: {
          fields: DETAILS_FIELDS || undefined,
        },
        timeout: 15000,
      }
    );
    return data as FsqDetails;
  } catch (error: any) {
    const status = error?.response?.status;
    const body = error?.response?.data;
    if (error?.response?.status === 401) {
      mylog(
        "Foursquare 401: invalid token. Use a Places API key (not OAuth) and verify it is active.",
        "error"
      );
    }
    mylog(
      `Details failed for ${fsqId} (${status || "no status"}): ${
        body ? JSON.stringify(body) : error?.message || "unknown error"
      }`,
      "warning"
    );
    return null;
  }
};

const hasSiteBuilderHint = (website?: string) => {
  if (!website) return false;
  const lower = website.toLowerCase();
  return SITE_BUILDER_HINTS.some((hint) => lower.includes(hint));
};

const scoreNeed = (details: FsqDetails) => {
  let score = 0;
  const reasons: string[] = [];

  if (!details.website) {
    score += 40;
    reasons.push("no website");
  }

  if (hasSiteBuilderHint(details.website)) {
    score += 20;
    reasons.push("builder website");
  }

  if (!details.email && !details.website) {
    score += 15;
    reasons.push("no email");
  }

  if (details.social_media && Object.keys(details.social_media).length) {
    score += 5;
    reasons.push("social-only signals");
  }

  if (details.chains && details.chains.length) {
    score -= 30;
    reasons.push("likely chain");
  }

  return { score, reason: reasons.join(", ") };
};

const buildPrompt = (items: LeadRecord[]) => {
  return [
    "You are a strict classifier. Decide if a small business likely needs",
    "a new website or automation (online booking, ordering, intake forms).",
    "Prioritize local services, clinics, salons, repair, restaurants, tutors.",
    "Return ONLY JSON array with objects:",
    '{ "fsq_id": "...", "needs_website_or_automation": true|false, "need_score": 0-100, "reason": "short" }.',
    "",
    JSON.stringify(
      items.map((item) => ({
        fsq_id: item.fsq_id,
        name: item.name,
        categories: item.categories,
        website: item.website || "",
        phone: item.phone || "",
        email: item.email || "",
        social: item.social || {},
        address: item.address || "",
      }))
    ),
  ].join("\n");
};

const classifyNeeds = async (items: LeadRecord[]) => {
  const result = new Map<string, GptResult>();
  if (!items.length) return result;

  const groups: LeadRecord[][] = [];
  for (let i = 0; i < items.length; i += GPT_BATCH_SIZE) {
    groups.push(items.slice(i, i + GPT_BATCH_SIZE));
  }

  for (const [index, group] of groups.entries()) {
    mylog(`GPT check batch ${index + 1}/${groups.length}`, "info");
    const prompt = buildPrompt(group);
    const gptRes = await callGPT(prompt, `maps_business_${index + 1}`, {
      model: GPT_MODEL,
    });
    if (Array.isArray(gptRes)) {
      gptRes.forEach((item: GptResult) => {
        if (item?.fsq_id) result.set(item.fsq_id, item);
      });
    }
  }

  return result;
};

export default async function mapsBusiness() {
  validateEnv();

  const queries = normalizeQueries();
  mylog(
    `Foursquare search around ${LAT},${LONG} (radius ${RADIUS_METERS}m)`,
    "info"
  );

  const byId = new Map<string, FsqSearchPlace>();
  for (const query of queries) {
    const results = await fetchPlacesByQuery(query);
    results.forEach((item) => {
      const id = item.fsq_id || item.fsq_place_id;
      if (id && !byId.has(id)) byId.set(id, item);
    });
    await delay(800);
  }

  const uniqueResults = Array.from(byId.values());
  mylog(`Unique search results: ${uniqueResults.length}`, "success");

  const leads: LeadRecord[] = [];
  for (const [index, place] of uniqueResults.entries()) {
    mylog(`Details ${index + 1}/${uniqueResults.length}: ${place.name}`, "info");
    const fsqId = place.fsq_id || place.fsq_place_id;
    if (!fsqId) continue;
    const details = await fetchPlaceDetails(fsqId);
    if (!details) continue;

    const categories = (details.categories || []).map((c) => c.name).filter(Boolean) as string[];
    const { score, reason } = scoreNeed(details);

    leads.push({
      fsq_id: details.fsq_id || details.fsq_place_id || fsqId,
      name: details.name,
      address: details.location?.formatted_address,
      categories,
      website: details.website,
      phone: details.tel,
      email: details.email,
      social: details.social_media,
      needs_website_or_automation: score >= 40,
      need_score: score,
      reason,
    });

    await delay(300);
  }

  const gptMap = DISABLE_GPT ? new Map<string, GptResult>() : await classifyNeeds(leads);
  const filtered = leads
    .map((item) => {
      if (DISABLE_GPT) return item;
      const verdict = gptMap.get(item.fsq_id);
      return {
        ...item,
        needs_website_or_automation:
          verdict?.needs_website_or_automation ??
          item.needs_website_or_automation,
        need_score: verdict?.need_score ?? item.need_score,
        reason: verdict?.reason || item.reason,
      };
    })
    .filter((item) => item.needs_website_or_automation);

  saveProgress(filtered, OUTPUT_PATH);
  mylog(`Saved ${filtered.length} items -> ${OUTPUT_PATH}`, "success");
}

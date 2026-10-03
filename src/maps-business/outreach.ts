import { readFileSync } from "fs";
import { callGPTText } from "../services/gpt";
import { delay, mylog, saveProgress } from "../helper";

const INPUT_PATH = process.env.MAPS_BUSINESS_OUTPUT || "maps-business.json";
const OUTPUT_PATH =
  process.env.BUSINESS_OUTREACH_OUTPUT || "business_result.json";
const PROMPT_PATH =
  process.env.BUSINESS_OUTREACH_PROMPT ||
  "src/maps-business/business_prompt.txt";
const MODEL = process.env.BUSINESS_OUTREACH_MODEL || "gpt-4";
const PER_ITEM_DELAY = Number(process.env.BUSINESS_OUTREACH_DELAY || 800);

type BusinessRecord = Record<string, any> & {
  fsq_id?: string;
  name?: string;
};

const loadPrompt = () => readFileSync(PROMPT_PATH, "utf-8");

const loadBusinesses = (): BusinessRecord[] => {
  const raw = readFileSync(INPUT_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("maps-business.json must be an array");
  }
  return parsed;
};

const loadExistingResults = (): Array<BusinessRecord & { outreach?: string }> => {
  try {
    const raw = readFileSync(OUTPUT_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildExistingMap = (
  items: Array<BusinessRecord & { outreach?: string }>
) => {
  const map = new Map<string, BusinessRecord & { outreach?: string }>();
  items.forEach((item) => {
    if (item?.fsq_id) map.set(item.fsq_id, item);
  });
  return map;
};

const fillPrompt = (template: string, business: BusinessRecord) => {
  const payload = JSON.stringify(business, null, 2);
  return template.replace("{{BUSINESS_JSON}}", payload);
};

export default async function buildOutreach() {
  const template = loadPrompt();
  const businesses = loadBusinesses();
  const existing = loadExistingResults();
  const existingMap = buildExistingMap(existing);
  const results: Array<BusinessRecord & { outreach: string }> = [];

  mylog(`Outreach build: ${businesses.length} businesses`, "info");

  const withPhone = businesses.filter((item) => item?.phone);
  mylog(`Outreach with phone: ${withPhone.length}`, "info");

  for (const [index, business] of withPhone.entries()) {
    const label = business?.name || business?.fsq_id || `item_${index + 1}`;
    if (business?.fsq_id && existingMap.has(business.fsq_id)) {
      const cached = existingMap.get(business.fsq_id)!;
      results.push({
        ...business,
        outreach: cached.outreach || "",
      });
      mylog(
        `Outreach cached ${index + 1}/${withPhone.length}: ${label}`,
        "info"
      );
      saveProgress(results, OUTPUT_PATH);
      continue;
    }

    mylog(`Outreach ${index + 1}/${withPhone.length}: ${label}`, "info");

    const prompt = fillPrompt(template, business);
    const text = await callGPTText(prompt, `outreach_${index + 1}`, {
      model: MODEL,
    });

    results.push({
      ...business,
      outreach: text || "",
    });

    saveProgress(results, OUTPUT_PATH);

    if (PER_ITEM_DELAY > 0) {
      await delay(PER_ITEM_DELAY);
    }
  }

  saveProgress(results, OUTPUT_PATH);
  mylog(`Saved ${results.length} items -> ${OUTPUT_PATH}`, "success");
}

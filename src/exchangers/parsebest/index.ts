import { readFileSync } from "fs";
import { mylog, saveProgress } from "../../helper";
import { scrape } from "../../services/cheerio";
import { callGPT, findPrompt } from "../../services/gpt";
import { IScrapedBC } from "../../types";
import dotenv from "dotenv";

dotenv.config();

export const parseBest = async () => {
  const scrapedData = await scrape(
    "https://www.bestchange.com/list.html",
    false,
    "rates_block"
  );
  const promptBeginning = await findPrompt("parse_bestchange_exchangers");
  const prompt = promptBeginning + scrapedData;
  mylog(promptBeginning || "no prompt found", "info");
  const res = await callGPT(prompt, "best");
  const prev = JSON.parse(
    readFileSync("bc-scraped.json", "utf-8")
  ) as IScrapedBC[];
  const combined = Array.from(
    new Map([...res, ...prev].map((e) => [e.name, e])).values()
  );
  mylog(`Previous: ${prev.length}`);
  mylog(`Current: ${res.length}`);
  mylog(`Combined: ${combined.length}`);
  saveProgress(combined, "bc-scraped.json");
};

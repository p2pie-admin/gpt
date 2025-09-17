// это заглушки текстов направлений, если уникального текста нет
import dotenv from "dotenv";
import callStrapi from "../services/callStrapi";
import { selectorQuery } from "../services/queries";
import { ISelector } from "../types/selector";
import { delay, mylog } from "../helper";
import { fillDirTexts, generatePairs } from "./helper";
import { callGPT, findPrompt } from "../services/gpt";
import { IDirText } from "../types";

dotenv.config();

export default async () => {
  try {
    const { selector } = (await callStrapi(selectorQuery)) as {
      selector: ISelector;
    };
    if (!selector) mylog("No selector", "error");

    const sections = selector.sections.map((s) => s.en_title.toLowerCase());
    const pairs = generatePairs(sections);
    mylog(
      `Found ${pairs.length} pairs like: ${pairs.slice(0, 5)}...`,
      "hidden"
    );

    for (const pair of pairs) {
      const promptEnd = await findPrompt(
        "default_dir",
        Math.floor(Math.random() * 3) + 1
      );

      if (!promptEnd) continue;

      const prompt = `${pair}: ${promptEnd}`;

      const res = (await callGPT(prompt, `${pair}`)) as {
        en: IDirText;
        ru: IDirText;
      };

      if (!res.en) mylog(`res is ${JSON.stringify(res)}`, "error");

      fillDirTexts(res, pair);

      await delay(2000); // waits before moving to the next
    }
  } catch (e) {
    mylog(String(e), "error");
  }
};

import dotenv from "dotenv";
import OpenAI from "openai";
import { mylog, sleep } from "../helper";
import { IDescriptionData, IPrompt } from "../types";
import callStrapi from "./callStrapi";
import { PromptsQuery } from "./queries";

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY as string;

if (!OPENAI_API_KEY) {
  throw new Error(
    "OpenAI API key is missing. Please set OPENAI_API_KEY in .env."
  );
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

type CallGPTOptions = {
  model?: string;
};

export const callGPTText = async (
  prompt: string,
  id: string,
  options?: CallGPTOptions
): Promise<string | null> => {
  const model =
    options?.model || (process.env.MODEL as string) || "gpt-4o-mini";
  mylog(`Running ${id.toUpperCase()} on ${model}...`, "info");
  if (!prompt) return null;

  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt.slice(0, 320_000) }],
      });

      const rawResult = completion?.choices?.[0]?.message?.content;
      if (rawResult) return rawResult.trim();
    } catch (error) {
      mylog(
        `❌ Error processing ${id} (Attempt ${
          attempts + 1
        } of ${maxRetries}): ${error}`,
        "error"
      );
    }

    attempts++;
    if (attempts < maxRetries) {
      console.log(`🔄 Retrying in 5 seconds...`);
      await sleep(4000);
    }
  }

  mylog(`❌ ${id} failed after ${maxRetries} attempts.`, "error");
  return null;
};

export const callGPT = async (
  prompt: string,
  id: string,
  options?: CallGPTOptions
): Promise<any | null> => {
  const model =
    options?.model || (process.env.MODEL as string) || "gpt-4o-mini";
  mylog(`Running ${id.toUpperCase()} on ${model}...`, "info");
  if (!prompt) return null;

  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt.slice(0, 320_000) }],
      });

      const rawResult = completion?.choices?.[0]?.message?.content;

      if (rawResult) {
        const cleaned = rawResult.replace(/^```json\s*|```$/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return parsed;
      }
    } catch (error) {
      mylog(
        `❌ Error processing ${id} (Attempt ${
          attempts + 1
        } of ${maxRetries}): ${error}`,
        "error"
      );
    }

    attempts++;
    if (attempts < maxRetries) {
      console.log(`🔄 Retrying in 5 seconds...`);
      await sleep(4000);
    }
  }

  mylog(`❌ ${id} failed after ${maxRetries} attempts.`, "error");
  return null;
};

/////////////////////////////////////////////////////////

export const findPrompt = async (name: string, idx?: number | number[]) => {
  const promptData = (await callStrapi(PromptsQuery)) as {
    prompts: IPrompt[];
  };

  const findByCode = (code: string) =>
    promptData?.prompts?.find(
      (p) => p.code.toLowerCase() === code.toLowerCase()
    )?.description;

  const promptDescription = findByCode(name);
  const indices = Array.isArray(idx)
    ? idx.filter((value) => typeof value === "number" && value > 0)
    : typeof idx === "number" && idx > 0
    ? [idx]
    : [];
  const additionalDescriptions = indices
    .map((value) => findByCode(`${name}_${value}`))
    .filter((description): description is string => Boolean(description));

  if (promptDescription || additionalDescriptions.length) {
    mylog(`${name} prompt found`, "info");
    const parts = [promptDescription, ...additionalDescriptions].filter(
      Boolean
    );
    return parts.join(" | ");
  }
  mylog(`${name} no prompt found`, "error");
  return;
};

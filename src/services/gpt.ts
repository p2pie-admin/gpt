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

export const callGPT = async (
  prompt: string,
  id: string
): Promise<any | null> => {
  const model = (process.env.MODEL as string) || "gpt-4o-mini";
  console.log("Model: ", model);
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
      await sleep(5000);
    }
  }

  mylog(`❌ ${id} failed after ${maxRetries} attempts.`, "error");
  return null;
};

/////////////////////////////////////////////////////////

export const findPrompt = async (name: string, idx = 0) => {
  const promptData = (await callStrapi(PromptsQuery)) as {
    prompts: IPrompt[];
  };

  let additionalDescription = "";

  const promptDescription = promptData?.prompts?.find(
    (p) => p.code.toLowerCase() == name
  )?.description;

  if (idx) {
    additionalDescription = promptData?.prompts?.find(
      (p) => p.code.toLowerCase() == `${name}_${idx}`
    )?.description as string;
  }

  if (promptDescription) {
    mylog(`${name} prompt found`, "info");
    return `${promptDescription} | ${additionalDescription}`;
  }
  mylog(`${name} no prompt found`, "error");
  return;
};

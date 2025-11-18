import { delay, mylog } from "../helper";
import callStrapi from "../services/callStrapi";
import { callGPT, findPrompt } from "../services/gpt";
import { EnTextBoxKeysQuery, RuTextBoxKeysQuery } from "../services/queries";
import { IDirText, TextBoxKey } from "../types";
import createDirText, { createDirTextLocalization } from "./createDirText";

import generateSlugs from "./generateSlugs";
import { checkIfBothLocalesExist } from "./helper";
import { destructureDirSlug } from "./pms";

const DIR_TIMEOUT_MS = 30000; // 30 seconds timeout per directory

export default async () => {
  while (true) {
    try {
      const slugs = await generateSlugs();

      const { textBoxes } = (await callStrapi(RuTextBoxKeysQuery)) as {
        textBoxes: TextBoxKey[];
      };
      const { textBoxes: EnTextBoxes } = (await callStrapi(
        EnTextBoxKeysQuery
      )) as {
        textBoxes: { id: string; key: string }[];
      }; // вытаскиваем все уже существующие слаги для обеих локализаций

      checkIfBothLocalesExist(textBoxes, EnTextBoxes);

      for (const [dir, slug] of Object.entries(slugs)) {
        try {
          await Promise.race([
            // если уже есть, пропускает, иначе создает задание для chatGPT
            handleDir(slug, textBoxes),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error(`Timeout for ${dir}`)),
                DIR_TIMEOUT_MS
              )
            ),
          ]);
        } catch (e) {
          mylog(
            `Skipped ${dir} due to timeout or error: ${(e as Error).message}`,
            "error"
          );
        }
      }

      break; // All done
    } catch (err) {
      mylog("fill_dirs failed. Restarting in 5 seconds...", "error");
      await delay(5000);
    }
  }
};

async function handleDir(slug: string, textBoxes: { key: string }[]) {
  if (textBoxes.find((tb) => tb.key === slug)) {
    mylog(`Skipped ${slug}`, "hidden");
    return;
  }

  const isCash = (slug && slug.startsWith("cash-")) || slug.includes("-cash-");

  if (isCash) {
    mylog(
      "НЕ СОЗДАЕМ НАПРАВЛЕНИЯ С КЭШЕМ ТАК КАК ТАМ НУЖЕН ГОРОД, ИНАЧЕ ОНИ БУДУТ НЕ УНИКАЛЬНЫЕ",
      "warning"
    );

    return;
  }

  // Распаковываем slug
  const {
    giveName,
    giveCurCode,
    giveSubgroupName,
    getName,
    getCurCode,
    getSubgroupName,
  } = destructureDirSlug(slug);

  const promptStart = `${giveName} ${giveCurCode} ${
    giveSubgroupName || ""
  } -> ${getName} ${getCurCode} ${getSubgroupName || ""}`;
  const promptEnd = await findPrompt("dir", Math.floor(Math.random() * 5) + 1);
  await delay(3000);

  // GPT отвечает сразу en и ru
  const res = (await callGPT(`${promptStart} ${promptEnd}`, slug)) as {
    en: IDirText;
    ru: IDirText;
  };

  if (!res) {
    mylog(`No response for ${slug}`, "error");
    return;
  }

  const [section_give, section_get] = slug.split("_to_");

  // 1. Create EN as base
  const baseId = await createDirText({
    dirText: res.en,
    key: slug,
  });
  await delay(1000);

  if (!baseId) {
    mylog(`Failed to create EN base for ${slug}`, "error");
    return;
  }

  mylog(`EN base created with ID: ${baseId}`, "success");

  // 2. Create RU as localization of that base
  const ruRes = await createDirTextLocalization({ dirText: res.ru, baseId });

  if (ruRes) {
    mylog(`RU localization created for ${slug}`, "success");
  } else {
    mylog(`Failed to create RU localization for ${slug}`, "error");
  }
}

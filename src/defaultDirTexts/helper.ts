import { mylog } from "../helper";
import callStrapi from "../services/callStrapi";
import {
  CreateDirsText,
  CreateDirsTextLocalization,
} from "../services/queries";
import { IDirText } from "../types";

export const generatePairs = (arr: string[]): string[] =>
  arr.flatMap((a) => arr.map((b) => `${a}_to_${b}`));

//  "crypto -> crypto", "crypto -> bank", "bank -> crypto" ...
export const createDirsText = async (
  locale: string,
  dirText: IDirText & { section_give: string; section_get: string }
) => {
  try {
    const {
      text,
      header,
      subheader,
      seo_description,
      seo_title,
      section_give,
      section_get,
    } = dirText;
    const res = await callStrapi(CreateDirsText, {
      locale,
      text,
      header,
      subheader,
      seo_description,
      seo_title,
      section_give,
      section_get,
    });

    return res?.createDirsText?.id as string;
  } catch (e) {
    console.log(`📕 \u001b[1;31m Saving dirsText failed!`);
    console.log(e);
    return null;
  }
};

export const createDirsTextLocalization = async (
  baseId: string,
  locale: string,
  dirText: IDirText
) => {
  try {
    const { text, header, subheader, seo_description, seo_title } = dirText;
    const res = await callStrapi(CreateDirsTextLocalization, {
      id: baseId,
      locale,
      data: {
        text,
        header,
        subheader,
        seo_description,
        seo_title,
      },
    });
    return res;
  } catch (e) {
    console.log(`📕 \u001b[1;31m Creating dirsText localization failed!`);
    console.log(e);
  }
};

export const fillDirTexts = async (
  res: { en: IDirText; ru: IDirText },
  pair: string
) => {
  const [section_give, section_get] = pair.split("_to_");

  // Create base in EN first (or RU if you prefer)
  const baseId = await createDirsText("en", {
    ...res.en,
    section_give,
    section_get,
  });
  console.log("baseId: ", baseId);
  if (!baseId) return;

  // Then create RU localization
  await createDirsTextLocalization(baseId, "ru", {
    ...res.ru,
  });
};

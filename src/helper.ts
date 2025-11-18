import { writeFileSync } from "fs";
import callStrapi from "./services/callStrapi";
import { CreateArticle, CreateArticleLocalization } from "./services/queries";
import { IArticleData } from "./types";
import { IPmGroup, ISection } from "./types/selector";

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const createArticle = async (
  code: string,
  locale: string,
  articleData?: IArticleData
) => {
  if (!articleData) {
    console.log(`📕 \u001b[1;31m articleData ${articleData} failed!`);
    return;
  }
  try {
    const { chapters, header, stats, subheader, seo_title, seo_description } =
      articleData;
    return (await callStrapi(CreateArticle, {
      chapters,
      header,
      stats,
      subheader,
      seo_title,
      seo_description,
      code: code.toLowerCase().replaceAll(" ", "_"),
      locale,
    })) as {
      createArticle: {
        id: string;
      };
    };
  } catch (e) {
    console.log(`📕 \u001b[1;31m Saving article failed!`);
    console.log(e);
  }
};

export const createLocalization = async (
  baseArticleId: string,
  locale: string,
  articleData: IArticleData
) => {
  try {
    const { chapters, header, stats, subheader, seo_description, seo_title } =
      articleData;
    const res = await callStrapi(CreateArticleLocalization, {
      id: baseArticleId,
      locale,
      data: {
        chapters,
        header,
        stats,
        subheader,
        seo_title,
        seo_description,
      },
    });
    await delay(1000);
    return res;
  } catch (e) {
    console.log(`📕 \u001b[1;31m Creating localization failed!`);
    console.log(e);
  }
};

export const getPmNames = (sections: ISection[]): string[] => {
  const pmGroups = sections.reduce(
    (res: IPmGroup[], section) => [...res, ...section.pm_groups],
    []
  );
  return pmGroups.reduce(
    (allNames: string[], pmGroup) => [...allNames, capitalize(pmGroup.en_name)],
    []
  );
};

export const capitalize = (s: string | undefined) => {
  if (typeof s !== "string") return "";
  const words = s.split(" ");
  const res = words
    .map((w, index) =>
      index > 0 && w.length < 4
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1)
    )
    .join(" ");
  return res;
};

export function delay(ms: number) {
  mylog(`waiting ${(ms / 1000).toFixed(0)}s ...`);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function saveProgress(data: any, path: string) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

export const makeRefLink = (link: string) => {
  return link
    .trim()
    .replace(/https?:\/\/(www\.)?/i, "___")
    .split("/")[0]
    .replace("api.", "")
    .replace("___", "https://");
};

export const mylog = (
  message: string,
  color:
    | "error"
    | "success"
    | "warning"
    | "important"
    | "info"
    | "hidden" = "info"
) => {
  const colors = {
    error: "📕 \u001b[1;31m",
    success: "📗 \u001b[1;32m",
    warning: "📙 \u001b[1;33m",
    info: "📘 \u001b[1;34m",
    hidden: "📓 \u001b[1;30m",
    important: "📔 \u001b[38;5;226m",
  };
  console.log(`${colors[color]} ${message}`);
};

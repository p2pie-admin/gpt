import { readFileSync } from "fs";
import { IExchangerData, IScrapedBC } from "../../types";
import callStrapi from "../../services/callStrapi";
import {
  CreateExchangerBC,
  LinksQuery,
  UpdateExchangerName,
} from "../../services/queries";
import { delay, mylog } from "../../helper";
import { generateRating } from "../descriptions/helper";
import {
  convertName,
  convertSlug,
  extentionsToRemove,
  splitReadable,
} from "./helper";

export const changeExchangerNames = async () => {
  await delay(1500);
  const data = await callStrapi(LinksQuery);
  const exData = data.exchangers;

  for (const ex of exData) {
    const { name, id } = ex as { name: string; id: number };

    //const newName = splitReadable(name);

    const slug = convertSlug(name);
    const newName = convertName(slug);

    await callStrapi(UpdateExchangerName, {
      id,
      display_name: newName,
      name: slug,
    });
    mylog(
      `${name} -> ${newName} |  ${slug.toLowerCase()}`,
      slug.includes("-") || slug.length > 10 ? "warning" : "hidden"
    );
    await delay(400);
  }
  mylog("FINISHED name update", "important");
};

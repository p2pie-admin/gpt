import { IExchangerData } from "../../types";
import callStrapi from "../../services/callStrapi";
import { mylog } from "../../helper";
import {
  EmptyDescriptionQuery,
  UpdateDescriptions,
} from "../../services/queries";
import { callGPT, findPrompt } from "../../services/gpt";
import { scrape } from "../../services/cheerio";
import { generateRating } from "./helper";

export default async () => {
  try {
    const promptToRemoveTrashBeginning = await findPrompt(
      "exchanger_parse_text_block"
    );
    const promptToGenerateTextBeginning = await findPrompt(
      "exchanger_description"
    );
    const empty = await callStrapi(EmptyDescriptionQuery);

    const exchangers = empty.exchangers.filter(
      (e: any) => e.ref_link
    ) as IExchangerData[];
    mylog(`Exchangers without description found: ${exchangers.length}`);

    for (let e of exchangers) {
      const textBlocks = await scrape(e.ref_link);
      if (textBlocks) {
        mylog(`Initial: ${textBlocks.length}`, "hidden");
        const promptToRemoveTrash =
          promptToRemoveTrashBeginning + " \n " + textBlocks;
        const cleanedTextBlock = (await callGPT(promptToRemoveTrash, e.id, {
          model: "gpt-4.1-nano",
        })) as any;
        if (cleanedTextBlock?.isValid) {
          mylog(
            `Comment: ${e.id} | ${cleanedTextBlock?.isValidComment}`,
            "success"
          );
        } else {
          mylog(
            `Data: ${e.id} | ${JSON.stringify(cleanedTextBlock, undefined, 4)}`,
            "warning"
          );
          continue;
        }
        mylog(`Cleaned: ${JSON.stringify(cleanedTextBlock).length}`, "success");
        const promptToGenerateText =
          promptToGenerateTextBeginning + " \n " + cleanedTextBlock;
        const res = (await callGPT(promptToGenerateText, e.id, {
          model: "gpt-4.1-mini",
        })) as any;

        mylog(`Final: ${res?.ru_description?.length}`, "success");

        if (res) {
          const updateData = {
            id: e.id,
            ru_description: res.ru_description || null,
            en_description: res.en_description || null,
            telegram: res.telegram || null,
            email: res.email || null,
            working_time: res.working_time || null,
            admin_rating: generateRating(),
          };
          await callStrapi(UpdateDescriptions, updateData);
          mylog(`${e.id} filled!`, "warning");
          continue;
        }
      }
    }
  } catch (err) {
    console.error(" load_html:", err);
  }
};

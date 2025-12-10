import { delay, mylog } from "../../helper";
import callStrapi from "../../services/callStrapi";
import { findPrompt, callGPT } from "../../services/gpt";
import {
  EmptyDescriptionQuery,
  LinksQuery,
  UpdateDescriptions,
} from "../../services/queries";
import { IExchangerData } from "../../types";
import { AddComment } from "../checkHealthXML";
import { getDomain } from "../xml/helper";
import { generateRating, getAdditionalCoreText, readHtmlFiles } from "./helper";
import dotenv from "dotenv";

dotenv.config();

export default async () => {
  const fileData = (await readHtmlFiles()) as
    | { fileName: string; content: string }[]
    | undefined;

  if (!fileData) {
    mylog("no data", "error");
    return;
  }

  const empty = (await callStrapi(EmptyDescriptionQuery)) as any;

  const exData = empty.exchangers.filter((e: IExchangerData) => e.ref_link);
  const promptDescription = await findPrompt("exchanger_description");
  const promptToRemoveTrashBeginning = await findPrompt(
    "exchanger_parse_text_block"
  );

  for (const data of fileData) {
    const ex = exData.find(
      (e: IExchangerData) =>
        getDomain(e.ref_link) == data.fileName.replace(".html", "") ||
        getDomain(data.fileName).split(".")[0] == e.name.toLowerCase()
    );
    mylog(`For ${data.fileName} found ${ex?.name}`, "hidden");

    if (!ex) {
      mylog(`${data.fileName}`, "error");
      continue;
    }

    const textBlocks = data.content;

    if (!textBlocks) continue;

    const promptToRemoveTrash =
      promptToRemoveTrashBeginning + " \n " + textBlocks.slice(0, 28_000);
    const cleanedTextBlock = (await callGPT(promptToRemoveTrash, ex.id, {
      model: "gpt-4.1-nano",
    })) as any;
    mylog(`  Blocks: ${textBlocks.length}`, "hidden");

    const validTextBlock = cleanedTextBlock?.isValid
      ? cleanedTextBlock
      : "no html file generate random text";

    if (cleanedTextBlock?.isValid) {
      mylog(
        `Comment: ${ex.id} | ${cleanedTextBlock?.isValidComment}`,
        "success"
      );
    } else {
      mylog(
        `Data: ${ex.id} | ${JSON.stringify(cleanedTextBlock, undefined, 4)}`,
        "warning"
      );
      await AddComment(ex.name, "\nТекст сгенерирован от балды");
    }

    await delay(8000);

    const prompt =
      promptDescription +
      " \n -- BEGINNING OF EXCHANGER DATA -- \n " +
      validTextBlock +
      " \n -- END OF EXCHANGER DATA -- \n ";

    let res = (await callGPT(prompt, ex.id, {
      model: cleanedTextBlock?.isValid ? "gpt-4.1-mini" : "gpt-4.1-mini",
    })) as any;

    if (res?.isPoorData) {
      mylog("POOR DATA", "warning");
      mylog(`${JSON.stringify(cleanedTextBlock).slice(0, 300)}`, "hidden");
    }

    // Fallback: if GPT returned but descriptions are empty, retry with explicit requirement.
    if (res && (!res.ru_description || !res.en_description)) {
      mylog(
        `${ex.id} returned empty descriptions, retrying with stricter prompt`,
        "warning"
      );
      mylog(JSON.stringify(res));
      const retryPrompt =
        prompt +
        "\n\nIf ru_description or en_description is missing or empty, generate both fields with non-empty meaningful text.";
      const retryRes = (await callGPT(retryPrompt, ex.id, {
        model: "gpt-4.1-mini",
      })) as any;
      if (retryRes && retryRes.ru_description && retryRes.en_description) {
        res = retryRes;
      }
    }

    if (res && (res.ru_description || res.en_description)) {
      const updateData = {
        id: ex.id,
        ru_description: res.ru_description || null,
        en_description: res.en_description || null,
        telegram: ex?.telegram || res.telegram || null,
        email: ex?.email || res.email || null,
        working_time: ex?.working_time || res.working_time || null,
        admin_rating: ex?.admin_rating ?? generateRating(),
      };

      await callStrapi(UpdateDescriptions, updateData);
      mylog(`${ex.id} ${ex.name} filled!`, "success");
      await delay(6000);
    } else {
      mylog(`Failed: ${ex.id} ${ex.name}`);
      await delay(6000);
    }
  }
  mylog("- DONE -", "success");
};

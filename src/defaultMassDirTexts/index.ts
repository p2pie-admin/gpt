// это заглушки текстов направлений, если уникального текста нет
import dotenv from "dotenv";
import callStrapi from "../services/callStrapi";
import { CurrencyIdsQuery, selectorQuery } from "../services/queries";
import { IPm, ISelector } from "../types/selector";
import { delay, mylog } from "../helper";

import { callGPT, findPrompt } from "../services/gpt";

import {
  createMassDirTextsBothLocales,
  extractPmsFromPmGroup,
  fiatCurrencies,
} from "./helper";
import { IDirText } from "../types";

dotenv.config();

export default async () => {
  try {
    const { selector } = (await callStrapi(selectorQuery)) as {
      selector: ISelector;
    };

    if (!selector) {
      mylog("No selector", "error");
      return;
    }

    const cryptoSection = selector.sections.find(
      (s) => s.en_title.toLowerCase() === "crypto"
    );
    if (!cryptoSection) {
      mylog("No cryptoSection", "error");
      return;
    }
    // вытаскиваем все крипто пм в один массив
    let cryptoPms: IPm[] = [];
    for (const pmGroup of cryptoSection.pm_groups) {
      const extractedPms = extractPmsFromPmGroup(pmGroup) || [];
      cryptoPms = [...cryptoPms, ...extractedPms];
    }
    // вытаскиваем айдишники currency чтобы потом передать на создание mass dir text
    const res = await callStrapi(CurrencyIdsQuery);
    const currencyIds = Object.fromEntries(
      res.currencies.map(({ code, id }: { code: string; id: string }) => [
        code,
        id,
      ])
    );
    for (const isSell of [true, false]) {
      for (const cryptoPm of cryptoPms) {
        for (const currency of fiatCurrencies) {
          const promptEnd = await findPrompt(
            "dir_mass",
            Math.floor(Math.random() * 3) + 1
          );
          if (!promptEnd || !currencyIds[currency.toLowerCase()]) continue;

          const promptStart = isSell
            ? `${cryptoPm.en_name} ${cryptoPm.currency.code.toUpperCase()} ${
                cryptoPm.subgroup_name || ""
              } to  ${currency.toUpperCase()}`
            : ` ${currency.toUpperCase()} to ${
                cryptoPm.en_name
              } ${cryptoPm.currency.code.toUpperCase()} ${
                cryptoPm.subgroup_name || ""
              }`;

          const prompt = `${JSON.stringify(promptStart)}: ${promptEnd}`;

          const res = (await callGPT(prompt, `${promptStart}`)) as {
            en: IDirText;
            ru: IDirText;
          };

          await delay(2000);
          await createMassDirTextsBothLocales(
            currencyIds[currency.toLowerCase()],
            cryptoPm.code,
            res,
            isSell
          );

          //для каждой пары фиатной валюты и крипты создаем тексты
        }
        // wait between processing each cryptoPm
      }
    }

    mylog("Finished creating default mass dirs for all crypto PMs", "info");
  } catch (e) {
    mylog(String(e), "error");
  }
};

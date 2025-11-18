import { createDirsTextLocalization } from "../defaultDirTexts/helper";
import { mylog } from "../helper";
import callStrapi from "../services/callStrapi";
import {
  CreateMassDirsText,
  CreateMassDirsTextLocalization,
  CurrencyIdsQuery,
} from "../services/queries";
import { IDirText } from "../types";
import { IPmGroup, IPopularAs, IPm, IOption } from "../types/selector";

export const fiatCurrencies = [
  "usd",
  "rub",
  "uah",
  "eur",
  // "gbp",
  // "gel",
  // "try",
  // "azn",
  // "som",
  // "cny",
];

const getOptionCode = (option: IOption, prefix?: string): string => {
  return (
    (option?.code && option?.code.toUpperCase()) || // USDTERC
    (prefix &&
      prefix.toUpperCase() !== option?.currency?.code.toUpperCase() &&
      prefix.toUpperCase() + option?.currency?.code.toUpperCase()) || // SBERRUB
    option?.currency?.code.toUpperCase()
  ); // BTC
};

export const extractPmsFromPmGroup = (
  pm_group: IPmGroup,
  popular_as?: IPopularAs
): IPm[] | undefined => {
  if (!pm_group) return;
  return pm_group.options.map((option) => {
    const code = getOptionCode(option, pm_group?.prefix);
    const subgroup_name = (option.name && option.name.toUpperCase()) || null;

    const { id, en_name, ru_name, section, icon, color } = pm_group;

    return {
      pm_group_id: id,
      code, // USDTERC20
      en_name, // Tether
      ru_name,
      subgroup_name, // ERC-20
      currency: option?.currency, // USDT
      icon,
      color,
      popular_as: popular_as || null,
      section,
    };
  });
};

export const createMassDirsTextEn = async (
  props: IDirText & { currency: string; isSell: boolean; code: string }
) => {
  try {
    const res = await callStrapi(CreateMassDirsText, {
      locale: "en",
      ...props,
    });

    return res?.createMassDirsText?.id as string;
  } catch (e) {
    console.log(`📕 \u001b[1;31m Saving dirsText failed!`);
    console.log(e);
    return null;
  }
};

export const createMassDirsTextRuLocalization = async (
  props: IDirText & {
    id: string;
    currency: string;
    isSell: boolean;
    code: string;
  }
) => {
  try {
    const res = await callStrapi(CreateMassDirsTextLocalization, {
      locale: "ru",
      ...props,
    });
    res && mylog("localization created", "success");
  } catch (e) {
    console.log(`📕 \u001b[1;31m Saving MassDirsText localization failed!`);
    console.log(e);
    return null;
  }
};

let a = 0;
export const createMassDirTextsBothLocales = async (
  currencyId: string,
  code: string,
  dirTexts: { en: IDirText; ru: IDirText },
  isSell: boolean
) => {
  const id = await createMassDirsTextEn({
    ...dirTexts["en"],
    code,
    isSell,
    currency: currencyId,
  });
  if (!id) mylog("no id for creating localization", "error");
  id &&
    createMassDirsTextRuLocalization({
      ...dirTexts["ru"],
      code,
      isSell,
      currency: currencyId,
      id,
    });
  id && mylog(`${id} created! `, "success");
};

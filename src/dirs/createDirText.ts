import callStrapi from "../services/callStrapi";
import {
  CreateTextBoxLocalizationMutation,
  CreateTextBoxMutation,
} from "../services/queries";
import { IDirText } from "../types";

export default async ({ dirText, key }: { dirText: IDirText; key: string }) => {
  const r = await callStrapi(CreateTextBoxMutation, {
    ...dirText,
    key,
  });
  return r?.createTextBox?.id;
};

export const createDirTextLocalization = async ({
  dirText,
  baseId,
}: {
  dirText: IDirText;
  baseId: string;
}) => {
  const r = await callStrapi(CreateTextBoxLocalizationMutation, {
    ...dirText,
    baseId,
  });
  return r;
};

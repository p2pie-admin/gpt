import callStrapi from "../services/callStrapi";
import {
  CreateExchangerBC,
  ExchangersForMergeQuery,
  DeleteExchanger,
} from "../services/queries";
import { delay, mylog } from "../helper";
import { IExchangerData, IExchangerMonitoring } from "../types";
import { convertName, convertSlug } from "./createExchangers/helper";

const normalizeString = (value?: string | null) =>
  typeof value === "string" ? value.trim() : value || "";

const pickString = (
  a?: string | null,
  b?: string | null,
  prefer: "longer" | "shorter" = "longer"
) => {
  const left = normalizeString(a);
  const right = normalizeString(b);
  if (left && !right) return left;
  if (!left && right) return right;
  if (!left && !right) return "";
  if (prefer === "shorter") return left.length <= right.length ? left : right;
  return left.length >= right.length ? left : right;
};

const pickNumber = (a?: number | null, b?: number | null) => {
  if (typeof a === "number" && typeof b === "number") {
    return Math.max(a, b);
  }
  if (typeof a === "number") return a;
  if (typeof b === "number") return b;
  return null;
};

const mergeMonitorings = (
  a?: IExchangerMonitoring[] | null,
  b?: IExchangerMonitoring[] | null
) => {
  const result = new Map<string, IExchangerMonitoring>();
  const pushMonitoring = (m?: IExchangerMonitoring) => {
    if (!m) return;
    const key =
      m.monitoring?.id ||
      m.monitoring?.name ||
      (m.link ? `link:${m.link}` : undefined);
    if (!key) return;
    const existing = result.get(key);
    if (!existing) {
      result.set(key, { ...m });
      return;
    }
    // keep entry with longer link text
    const existingLink = normalizeString(existing.link);
    const candidateLink = normalizeString(m.link);
    const betterLink =
      pickString(existingLink, candidateLink, "longer") || existingLink;
    result.set(key, { ...existing, link: betterLink });
  };

  (a || []).forEach(pushMonitoring);
  (b || []).forEach(pushMonitoring);

  const entries = Array.from(result.values());
  if (!entries.length) return undefined;

  return entries.map((m) => ({
    __typename: "ComponentExchangerMonitoring",
    link: m.link,
    monitoring: m.monitoring?.id,
  }));
};

const mergeCards = (
  a?: IExchangerData["exchanger_card"],
  b?: IExchangerData["exchanger_card"]
) => {
  const telegram = pickString(a?.telegram, b?.telegram);
  const email = pickString(a?.email, b?.email);
  const phone_number = pickString(a?.phone_number, b?.phone_number);
  const ru_description = pickString(a?.ru_description, b?.ru_description);
  const en_description = pickString(a?.en_description, b?.en_description);
  const working_time = pickString(a?.working_time, b?.working_time);

  const card: any = {};
  if (telegram) card.telegram = telegram;
  if (email) card.email = email;
  if (phone_number) card.phone_number = phone_number;
  if (ru_description) card.ru_description = ru_description;
  if (en_description) card.en_description = en_description;
  if (working_time) card.working_time = working_time;

  return Object.keys(card).length ? card : undefined;
};

const mergeExchangersData = (a: IExchangerData, b: IExchangerData) => {
  const name = pickString(a.name, b.name);
  const display_name = pickString(
    a.display_name,
    b.display_name,
    "shorter"
  );
  const ref_link = pickString(a.ref_link, b.ref_link);
  const rates_link = pickString(a.rates_link, b.rates_link);
  const admin_comment = pickString(a.admin_comment, b.admin_comment);
  const admin_rating = pickNumber(a.admin_rating, b.admin_rating);
  const exchanger_card = mergeCards(a.exchanger_card, b.exchanger_card);
  const monitorings = mergeMonitorings(a.monitorings, b.monitorings);

  const data: any = {
    name,
    status: "draft2",
  };

  if (display_name) data.display_name = display_name;
  if (ref_link) data.ref_link = ref_link;
  if (rates_link) data.rates_link = rates_link;
  if (admin_comment) data.admin_comment = admin_comment;
  if (typeof admin_rating === "number") data.admin_rating = admin_rating;
  if (exchanger_card) data.exchanger_card = exchanger_card;
  if (monitorings) data.monitorings = monitorings;

  return data;
};

const makeUniqueName = (base: string, existingNames: Set<string>) => {
  let candidate = base || "merged-exchanger";
  let index = 1;
  while (existingNames.has(candidate.toLowerCase())) {
    candidate = `${base || "merged-exchanger"}-merged-${index}`;
    index += 1;
  }
  existingNames.add(candidate.toLowerCase());
  return candidate;
};

const removeName = (name: string | undefined, existingNames: Set<string>) => {
  const norm = normalizeString(name).toLowerCase();
  if (norm) existingNames.delete(norm);
};

const logLogoIfExists = (
  exchanger: IExchangerData,
  donorsWithLogo: { id: string; name: string; url: string }[]
) => {
  const url = exchanger.logo?.url;
  if (url) {
    mylog(`${url}`, "important");
    donorsWithLogo.push({ id: exchanger.id, name: exchanger.name, url });
  }
};

const logMatches = (label: string, value: string, exchangers: IExchangerData[]) => {
  const info = exchangers
    .map((e) => `${e.name} (id:${e.id})`)
    .join(", ");
  console.log(`[MATCH ${label}] "${value}" -> ${info}`);
};

export const mergeSame = async () => {
  const data = await callStrapi(ExchangersForMergeQuery);
  const exchangers = (data?.exchangers || []) as IExchangerData[];
  if (!exchangers.length) {
    mylog("No exchangers found", "warning");
    return;
  }

  type Key = "ref_link" | "rates_link";
  const groups: { key: Key; value: string; items: IExchangerData[] }[] = [];
  (["ref_link", "rates_link"] as Key[]).forEach((key) => {
    const map = new Map<string, IExchangerData[]>();
    for (const ex of exchangers) {
      const value = normalizeString(ex[key]);
      if (!value) continue;
      const list = map.get(value) || [];
      list.push(ex);
      map.set(value, list);
    }
    for (const [value, items] of map.entries()) {
      if (items.length < 2) continue;
      groups.push({ key, value, items });
    }
  });

  if (!groups.length) {
    mylog("No duplicates found by ref_link or rates_link", "info");
    return;
  }

  console.log("Найдены совпадения:");
  groups.forEach((g) => logMatches(g.key, g.value, g.items));

  const processed = new Set<string>();
  const existingNames = new Set(
    exchangers.map((e) => normalizeString(e.name).toLowerCase()).filter(Boolean)
  );
  const donorsWithLogo: { id: string; name: string; url: string }[] = [];
  const initialCount = exchangers.length;
  let deletedCount = 0;
  let createdCount = 0;

  for (const group of groups) {
    const candidates = group.items.filter((e) => !processed.has(e.id));
    if (candidates.length < 2) continue;

    const [first, second] = candidates;

    logMatches(group.key, group.value, [first, second]);
    await delay(2000);

    const mergedData = mergeExchangersData(first, second);
    removeName(first.name, existingNames);
    removeName(second.name, existingNames);
    const slug = convertSlug(mergedData.name || "merged-exchanger");
    const uniqueSlug = makeUniqueName(slug, existingNames);
    mergedData.name = uniqueSlug;
    mergedData.display_name = convertName(uniqueSlug);

    mylog(
      `Deleting donors "${first.name}" (${first.id}) and "${second.name}" (${second.id}) before creating merged draft2`,
      "important"
    );
    logLogoIfExists(first, donorsWithLogo);
    logLogoIfExists(second, donorsWithLogo);

    await Promise.all([
      callStrapi(DeleteExchanger, { id: first.id }),
      callStrapi(DeleteExchanger, { id: second.id }),
    ]);
    deletedCount += 2;

    const created = await callStrapi(CreateExchangerBC, { data: mergedData });
    const newId = created?.createExchanger?.id || created?.createExchanger?.data?.id;
    if (newId) createdCount += 1;

    processed.add(first.id);
    processed.add(second.id);

    console.log(
      `[DONE] ${first.name} (id:${first.id}) + ${second.name} (id:${second.id}) -> new draft2 exchanger id:${newId}`
    );
  }

  if (donorsWithLogo.length) {
    console.log(
      "Donors that had logo:",
      donorsWithLogo.map((d) => `${d.name} (id:${d.id}) -> ${d.url}`).join("; ")
    );
  }

  const finalCount = initialCount - deletedCount + createdCount;
  console.log(
    `Totals: start=${initialCount}, deleted=${deletedCount}, created=${createdCount}, end=${finalCount}`
  );

  mylog("Merge process finished", "success");
};

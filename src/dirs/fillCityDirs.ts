import { delay, mylog } from "../helper";
import callStrapi from "../services/callStrapi";
import { callGPT, findPrompt } from "../services/gpt";
import { initParserFetcher } from "../services/parserFetcher";
import {
  EnTextBoxKeysQuery,
  RuTextBoxKeysQuery,
  selectorQuery,
} from "../services/queries";
import { IDirText, TextBoxKey } from "../types";
import createDirText, { createDirTextLocalization } from "./createDirText";
import { checkIfBothLocalesExist } from "./helper";
import { destructureDirSlug, getPms, pmsToSlug } from "./pms";
import { ISelector, IPm } from "../types/selector";
import { formatCityName, toCitySlug } from "./cityUtils";

type CityDirections = Record<string, number>;
type CitiesResponse = Record<string, CityDirections>;

const CITY_DIR_TIMEOUT_MS = 30000;

export default async function fillCityDirs() {
  const parserFetcher = initParserFetcher();
  const cityModel =
    (process.env.CITY_MODEL as string) ||
    (process.env.MODEL as string) ||
    "gpt-4o-mini";

  while (true) {
    try {
      const cities = (await parserFetcher(
        "non_empty_cities"
      )) as CitiesResponse | null;

      if (!cities || !Object.keys(cities).length) {
        throw new Error("non_empty_cities returned empty response");
      }

      const dirCodes = extractDirCodes(cities);
      const slugMap = await buildSlugMap(dirCodes);

      const { textBoxes } = (await callStrapi(RuTextBoxKeysQuery)) as {
        textBoxes: TextBoxKey[];
      };
      const { textBoxes: EnTextBoxes } = (await callStrapi(
        EnTextBoxKeysQuery
      )) as {
        textBoxes: TextBoxKey[];
      };

      checkIfBothLocalesExist(textBoxes, EnTextBoxes);

      const tasks = buildCityTasks(cities, slugMap);
      mylog(`Found ${tasks.length} city direction tasks`, "info");

      for (const task of tasks) {
        try {
          await Promise.race([
            handleCityDir(task, textBoxes, cityModel),
            new Promise((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(`Timeout for ${task.dirCode}-${task.citySlug}`)
                  ),
                CITY_DIR_TIMEOUT_MS
              )
            ),
          ]);
        } catch (e) {
          mylog(
            `Skipped ${task.city} ${task.dirCode} due to timeout or error: ${
              (e as Error).message
            }`,
            "error"
          );
        }
      }

      break;
    } catch (err) {
      mylog("fill_dirs_cities failed. Restarting in 5 seconds...", "error");
      await delay(5000);
    }
  }
}

type CityTask = {
  city: string;
  citySlug: string;
  dirCode: string;
  baseSlug: string;
  offersCount: number;
};

function buildCityTasks(
  cities: CitiesResponse,
  slugMap: Record<string, string>
): CityTask[] {
  const tasks: CityTask[] = [];

  Object.entries(cities).forEach(([city, directions]) => {
    const citySlug = toCitySlug(city);
    if (!directions || !citySlug) return;

    Object.entries(directions)
      .filter(([, count]) => count > 0)
      .forEach(([dirCode, count]) => {
        const baseSlug = slugMap[dirCode];
        if (!baseSlug) {
          mylog(
            `Missing base slug for direction ${dirCode} (${citySlug})`,
            "warning"
          );
          return;
        }

        tasks.push({
          city,
          citySlug,
          dirCode,
          baseSlug,
          offersCount: count,
        });
      });
  });

  return tasks;
}

async function handleCityDir(
  task: CityTask,
  textBoxes: TextBoxKey[],
  cityModel: string
) {
  const slugWithCity = `${task.baseSlug}-${task.citySlug}`;

  if (textBoxes.find((tb) => tb.key === slugWithCity)) {
    mylog(`Skipped ${slugWithCity}`, "hidden");
    return;
  }

  const {
    giveName,
    giveCurCode,
    giveSubgroupName,
    getName,
    getCurCode,
    getSubgroupName,
  } = destructureDirSlug(task.baseSlug);

  const promptStart = `${giveName} ${giveCurCode} ${
    giveSubgroupName || ""
  } -> ${getName} ${getCurCode} ${
    getSubgroupName || ""
  } | City: ${formatCityName(task.citySlug)} (offers: ${
    task.offersCount
  })`.trim();
  const promptEnd =
    (await findPrompt("dir_city", Math.floor(Math.random() * 3) + 1)) || "";
  const cityContext = `Сфокусируйся на особенностях обмена именно в городе ${formatCityName(
    task.citySlug
  )}.`;
  await delay(3000);

  const res = (await callGPT(
    `${promptStart} ${promptEnd} ${cityContext}`,
    slugWithCity,
    { model: cityModel }
  )) as { en: IDirText; ru: IDirText };

  if (!res) {
    mylog(`No response for ${slugWithCity}`, "error");
    return;
  }

  const baseId = await createDirText({
    dirText: res.en,
    key: slugWithCity,
  });
  await delay(1000);

  if (!baseId) {
    mylog(`Failed to create EN base for ${slugWithCity}`, "error");
    return;
  }

  textBoxes.push({ id: baseId, key: slugWithCity });
  mylog(`EN base created with ID: ${baseId}`, "success");

  const ruRes = await createDirTextLocalization({
    dirText: res.ru,
    baseId,
  });

  if (ruRes) {
    mylog(`RU localization created for ${slugWithCity}`, "success");
  } else {
    mylog(`Failed to create RU localization for ${slugWithCity}`, "error");
  }
}

function extractDirCodes(cities: CitiesResponse) {
  const codes = new Set<string>();
  Object.values(cities).forEach((directions) => {
    Object.keys(directions || {}).forEach((code) => codes.add(code));
  });
  return Array.from(codes);
}

async function buildSlugMap(dirCodes: string[]) {
  const slugMap: Record<string, string> = {};
  if (!dirCodes.length) return slugMap;

  const { selector } = (await callStrapi(selectorQuery)) as {
    selector: ISelector;
  };
  const pms = getPms(selector);

  dirCodes.forEach((dirCode) => {
    const slug = slugFromDirCode(dirCode, pms);
    if (slug) {
      slugMap[dirCode] = slug;
    } else {
      mylog(`Unable to build slug for ${dirCode}`, "warning");
    }
  });

  return slugMap;
}

function slugFromDirCode(dirCode: string, pms: IPm[]) {
  if (!dirCode?.includes("_")) return;
  const [rawGive, ...rest] = dirCode.split("_");
  const rawGet = rest.join("_");
  if (!rawGive || !rawGet) return;

  const givePm = pms.find(
    (pm) => pm.code.toUpperCase() === rawGive.toUpperCase()
  );
  const getPm = pms.find(
    (pm) => pm.code.toUpperCase() === rawGet.toUpperCase()
  );

  return pmsToSlug({ givePm, getPm });
}

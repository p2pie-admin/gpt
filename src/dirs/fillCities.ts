import { delay, mylog } from "../helper";
import callStrapi from "../services/callStrapi";
import { callGPT, findPrompt } from "../services/gpt";
import { initParserFetcher } from "../services/parserFetcher";
import { EnTextBoxKeysQuery, RuTextBoxKeysQuery } from "../services/queries";
import { IDirText, TextBoxKey } from "../types";
import createDirText, { createDirTextLocalization } from "./createDirText";
import { checkIfBothLocalesExist } from "./helper";
import { formatCityName, toCitySlug } from "./cityUtils";

type CityDirections = Record<string, number>;
type CitiesResponse = Record<string, CityDirections>;

const CITY_TIMEOUT_MS = 30000;

type CityTask = {
  city: string;
  citySlug: string;
  offersCount: number;
};

export default async function fillCities() {
  const parserFetcher = initParserFetcher();
  const cityModel = process.env.CITY_MODEL as string;

  if (!cityModel) {
    throw new Error("CITY_MODEL env variable is required for fillCities");
  }

  const cityPrompt = (await findPrompt("city", [1, 2, 3])) || "";

  while (true) {
    try {
      const cities = (await parserFetcher(
        "non_empty_cities"
      )) as CitiesResponse | null;

      if (!cities || !Object.keys(cities).length) {
        throw new Error("non_empty_cities returned empty response");
      }

      const { textBoxes } = (await callStrapi(RuTextBoxKeysQuery)) as {
        textBoxes: TextBoxKey[];
      };
      const { textBoxes: EnTextBoxes } = (await callStrapi(
        EnTextBoxKeysQuery
      )) as {
        textBoxes: TextBoxKey[];
      };

      checkIfBothLocalesExist(textBoxes, EnTextBoxes);

      const tasks = buildCityTasks(cities);
      mylog(`Found ${tasks.length} city text tasks`, "info");

      for (const task of tasks) {
        try {
          await Promise.race([
            handleCity(task, textBoxes, cityModel, cityPrompt),
            new Promise((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(`Timeout for city text ${task.citySlug}`)
                  ),
                CITY_TIMEOUT_MS
              )
            ),
          ]);
        } catch (e) {
          mylog(
            `Skipped city ${task.city} due to timeout or error: ${
              (e as Error).message
            }`,
            "error"
          );
        }
      }

      break;
    } catch (err) {
      mylog("fill_cities failed. Restarting in 5 seconds...", "error");
      await delay(5000);
    }
  }
}

function buildCityTasks(cities: CitiesResponse): CityTask[] {
  const tasks: CityTask[] = [];
  Object.entries(cities).forEach(([city, directions]) => {
    const citySlug = toCitySlug(city);
    if (!citySlug) return;

    const offersCount = Object.values(directions || {}).reduce(
      (sum, count) => sum + (typeof count === "number" ? count : 0),
      0
    );

    if (!offersCount) return;

    tasks.push({
      city,
      citySlug,
      offersCount,
    });
  });
  return tasks;
}

async function handleCity(
  task: CityTask,
  textBoxes: TextBoxKey[],
  cityModel: string,
  cityPrompt: string
) {
  if (textBoxes.find((tb) => tb.key === task.citySlug)) {
    mylog(`Skipped ${task.citySlug}`, "hidden");
    return;
  }

  const promptStart = `City: ${formatCityName(task.citySlug)} (offers: ${task.offersCount})`;
  const prompt = `${promptStart} ${cityPrompt}`.trim();
  await delay(3000);

  const res = (await callGPT(prompt, task.citySlug, {
    model: cityModel,
  })) as { en: IDirText; ru: IDirText };

  if (!res) {
    mylog(`No response for ${task.citySlug}`, "error");
    return;
  }

  const baseId = await createDirText({
    dirText: res.en,
    key: task.citySlug,
  });
  await delay(1000);

  if (!baseId) {
    mylog(`Failed to create EN base for ${task.citySlug}`, "error");
    return;
  }

  textBoxes.push({ id: baseId, key: task.citySlug });
  mylog(`EN city base created with ID: ${baseId}`, "success");

  const ruRes = await createDirTextLocalization({
    dirText: res.ru,
    baseId,
  });

  if (ruRes) {
    mylog(`RU city localization created for ${task.citySlug}`, "success");
  } else {
    mylog(`Failed to create RU city localization for ${task.citySlug}`, "error");
  }
}

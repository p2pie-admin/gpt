import { mylog } from "../helper";
import callStrapi from "../services/callStrapi";
import { initParserFetcher } from "../services/parserFetcher";
import { selectorQuery } from "../services/queries";
import { ISelector } from "../types/selector";
import { getPms, getSlugs } from "./pms";

export default async () => {
  mylog("Starting fill_dirs...");
  const parserClient = initParserFetcher();
  const { selector } = (await callStrapi(selectorQuery)) as {
    selector: ISelector;
  };

  mylog("selector fetched successfully", "success");
  mylog(`Found ${selector.sections.length} selector sections`, "info");

  const pms = getPms(selector);
  mylog(`Found ${pms.length} pms`, "info");

  const pmCodes = Array.from(new Set(pms.map((pm) => pm.code.toUpperCase())));
  mylog("Collecting directions from possible pairs...", "info");
  const possibleDirCodes = await buildDirCodesFromPossiblePairs(
    parserClient,
    pmCodes
  );
  mylog(
    `Collected ${possibleDirCodes.length} dirs from /possible_pairs`,
    "success"
  );

  const dirCounts = await parserClient.getDirs();
  const activeDirCodes = Object.keys(dirCounts || {});
  mylog(`Fetched ${activeDirCodes.length} active dirs`, "info");

  const dirs = Array.from(
    new Set([...possibleDirCodes, ...activeDirCodes.map((dir) => dir.toUpperCase())])
  );
  mylog(`Total unique dirs to process: ${dirs.length}`, "info");

  const slugs = getSlugs(dirs, pms);
  mylog(`Found ${Object.keys(slugs).length} slugs`, "info");

  return slugs;
};

async function buildDirCodesFromPossiblePairs(
  parserClient: ReturnType<typeof initParserFetcher>,
  pmCodes: string[]
) {
  const dirs = new Set<string>();

  for (const code of pmCodes) {
    try {
      const targets = await parserClient.getPossiblePairs("give", code);
      targets?.forEach((target) => {
        if (!target) return;
        dirs.add(`${code.toUpperCase()}_${target.toUpperCase()}`);
      });
    } catch (error) {
      mylog(
        `Failed to fetch possible pairs for ${code}: ${
          (error as Error).message || error
        }`,
        "warning"
      );
    }
  }

  return Array.from(dirs);
}

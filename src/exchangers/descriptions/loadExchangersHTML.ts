import { spawn } from "child_process";
import fetch from "node-fetch"; // use axios if you prefer
import CDP from "chrome-remote-interface";

import * as fs from "fs/promises";
import { delay, mylog } from "../../helper";
import callStrapi from "../../services/callStrapi";
import { EmptyDescriptionQuery } from "../../services/queries";
import { IExchangerData } from "../../types";
import { getDomain } from "../xml/helper";
import { scrape } from "../../services/cheerio";

const BATCH_SIZE = 10; // process exchangers in small batches to allow loading

const CHROME_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const USER_DATA_DIR = "/tmp/chrome-automation"; // or "./chrome-profile"
const DEBUGGING_URL = "http://localhost:9222/json/version";
async function launchRealChrome() {
  mylog("Launching real Chrome...");

  spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=9222`,
      `--user-data-dir=${USER_DATA_DIR}`,
      `--no-first-run`,
      `--no-default-browser-check`,
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  ).unref();

  await waitForChromeToBeInteractive();
}

async function openTabs(urls: string[]) {
  const client = await CDP(); // No target specified here!

  const { Target } = client;

  for (const url of urls) {
    await Target.createTarget({ url });
    mylog(`Opened tab: ${url}`, "hidden");
  }

  await client.close();
}

async function waitForChromeToBeInteractive() {
  while (true) {
    try {
      const version = await fetch(DEBUGGING_URL).then((res) => res.json());
      const targetList = await fetch("http://localhost:9222/json/list").then(
        (res) => res.json()
      );

      const hasRealPage = targetList.some(
        (t: any) => t.type === "page" && t.url !== "about:blank"
      );

      if (hasRealPage) {
        mylog("Chrome has an active tab!", "important");
        break;
      } else {
        mylog("Waiting for Chrome tab...", "hidden");
      }
    } catch (err) {
      mylog("Waiting for Chrome to start...", "hidden");
    }

    await new Promise((res) => setTimeout(res, 1000));
  }
}

async function saveAllTabs() {
  const versionInfo = await fetch(DEBUGGING_URL).then((r) => r.json());
  const { webSocketDebuggerUrl } = versionInfo;

  const client = await CDP({ target: webSocketDebuggerUrl });
  const { Target } = client;

  const targets = await Target.getTargets();

  for (const target of targets.targetInfos) {
    if (target.type === "page" && target.url.startsWith("http")) {
      const pageClient = await CDP({ target: target.targetId });

      const { Page, Runtime } = pageClient;

      await Page.enable();

      const { result } = await Runtime.evaluate({
        expression: "document.documentElement.outerHTML",
        returnByValue: true,
      });
      if (!result.value) {
        mylog("Error: " + target.url, "error");
        return;
      }
      const content = (await scrape(
        "",
        true,
        undefined,
        result.value
      )) as string;

      const filenameSafeUrl = getDomain(target.url);

      const filename = `${filenameSafeUrl}.html`;

      await fs.writeFile(`./saved/${filename}`, content);

      mylog(`Saved: ${filename}`, "success");

      await pageClient.close();
      await Target.closeTarget({ targetId: target.targetId });
    }
  }

  await client.close();
}

async function ensureChromeAvailable() {
  try {
    await fetch(DEBUGGING_URL).then((res) => res.json());
  } catch {
    await launchRealChrome();
  }
}

export default async () => {
  // gather already-saved filenames to skip duplicates
  const savedFiles = new Set<string>(
    (await fs.readdir("./saved").catch(() => []))
      .filter((f) => f.endsWith(".html"))
      .map((f) => f.toLowerCase())
  );

  await launchRealChrome();
  const data = await callStrapi(EmptyDescriptionQuery);

  const exchangers = data.exchangers.filter(
    (e: any) => e.ref_link
  ) as IExchangerData[];
  mylog(`Exchangers without description found: ${exchangers.length}`);
  const urls = exchangers
    .map((e) => e.ref_link)
    .filter((url) => {
      const fname = `${getDomain(url)}.html`.toLowerCase();
      return !savedFiles.has(fname);
    });

  mylog(`After skipping saved files, to open: ${urls.length}`, "important");

  for (let start = 0; start < urls.length; ) {
    const batch = urls.slice(start, start + BATCH_SIZE);
    if (!batch.length) continue;

    mylog(
      `Opening batch ${start + 1}-${start + batch.length} of ${urls.length}`,
      "important"
    );

    await ensureChromeAvailable();

    try {
      await openTabs(batch);

      mylog("Waiting 10 seconds for pages to load...", "important");
      await delay(10_000);

      await saveAllTabs();
      mylog(`Saved batch ${start + 1}-${start + batch.length}`, "success");
      start += BATCH_SIZE;
    } catch (error) {
      mylog(
        `Chrome connection failed, restarting and retrying batch starting at ${
          start + 1
        }`,
        "warning"
      );
      await launchRealChrome();
      // retry same batch without incrementing start
    }
  }

  mylog("Done!", "success");
};

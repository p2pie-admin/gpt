import { promises as fs } from "fs";
import path from "path";

const OUT = path.resolve(process.cwd(), "some_data/domains/domain_candidates.txt");

const partA = [
  "us",
  "uni",
  "edu",
  "ad",
  "go",
  "pro",
  "top",
  "bos",
  "hub",
  "nav",
  "sky",
  "br",
  "nx",
  "up",
  "fit",
  "aim",
  "ace",
  "neo",
  "zen",
];

const partB = [
  "path",
  "step",
  "way",
  "map",
  "tour",
  "guide",
  "scout",
  "ment",
  "peak",
  "gate",
  "link",
  "bridge",
  "point",
  "pulse",
  "spark",
  "trail",
  "route",
  "quest",
  "boost",
];

const partC = [
  "us",
  "go",
  "pro",
  "lab",
  "ly",
  "io",
  "on",
  "up",
  "fit",
  "max",
  "jet",
  "now",
  "zen",
  "nova",
  "x",
];

const curated = [
  "ivyroute",
  "ivystep",
  "ivypath",
  "toproute",
  "topstep",
  "usadmit",
  "unigoal",
  "admitgo",
  "admitup",
  "bosroute",
  "bosstep",
  "bospath",
  "uniroute",
  "unistep",
  "studygo",
  "studyup",
  "usmentor",
  "usguide",
  "usscout",
  "uniguide",
];

function valid(name: string): boolean {
  return /^[a-z0-9-]{2,10}$/.test(name);
}

async function main(): Promise<void> {
  const set = new Set<string>();

  const add = (value: string) => {
    const name = value.toLowerCase();
    if (valid(name)) {
      set.add(name);
    }
  };

  for (const a of partA) {
    for (const b of partB) {
      add(a + b);
    }
  }

  for (const b of partB) {
    for (const c of partC) {
      add(b + c);
    }
  }

  for (const a of partA) {
    for (const c of partC) {
      add(a + c);
    }
  }

  for (const a of partA) {
    for (const b of partB) {
      for (const c of partC) {
        add(a + b + c);
      }
    }
  }

  for (const item of curated) {
    add(item);
  }

  const list = [...set].sort((x, y) => x.length - y.length || x.localeCompare(y));
  await fs.writeFile(OUT, `${list.join("\n")}\n`, "utf8");

  const maxLen = Math.max(...list.map((x) => x.length));
  console.log(`Written ${list.length} candidates to ${OUT}`);
  console.log(`Max length: ${maxLen}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { resolveTablesDir } from "..";
import { mylog } from "../../helper";
import { callGPT } from "../../services/gpt";
import fs from "fs";
import path from "path";

export const DoAction = async ({
  prompt,
  data,
  name,
  isRemake = false,
}: {
  prompt: string;
  data: any;
  name: string;
  isRemake?: boolean;
}) => {
  const outputPath = path.join(resolveTablesDir(), `${name}.json`);
  if (!isRemake && fs.existsSync(outputPath)) {
    mylog(`Action ${name.toUpperCase()} аlreadyExists ${outputPath}`, "info");
    return;
  }

  const serialized =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
  const fullPrompt = `${prompt} : ${serialized}`;
  mylog(fullPrompt.slice(0, 600), "hidden");

  const res = (await callGPT(fullPrompt, name, {
    model: "gpt-4.1-mini",
  })) as {
    info: string[];
    with_city: string[];
    no_city: string[];
  };
  await fs.promises.writeFile(outputPath, JSON.stringify(res, null, 2), "utf8");
  mylog(
    `Action ${name.toUpperCase()} completed: ${JSON.stringify(res).slice(
      0,
      100
    )}`,
    "hidden"
  );
};

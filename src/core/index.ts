import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { mylog } from "../helper";
import { addValueAndSort, groupByClaster } from "./helper";
import { DoAction } from "./actions";
import { divideInto3Groups } from "./actions/propmpts";

const DEFAULT_TABLE_FILE = "yadro.xlsx";

export const resolveTablesDir = () => {
  const localPath = path.resolve(__dirname, "tables");
  if (fs.existsSync(localPath)) return localPath;

  // Fallback for running compiled code from /build
  return path.resolve(process.cwd(), "src", "core", "tables");
};

const normalizeHeaders = (headers: unknown[]): string[] => {
  return headers.map((h, idx) => {
    if (typeof h === "string" && h.trim()) return h.trim();
    if (typeof h === "number") return `col_${idx + 1}`;
    return `col_${idx + 1}`;
  });
};

const xlsxToJson = async (
  filePath: string,
  customHeaders?: Record<string, string[]>
) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const result: Record<string, any[]> = {};

  workbook.eachSheet((worksheet) => {
    const sheetData: any[] = [];
    const sheetName = worksheet.name;

    // Decide headers: custom override -> first row -> generated col_X
    const firstRow = worksheet.getRow(1);
    const headerValues = Array.isArray(firstRow.values)
      ? firstRow.values.slice(1)
      : [];
    const headers =
      (customHeaders && customHeaders[sheetName]) ||
      normalizeHeaders(headerValues);

    // Start from the second row (data rows)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1 && (!customHeaders || !customHeaders[sheetName])) {
        return;
      }
      const values = Array.isArray(row.values) ? row.values.slice(1) : [];
      const rowObject: Record<string, any> = {};
      headers.forEach((header, idx) => {
        rowObject[header] = values[idx] ?? null;
      });
      sheetData.push(rowObject);
    });

    result[sheetName] = sheetData;
  });

  return result;
};

export const tableFormatter = async (
  fileName: string = DEFAULT_TABLE_FILE,
  columnNames?: Record<string, string[]>
): Promise<Record<string, any>> => {
  const tablesDir = resolveTablesDir();
  const sourcePath = path.join(tablesDir, fileName);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Table file not found at ${sourcePath}`);
  }

  const result = await xlsxToJson(sourcePath, columnNames);
  const outputPath = path.join(tablesDir, "yadro.json");

  const rawSemantic = (result as any)?.["Семантическое_ядро"];
  let grouped: Record<string, any[]> | null = null;

  if (Array.isArray(rawSemantic)) {
    const data = rawSemantic.map((i: any) => ({
      request: i?.["Запрос"],
      claster: i?.["Кластер"],
      wordstat: i?.["! [WS]"],
      commercial: i?.["Коммерческость"],
      difficultyTop: i?.["Сложность ТОПа"],
    }));
    grouped = groupByClaster(data);
  }

  const outputData = grouped ? addValueAndSort(grouped) : result;

  await fs.promises.writeFile(
    outputPath,
    JSON.stringify(outputData, null, 2),
    "utf8"
  );

  if (grouped) {
    await DoAction({
      data: Object.keys(grouped),
      prompt: divideInto3Groups,
      name: "divide",
      isRemake: true,
    });
  } else {
    mylog(
      "Семантическое_ядро sheet not found or invalid, wrote raw xlsxToJson result",
      "warning"
    );
  }

  return outputData;
};

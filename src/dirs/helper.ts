import { TextBoxKey } from "../types";

export const checkIfBothLocalesExist = (
  ruTextBoxes: TextBoxKey[],
  enTextBoxes: TextBoxKey[]
) => {
  console.log(`📔 Found ${ruTextBoxes.length} RU textBoxes`);
  console.log(`📔 Found ${enTextBoxes.length} EN textBoxes`);

  // 1. Check for duplicates in RU
  const ruKeyCounts = ruTextBoxes.reduce<Record<string, number>>((acc, tb) => {
    const key = tb.key.trim();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const ruDuplicates = Object.entries(ruKeyCounts)
    .filter(([_, count]) => count > 1)
    .map(([key]) => key);

  if (ruDuplicates.length) {
    console.log("⚠️ Duplicate keys in RU:", ruDuplicates);
  }

  // 2. Check for duplicates in EN
  const enKeyCounts = enTextBoxes.reduce<Record<string, number>>((acc, tb) => {
    const key = tb.key.trim();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const enDuplicates = Object.entries(enKeyCounts)
    .filter(([_, count]) => count > 1)
    .map(([key]) => key);

  if (enDuplicates.length) {
    console.log("⚠️ Duplicate keys in EN:", enDuplicates);
  }

  // 3. Normalize keys for comparison (trim + lowercase)
  const normalize = (key: string) => key.trim().toLowerCase();
  const ruKeys = new Set(ruTextBoxes.map((tb) => normalize(tb.key)));
  const enKeys = new Set(enTextBoxes.map((tb) => normalize(tb.key)));

  const allKeys = new Set([...ruKeys, ...enKeys]);

  const missingInRu: string[] = [];
  const missingInEn: string[] = [];

  allKeys.forEach((key) => {
    const hasRu = ruKeys.has(key);
    const hasEn = enKeys.has(key);
    if (!hasRu) missingInRu.push(key);
    if (!hasEn) missingInEn.push(key);
  });

  if (missingInRu.length) {
    console.log("❌ Keys missing in RU:", missingInRu);
  }
  if (missingInEn.length) {
    console.log("❌ Keys missing in EN:", missingInEn);
  }

  if (!missingInRu.length && !missingInEn.length) {
    console.log("✅ All keys exist in both locales.");
  }
};

import codesToNames from "./codesToNames";

interface ICityRecord {
  codes: string[];
  ru_name: string;
  [key: string]: any;
}

export function splitReadable(word: string): string {
  // --- 1️⃣ Транслитерация кириллицы ---
  const translitMap: Record<string, string> = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "kh",
    ц: "ts",
    ч: "ch",
    ш: "sh",
    щ: "shch",
    ы: "y",
    э: "e",
    ю: "yu",
    я: "ya",
    ъ: "",
    ь: "",
    А: "A",
    Б: "B",
    В: "V",
    Г: "G",
    Д: "D",
    Е: "E",
    Ё: "E",
    Ж: "Zh",
    З: "Z",
    И: "I",
    Й: "Y",
    К: "K",
    Л: "L",
    М: "M",
    Н: "N",
    О: "O",
    П: "P",
    Р: "R",
    С: "S",
    Т: "T",
    У: "U",
    Ф: "F",
    Х: "Kh",
    Ц: "Ts",
    Ч: "Ch",
    Ш: "Sh",
    Щ: "Shch",
    Ы: "Y",
    Э: "E",
    Ю: "Yu",
    Я: "Ya",
    Ъ: "",
    Ь: "",
  };

  word = word.replace(/[А-яЁё]/g, (char) => translitMap[char] ?? "");

  // --- 2️⃣ Разбиваем если нет пробелов или дефиса ---
  if (!/[\s-]/.test(word)) {
    word = word
      .replace(/([A-Z]+)(?=[A-Z][a-z]|[0-9]|$)/g, " $1")
      .replace(/([0-9]+)/g, " $1 ")
      .replace(/([a-z])([A-Z])/g, (_, p1, p2) => `${p1} ${p2.toUpperCase()}`)
      .replace(/\s+/g, " ")
      .trim();
  }

  // --- 3️⃣ Фильтруем недопустимые символы ---
  word = word.replace(/[^A-Za-z0-9\s-]/g, "");

  // --- 4️⃣ CapitalCase для слов и частей с дефисом ---
  let words = word.split(" ").map((w) => {
    if (w.includes("-")) {
      return w
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("-");
    }
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  });

  // --- 5️⃣ Если слово короче 2 букв, присоединяем к следующему ---
  const mergedWords: string[] = [];
  for (let i = 0; i < words.length; i++) {
    if (words[i].length < 2 && i < words.length - 1) {
      mergedWords.push(words[i] + words[i + 1]);
      i++;
    } else {
      mergedWords.push(words[i]);
    }
  }

  return mergedWords.join("-").trim();
}

export function mapCityCodesToNames(
  cities: ICityRecord[],
  mapping: Record<string, string> = codesToNames
): ICityRecord[] {
  // Align first code with the key that corresponds to the current ru_name.
  const nameToCode = new Map<string, string>();
  for (const [code, name] of Object.entries(mapping)) {
    const normalized = name.toLowerCase();
    if (!nameToCode.has(normalized)) {
      nameToCode.set(normalized, code);
    }
  }

  return cities.map((city) => {
    if (!Array.isArray(city.codes) || city.codes.length === 0) {
      return city;
    }

    const desiredCode = nameToCode.get(city.ru_name.toLowerCase());
    let nextCodes = [...city.codes];
    if (desiredCode) {
      if (nextCodes[0] !== desiredCode) {
        const filtered = nextCodes.filter((code) => code !== desiredCode);
        nextCodes = [desiredCode, ...filtered];
      }
    }

    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const code of nextCodes) {
      if (typeof code !== "string") {
        continue;
      }
      if (seen.has(code)) {
        continue;
      }
      seen.add(code);
      deduped.push(code);
    }

    const changed =
      deduped.length !== city.codes.length ||
      deduped.some((code, idx) => city.codes[idx] !== code);

    return changed
      ? {
          ...city,
          codes: deduped,
        }
      : city;
  });
}

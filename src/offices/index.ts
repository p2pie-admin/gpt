import { readFileSync } from "fs";
import axios from "axios";
import { delay, mylog } from "../helper";
import callStrapi from "../services/callStrapi";
import {
  CreateOfficeMutation,
  ExchangersForMergeQuery,
  OfficesQuery,
} from "../services/queries";
import officesSeed from "../../some_data/kirill_offices";

const CRATION_LIMIT = 1000;

type OfficeSeed = {
  address: string;
  cityCode: string;
  rates_link?: string;
  ref_link?: string;
};

type CityRecord = {
  codes?: string[];
  code?: string;
  ru_name?: string;
  en_name?: string;
  coordinates?: number[];
};

type ExchangerRecord = {
  id: string;
  name?: string;
  rates_link?: string | null;
  ref_link?: string | null;
  exchanger_card?: {
    working_time?: string | null;
    ru_description?: string | null;
  };
};

const loadCities = (): CityRecord[] => {
  const raw = readFileSync("some_data/cities.JSON", "utf-8");
  return JSON.parse(raw) as CityRecord[];
};

const buildCityIndex = (cities: CityRecord[]) => {
  const map = new Map<string, CityRecord>();
  cities.forEach((city) => {
    const codes = new Set<string>();
    (city.codes || []).forEach((code) => {
      if (typeof code === "string") {
        const cleaned = code.trim();
        if (cleaned) codes.add(cleaned.toUpperCase());
      }
    });
    if (typeof city.code === "string") {
      const cleaned = city.code.trim();
      if (cleaned) codes.add(cleaned.toUpperCase());
    }
    codes.forEach((code) => map.set(code, city));
  });
  return map;
};

const buildExistingAddresses = async () => {
  const res = await callStrapi(OfficesQuery);
  const list = ((res?.offices as any[]) || []).map((office) => {
    const addr = office?.address || office?.attributes?.address;
    return typeof addr === "string" ? addr.trim().toLowerCase() : "";
  });

  return new Set(list.filter(Boolean));
};

const normalizeLink = (value?: string | null) =>
  typeof value === "string" ? value.trim() : "";

const normalizeForCompare = (
  value?: string | null,
  ensureProtocol: boolean = false
) => {
  let normalized = normalizeLink(value);
  if (!normalized) return "";

  if (ensureProtocol && !/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }

  normalized = normalized.replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
  return normalized.toLowerCase();
};

const findExchangerByLinks = (
  office: OfficeSeed,
  exchangers: ExchangerRecord[]
): ExchangerRecord | undefined => {
  const ref = normalizeForCompare(office.ref_link);
  if (ref) {
    const byRef = exchangers.find(
      (exchanger) => normalizeForCompare(exchanger.ref_link) === ref
    );
    if (byRef) return byRef;
  }

  const rates = normalizeForCompare(office.rates_link, true);
  if (rates) {
    const byRates = exchangers.find(
      (exchanger) => normalizeForCompare(exchanger.rates_link, true) === rates
    );
    if (byRates) return byRates;
  }

  return undefined;
};

const geocodeAddress = async (
  address: string,
  cityName?: string
): Promise<string | null> => {
  const apiKey = process.env.GOOGLE_MAPS_KEY;
  if (!apiKey) {
    mylog("GOOGLE_MAPS_KEY is missing, skip geocoding", "warning");
    return null;
  }

  const query = [address, cityName].filter(Boolean).join(", ");
  mylog(`Geocoding "${query}"`, "info");
  try {
    const { data } = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address: query,
          key: apiKey,
        },
        timeout: 10000,
      }
    );

    const location = data?.results?.[0]?.geometry?.location as
      | { lat: number; lng: number }
      | undefined;
    if (
      data?.status === "OK" &&
      typeof location?.lat === "number" &&
      typeof location?.lng === "number"
    ) {
      mylog(
        `Geocoding success for "${query}" -> ${location.lat},${location.lng}`,
        "success"
      );
      return `${location.lat},${location.lng}`;
    }

    const errorMessage =
      data?.error_message || data?.errorMessage || "no error message";
    mylog(
      `Geocoding failed for "${query}" (${data?.status || "no status"}): ${errorMessage}`,
      "warning"
    );
  } catch (error: any) {
    mylog(
      `Geocoding error for "${query}": ${error?.message || "unknown error"}`,
      "warning"
    );
  }

  return null;
};

export default async function createOffices() {
  const cities = loadCities();
  const cityByCode = buildCityIndex(cities);

  const data = await callStrapi(ExchangersForMergeQuery);
  const exchangers = (data?.exchangers || []) as ExchangerRecord[];
  const existingAddresses = await buildExistingAddresses();

  const tasks = (officesSeed as OfficeSeed[]).slice(0, CRATION_LIMIT);
  mylog(`Processing ${tasks.length} offices (limit: ${CRATION_LIMIT})`, "info");

  for (const [index, office] of tasks.entries()) {
    await delay(500);

    if (!office.cityCode) {
      mylog(`Missing cityCode for office ${office.address}`, "warning");
      continue;
    }

    const city = cityByCode.get(office.cityCode.toUpperCase());
    if (!city) {
      mylog(
        `City not found for code ${office.cityCode} (index ${index})`,
        "warning"
      );
      continue;
    }

    const exchanger = findExchangerByLinks(office, exchangers);
    if (!exchanger) {
      mylog(`Exchanger not found for office ${office.address}`, "warning");
      continue;
    }

    const normalizedAddress = office.address.trim().toLowerCase();
    if (existingAddresses.has(normalizedAddress)) {
      mylog(`Office already exists: ${office.address}`, "warning");
      continue;
    }

    const cityName =
      typeof city.en_name === "string"
        ? city.en_name.toLowerCase()
        : typeof city.ru_name === "string"
        ? city.ru_name.toLowerCase()
        : office.cityCode.toLowerCase();
    const coordinatesFromAddress = await geocodeAddress(
      office.address,
      cityName
    );

    const coordinates = coordinatesFromAddress || null;
    if (coordinatesFromAddress) {
      mylog(
        `Using geocoded coordinates for "${office.address}": ${coordinates}`,
        "info"
      );
    } else {
      mylog(
        `No geocoded coordinates for "${office.address}", saving coordinates as null`,
        "info"
      );
    }

    const payload: Record<string, any> = {
      address: office.address,
      city: cityName,
      visible: true,
      coordinates,
      working_time: exchanger.exchanger_card?.working_time || null,
      exchanger: exchanger.id,
    };

    try {
      const res = await callStrapi(CreateOfficeMutation, { data: payload });
      const createdId =
        (res as any)?.createOffice?.id ||
        (res as any)?.createOffice?.data?.id ||
        (res as any)?.createOffice?.[0]?.id;

      if (createdId) {
        mylog(
          `Created office #${createdId} for ${
            exchanger.name || "exchanger"
          } at ${office.address}`,
          "success"
        );
      } else {
        mylog(
          `Office created for ${office.address} (response without id)`,
          "warning"
        );
      }
    } catch (error) {
      mylog(`Failed to create office at ${office.address}`, "error");
      console.error(error);
    }
  }

  mylog("create_offices finished", "important");
}

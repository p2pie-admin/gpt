import axios, { AxiosInstance } from "axios";
import { ICity, IParserSetting } from "../types/exchange";
import {
  CryptoRate,
  CreateReviewResponse,
  ExampleEntry,
  IExchanger,
  IExchangerStats,
  IMemoryUsage,
  IParserErrorMap,
  IRate,
  ISelectorCountry,
  JsonBodyRequest,
  NonEmptyCitiesResponse,
  PossiblePairsSide,
  TopResponse,
  IReview,
} from "../types/parser";

type DirType = "all" | "part";

export interface ParserClientOptions {
  baseURL?: string;
}

export class ParserClient {
  private readonly http: AxiosInstance;

  constructor(baseURL: string) {
    this.http = axios.create({
      baseURL,
      timeout: 10000,
    });
  }

  private async get<T>(path: string): Promise<T> {
    const { data } = await this.http.get<T>(path);
    return data;
  }

  private async post<T>(path: string, payload?: unknown): Promise<T> {
    const { data } = await this.http.post<T>(path, payload);
    return data;
  }

  async getExample(): Promise<ExampleEntry[]> {
    return this.get<ExampleEntry[]>("/example");
  }

  async createReply(body: JsonBodyRequest): Promise<{ status: "ok" }> {
    return this.post<{ status: "ok" }>("/createReply", body);
  }

  async createReview(body: Partial<IReview>): Promise<CreateReviewResponse> {
    return this.post<CreateReviewResponse>("/createReview", body);
  }

  async getDirRates(
    code: string,
    options?: { type?: DirType; city?: string }
  ): Promise<IRate[]> {
    const normalizedCode = encodeURIComponent(code.toUpperCase());
    const dirType = encodeURIComponent(options?.type ?? "all");
    const citySuffix = options?.city
      ? `/${encodeURIComponent(options.city)}`
      : "";
    return this.get<IRate[]>(
      `/dir=${normalizedCode}/${dirType}${citySuffix}`
    );
  }

  async getTopCodes(): Promise<string[]> {
    return this.get<string[]>("/top_codes");
  }

  async getAllPmCodes(): Promise<string[][]> {
    return this.get<string[][]>("/all_pm_codes_that_exist");
  }

  async getAlternativePmCodes(): Promise<string> {
    return this.get<string>("/alternative_pm_codes");
  }

  async getParserSetting(): Promise<IParserSetting> {
    return this.get<IParserSetting>("/parser_setting");
  }

  async getExchangers(): Promise<Record<string, IExchanger>> {
    return this.get<Record<string, IExchanger>>("/exchangers");
  }

  async getExchanger(
    idOrName: string
  ): Promise<IExchanger | Record<string, never> | string> {
    return this.get<IExchanger | Record<string, never> | string>(
      `/exchanger=${encodeURIComponent(idOrName)}`
    );
  }

  async getErrors(): Promise<IParserErrorMap> {
    return this.get<IParserErrorMap>("/errors");
  }

  async getExchangerStats(): Promise<IExchangerStats> {
    return this.get<IExchangerStats>("/exchanger_stats");
  }

  async getStats(): Promise<Record<string, unknown>> {
    return this.get<Record<string, unknown>>("/stats");
  }

  async getMemoryUsage(): Promise<IMemoryUsage> {
    return this.get<IMemoryUsage>("/stats/memory_usage");
  }

  async getCitySelector(): Promise<ISelectorCountry[]> {
    return this.get<ISelectorCountry[]>("/city_selector");
  }

  async getCitySelectorByDir(dir: string): Promise<ISelectorCountry[]> {
    return this.get<ISelectorCountry[]>(
      `/city_selector=${encodeURIComponent(dir.toUpperCase())}`
    );
  }

  async getCities(): Promise<ICity[]> {
    return this.get<ICity[]>("/cities");
  }

  async getCityByName(name: string): Promise<ICity | null> {
    return this.get<ICity | null>(`/city=${encodeURIComponent(name)}`);
  }

  async getNonEmptyCities(): Promise<NonEmptyCitiesResponse> {
    return this.get<NonEmptyCitiesResponse>("/non_empty_cities");
  }

  async getDirs(): Promise<Record<string, number>> {
    return this.get<Record<string, number>>("/dirs");
  }

  async getPossiblePairs(
    side: PossiblePairsSide,
    code: string
  ): Promise<string[]> {
    return this.get<string[]>(
      `/possible_pairs/${encodeURIComponent(
        side
      )}/${encodeURIComponent(code.toUpperCase())}`
    );
  }

  async getSimilarDirs(
    dirs: string[]
  ): Promise<Array<[number, number] | null>> {
    const payload = dirs
      .map((dir) => encodeURIComponent(dir.toUpperCase()))
      .join(",");
    return this.get<Array<[number, number] | null>>(`/similar/dirs=${payload}`);
  }

  async getTop(): Promise<TopResponse> {
    return this.get<TopResponse>("/top");
  }

  async getCryptoRates(
    code: string,
    currency: string,
    side: PossiblePairsSide
  ): Promise<CryptoRate[]> {
    return this.get<CryptoRate[]>(
      `/crypto=${encodeURIComponent(code.toUpperCase())}/${encodeURIComponent(
        currency.toUpperCase()
      )}/${encodeURIComponent(side)}`
    );
  }
}

export const initParserFetcher = (
  options?: ParserClientOptions
): ParserClient => {
  const baseURL = options?.baseURL ?? process.env.PARSER_URL;
  if (!baseURL) {
    throw new Error("PARSER_URL is not defined in the environment variables.");
  }
  return new ParserClient(baseURL);
};

export type { NonEmptyCitiesResponse };

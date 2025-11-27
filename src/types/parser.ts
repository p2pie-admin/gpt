export interface Limit {
  give?: number;
  get?: number;
}

export interface CityRate {
  rate?: number;
  min?: Limit;
  max?: Limit;
}

export interface IRate {
  exchangerId?: string;
  name: string;
  display_name?: string;
  tag?: string;
  admin_rating?: number;
  course: number;
  parameterCodes: string[];
  min?: Limit;
  max?: Limit;
  reserve?: Limit;
  cityRates?: Record<string, CityRate>;
  ref_link?: string;
  last_time_updated?: number;
  [key: string]: unknown;
}

export interface IExchanger {
  id: string;
  name: string;
  display_name?: string;
  status?: string;
  rates_link?: string;
  ref_link?: string;
  tag?: string;
  logo?: { url: string; alternativeText?: string };
  total_rates?: number;
  admin_rating?: number;
  info?: Record<string, unknown>;
  warnings?: Record<string, string>;
  [key: string]: unknown;
}

export type NonEmptyCitiesResponse = Record<string, Record<string, number>>;

export interface IParserErrorMap {
  [dir: string]: string[];
}

export interface IExchangerStatsEntry {
  lastSuccessTs?: number;
  errorsToday?: number;
  [key: string]: unknown;
}

export type IExchangerStats = Record<string, IExchangerStatsEntry>;

export interface IMemoryUsage {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external?: number;
  arrayBuffers?: number;
  [key: string]: number | undefined;
}

export interface ISelectorCity {
  en_name: string;
  ru_name?: string;
  population?: number;
  totalCityRates: number;
}

export interface ISelectorCountry {
  en_country_name: string;
  ru_country_name?: string;
  weight: number;
  cities: ISelectorCity[];
}

export type PossiblePairsSide = "give" | "get";

export interface IReview {
  text: string;
  exchangerId: string;
  fingerprint: string;
  type?: string;
  isDispute?: boolean;
  userAgent?: string;
  location?: string;
  honeypot?: string;
  source?: string;
}

export interface ReviewMutationInput {
  text: string;
  exchangerId: string;
  fingerprint: string;
  type?: string;
  isDispute?: boolean;
  userAgent?: string;
  location?: string;
  honeypot?: string;
  ip?: string;
  ai_data?: Record<string, unknown>;
  isApproved?: boolean;
  source?: string;
}

export interface CreateReviewSuccess {
  status: "ok";
}

export interface CreateReviewError {
  status: "error";
  message: string;
  code?: string;
}

export type CreateReviewResponse = CreateReviewSuccess | CreateReviewError;

export type JsonBodyRequest = Record<string, unknown>;

export interface BestRate {
  exchangerId?: string;
  course: number;
  fiat: string;
}

export type TopResponse = Record<string, { buy: BestRate[]; sell: BestRate[] }>;

export interface CryptoRate {
  exchangerId?: string;
  name: string;
  display_name?: string | null;
  admin_rating?: number | null;
  logo?: { url: string; alternativeText?: string | null };
  course: number;
  parameterCodes: string[];
  ref_link?: string;
  last_time_updated?: number;
  min?: Limit | null;
  max?: Limit | null;
  codes: string[];
}

export interface ExampleEntry {
  key: string;
  sample: unknown;
}

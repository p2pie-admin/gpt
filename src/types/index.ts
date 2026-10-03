export interface IPrompt {
  code: string;
  description: string;
}

export interface IDB {
  jwt: string;
  prompts: string[];
}

export interface IArticleGPT {
  ru: IArticleData;
  en: IArticleData;
}

export interface IArticleData {
  header: string;
  subheader: string;
  seo_title: string
  seo_description: string
  stats: { [key: string]: number };
  chapters: {
    title: string;
    text: string;
  }[];
}

export interface IDescriptionData {
  en_description?: string;
  ru_description?: string;
  email?: string;
  telegram?: string;
  working_time?: string;
  partners?: string[];
}

export interface IExchangerMonitoring {
  id?: string;
  link?: string | null;
  monitoring?: { id: string; name?: string };
}

export interface IExchangerData {
  id: string;
  name: string;
  rates_link: string;
  ref_link: string;
  status?: string;
  display_name?: string;
   telegram?: string;
   email?: string;
   working_time?: string;
   admin_rating?: number | null;
  logo?: {
    id?: string;
    name?: string;
    alternativeText?: string;
    url?: string;
  };
  exchanger_card?: {
    telegram?: string;
    email?: string;
    phone_number?: string;
    ru_description?: string;
    en_description?: string;
    working_time?: string;
  };
  admin_comment?: string;
  monitorings?: IExchangerMonitoring[];
}

export interface IScrapedBC {
  name: string;
  display_name?: string;
  link?: string;
  link_best?: string;
  link_kurs?: string;
  link_sumo?: string;
  email?: string;
  phone_number?: string;
  telegram?: string;
  card?: string;
  real_link?: string;
  xml?: string;
}

export interface IDirText {
  header: string;
  subheader: string;
  text: string;
  seo_description: string;
  seo_title: string;
}

export type TextBoxKey = { id: string; key: string };

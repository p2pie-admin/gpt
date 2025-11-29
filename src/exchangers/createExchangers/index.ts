import { readFileSync } from "fs";
import { IExchangerData, IScrapedBC } from "../../types";
import callStrapi from "../../services/callStrapi";
import {
  CreateExchangerBC,
  LinksQuery,
  MonitoringByNameQuery,
  UpdateExchangerMonitorings,
} from "../../services/queries";
import { delay, mylog } from "../../helper";
import { generateRating } from "../descriptions/helper";

const buildBestchangeLink = (link?: string | null) => {
  if (!link) return null;
  return link.startsWith("http")
    ? link
    : `https://www.bestchange.ru${link.startsWith("/") ? "" : "/"}${link}`;
};

const isFilled = (value?: string | null) =>
  typeof value === "string" ? value.trim() !== "" : Boolean(value);

const fetchMonitoringId = async (name: string) => {
  const monitoringData = await callStrapi(MonitoringByNameQuery, { name });
  const id = monitoringData?.monitorings?.[0]?.id?.toString();
  if (!id) {
    mylog(`Monitoring "${name}" not found`, "warning");
  }
  return id;
};

export const createExchangers = async () => {
  await delay(300);
  let exist = 0;
  const data = await callStrapi(LinksQuery);
  const exData = data.exchangers.filter(
    (e: any) => e.ref_link
  ) as IExchangerData[];

  const monitoringNames = {
    best: "BestChange",
    sumo: "ExchangeSumo",
    kurs: "KursExpert",
  };

  const [bestMonitoringId, sumoMonitoringId, kursMonitoringId] =
    await Promise.all([
      fetchMonitoringId(monitoringNames.best),
      fetchMonitoringId(monitoringNames.sumo),
      fetchMonitoringId(monitoringNames.kurs),
    ]);

  const adminComment = process.env.ADMIN_COMMENT;

  const bc = JSON.parse(readFileSync("bc-xml.json", "utf-8")) as IScrapedBC[];

  for (const [index, exchanger] of bc.entries()) {
    await delay(600);
    const {
      name,
      display_name,
      real_link,
      xml,
      link_best,
      link_kurs,
      link_sumo,
      email,
      phone_number,
      telegram,
      card,
    } = exchanger;

    const bestLink = buildBestchangeLink(link_best || card);
    const monitoringCandidates = [
      { id: bestMonitoringId, link: bestLink },
      { id: sumoMonitoringId, link: link_sumo },
      { id: kursMonitoringId, link: link_kurs },
    ].filter(
      (m) => isFilled(m.id) && isFilled(m.link)
    ) as { id: string; link: string }[];

    const contactData: Record<string, string> = {};
    if (isFilled(telegram)) contactData.telegram = telegram!;
    if (isFilled(email)) contactData.email = email!;
    if (isFilled(phone_number)) contactData.phone_number = phone_number!;

    const exists = exData.filter((e) => {
      const match =
        e.ref_link === real_link ||
        e.rates_link === xml ||
        e.name.toLowerCase() == name.toLowerCase();
      return match;
    });

    if (exists.length) {
      exist += 1;
      const existing = exists[0];

      const existingMonitorings =
        existing.monitorings
          ?.map((m) => ({
            __typename: "ComponentExchangerMonitoring",
            link: m.link,
            monitoring: m.monitoring?.id,
          }))
          .filter((m) => m.monitoring) || [];

      const monitoringSet = new Set(
        existingMonitorings
          .map((m) => m.monitoring)
          .filter(Boolean)
          .map((id) => id?.toString())
      );

      const targetMonitoringIds = new Set(
        monitoringCandidates.map((m) => m.id.toString())
      );

      // Keep other monitorings intact, replace or add our targets
      const preservedMonitorings = existingMonitorings.filter(
        (m) => m.monitoring && !targetMonitoringIds.has(m.monitoring.toString())
      );

      for (const candidate of monitoringCandidates) {
        preservedMonitorings.push({
          __typename: "ComponentExchangerMonitoring",
          link: candidate.link,
          monitoring: candidate.id,
        });
      }

      const updateData: any = {};
      if (monitoringCandidates.length) {
        updateData.monitorings = preservedMonitorings;
      }
      if (isFilled(display_name)) {
        updateData.display_name = display_name;
      }
      if (Object.keys(contactData).length) {
        updateData.exchanger_card = contactData;
      }
      if (isFilled(real_link)) {
        updateData.ref_link = real_link;
      }
      if (isFilled(xml)) {
        updateData.rates_link = xml;
      }

      const adminCommentParts: string[] = [];
      if (adminComment) adminCommentParts.push(adminComment);

      if (isFilled(existing.rates_link) && isFilled(xml) && existing.rates_link !== xml) {
        adminCommentParts.push(`старая xml была: ${existing.rates_link}`);
      }

      if (adminCommentParts.length) {
        updateData.admin_comment = adminCommentParts.join(" | ");
      }

      if (Object.keys(updateData).length) {
        await callStrapi(UpdateExchangerMonitorings, {
          id: existing.id,
          data: updateData,
        });
        mylog(`Updated existing ${name}`, "success");
      }

      mylog(`${bc.length - index} Exists: ${name}`, "hidden");
      continue;
    }

    // If any exchanger shares ref_link or rates_link, skip creation entirely
    const refOrXmlExists = exData.some(
      (e) => (real_link && e.ref_link === real_link) || (xml && e.rates_link === xml)
    );
    if (refOrXmlExists) {
      mylog(`${bc.length - index} Skipped create (duplicate ref/xml): ${name}`, "warning");
      continue;
    }

    const data: any = {
      name,
      status: "draft",
      admin_rating: generateRating(),
    };

    if (isFilled(display_name)) data.display_name = display_name;
    if (isFilled(xml)) data.rates_link = xml;
    if (isFilled(real_link)) data.ref_link = real_link;

    if (monitoringCandidates.length) {
      data.monitorings = monitoringCandidates.map((m) => ({
        __typename: "ComponentExchangerMonitoring",
        link: m.link,
        monitoring: m.id,
      }));
    }

    const adminCommentParts: string[] = [];
    if (adminComment) adminCommentParts.push(adminComment);
    if (adminCommentParts.length) {
      data.admin_comment = adminCommentParts.join(" | ");
    }
    if (Object.keys(contactData).length) {
      data.exchanger_card = contactData;
    }

    await callStrapi(CreateExchangerBC, { data })
      .then(() => {
        mylog(`${bc.length - index} Created ${name}`, "hidden");
      })
      .catch((err) => {
        mylog(`Failed to create ${name}: ${err}`, "error");
      });
  }
  mylog("FINISHED", "important");
  mylog(
    `Exists: ${exist}, New: ${bc.length - exist}, Total: ${
      bc.length - exist + exData.length
    }`
  );
};

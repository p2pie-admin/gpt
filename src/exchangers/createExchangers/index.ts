import { readFileSync } from "fs";
import { IExchangerData, IScrapedBC } from "../../types";
import callStrapi from "../../services/callStrapi";
import {
  CreateExchangerBC,
  LinksQuery,
  MonitoringByNameQuery,
} from "../../services/queries";
import { delay, mylog } from "../../helper";
import { generateRating } from "../descriptions/helper";

export const createExchangers = async () => {
  await delay(1500);
  let exist = 0;
  const data = await callStrapi(LinksQuery);
  const exData = data.exchangers.filter(
    (e: any) => e.ref_link
  ) as IExchangerData[];

  const monitoringName = "BestChange";
  const monitoringData = await callStrapi(MonitoringByNameQuery, {
    name: monitoringName,
  });
  const monitoringId = monitoringData?.monitorings?.[0]?.id;

  if (!monitoringId) {
    mylog(`Monitoring "${monitoringName}" not found`, "error");
    return;
  }

  const bc = JSON.parse(readFileSync("bc-xml.json", "utf-8")) as IScrapedBC[];

  for (const [index, exchanger] of bc.entries()) {
    const { name, real_link, xml, card } = exchanger;
    const exists = exData.filter((e) => {
      const match =
        e.ref_link === real_link ||
        e.rates_link === xml ||
        e.name.toLowerCase() == name.toLowerCase();
      return match;
    });

    if (exists.length) {
      exist += 1;
      mylog(`${bc.length - index} Exists: ${name}`, "hidden");
      continue;
    }

    const data = {
      name,
      status: "draft",
      rates_link: xml || null,
      ref_link: real_link,
      admin_rating: generateRating(),
      monitorings:
        card && monitoringId
          ? [
              {
                __typename: "ComponentExchangerMonitoring",
                link: card,
                monitoring: monitoringId,
              },
            ]
          : [],
    };

    await callStrapi(CreateExchangerBC, data).then(() => {
      mylog(`${bc.length - index} Created ${name}`, "hidden");
    });
  }
  mylog("FINISHED", "important");
  mylog(
    `Exists: ${exist}, New: ${bc.length - exist}, Total: ${
      bc.length - exist + exData.length
    }`
  );
};

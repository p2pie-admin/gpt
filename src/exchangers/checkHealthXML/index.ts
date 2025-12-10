import callStrapi from "../../services/callStrapi";
import {
  ExchangerAdminComment,
  ExchangerByName,
  LinksQuery,
  UpdateExchangerMonitorings,
} from "../../services/queries";
import { IExchangerData, IScrapedBC } from "../../types";

import { mylog } from "../../helper";

const logDuplicateLinks = (exchangers: IExchangerData[]) => {
  type Key = "ref_link" | "rates_link";
  const logForKey = (key: Key) => {
    const map = new Map<string, { id: string | number; name: string }[]>();
    for (const ex of exchangers) {
      const value = ex[key];
      if (!value) continue;
      const list = map.get(value) || [];
      list.push({ id: ex.id, name: ex.name });
      map.set(value, list);
    }

    for (const [value, list] of map.entries()) {
      if (list.length < 2) continue;
      const ids = list.map((i) => i.id).join(", ");
      const names = list.map((i) => i.name).join(", ");
      console.log(
        `[DUPLICATE ${key}] value "${value}" shared by ids: [${ids}] (names: [${names}])`
      );
    }
  };

  logForKey("ref_link");
  logForKey("rates_link");
};

export const AddComment = async (name: string, text: string) => {
  if (!text) return;

  const data = await callStrapi(ExchangerByName, { name });
  const exchanger = data?.exchangers?.[0];
  if (!exchanger?.id) {
    mylog(`No exchanger found for comment: ${name}`, "warning");
    return;
  }

  let current = "";
  const commentData = await callStrapi(ExchangerAdminComment, {
    id: exchanger.id,
  });

  current = commentData?.exchanger?.admin_comment || "";
  const admin_comment = `${current}${text}`;

  const res = await callStrapi(UpdateExchangerMonitorings, {
    id: exchanger.id,
    data: { admin_comment },
  });
  if (res === undefined) {
    mylog(`Failed to add comment for ${name}`, "warning");
  }
};

export const checkHealthXML = async () => {
  const data = await callStrapi(LinksQuery);
  const exData = data.exchangers as IExchangerData[];

  // Log any exchangers that share the same ref_link or rates_link before health checks
  logDuplicateLinks(exData);

  let healthyLink = [] as string[];
  let unhealthyLink = [] as string[];
  let healthyXML = [] as string[];
  let accessibleXML = [] as string[];
  let unhealthyXML = [] as string[];
  let errors = [] as string[];

  for (const [index, exchanger] of exData.entries()) {
    // mylog(`Checking ${index} out of ${exchangerLinks.length} ...`, "info");
    const xml = exchanger?.rates_link;
    const link = exchanger?.ref_link;
    if (!xml) continue;
    if (!link) continue;

    if (!(index % 12)) {
      mylog(`____ ____ ____ ____`, "hidden");
      mylog(`XML ${unhealthyXML.length}`, "error");
      mylog(`XML ${accessibleXML.length}`, "warning");
      mylog(`XML ${healthyXML.length}`, "success");
      mylog(`____ ____ ____ ____`, "hidden");
      mylog(`Link ${unhealthyLink.length}`, "error");
      mylog(`Link ${healthyLink.length}`, "success");
      mylog(`____ ____ ____ ____`, "hidden");
      mylog(`total checked ${index}`);
      mylog(`total links ${exData.length}`);
      mylog(`errors ${errors.length}`, "error");
      mylog(`____ ____ ____ ____`, "hidden");
    }

    try {
      let responseXML = await fetch(xml, { method: "HEAD" });
      let responseLink = await fetch(link, { method: "GET" });

      if (responseLink.ok) {
        const contentType = responseLink.headers.get("content-type") || "";
        if (/html/i.test(contentType)) {
          healthyLink = [...healthyLink, link];
        } else {
          unhealthyLink = [...unhealthyLink, link];
          await AddComment(exchanger.name, "\n ссылка на сайт сломана");
        }
      } else {
        unhealthyLink = [...unhealthyLink, link];
        await AddComment(exchanger.name, "\n ссылка на сайт сломана");
      }
      if (responseXML.ok) {
        const contentType = responseXML.headers.get("content-type") || "";

        if (/xml/.test(contentType)) {
          healthyXML = [...healthyXML, xml];
          mylog(xml, "success");
          continue;
        }
        accessibleXML = [...accessibleXML, xml];
        mylog(xml, "warning");
        await AddComment(exchanger.name, "\n xml подозрительная");
        continue;
      }

      unhealthyXML = [...unhealthyXML, xml];
      mylog(xml, "error");
      await AddComment(exchanger.name, "\n xml сломана");
    } catch (error) {
      errors = [...errors, xml || link];
      mylog(xml || link, "error");
      const parts: string[] = [];
      if (xml) parts.push("\n xml сломана");
      if (link) parts.push("\n ссылка на сайт сломана");
      if (parts.length) {
        await AddComment(exchanger.name, parts.join(""));
      }
      continue;
    }
  }
  mylog("-- FINISHED --", "important");
  mylog(`____ ____ ____ ____`, "hidden");
  mylog(`XML ${unhealthyXML.length}`, "error");
  mylog(`XML ${accessibleXML.length}`, "warning");
  mylog(`XML ${healthyXML.length}`, "success");
  mylog(`____ ____ ____ ____`, "hidden");
  mylog(`Link ${unhealthyLink.length}`, "error");
  mylog(`Link ${healthyLink.length}`, "success");
  mylog(`____ ____ ____ ____`, "hidden");
  mylog(`total links ${exData.length}`);
  mylog(`____ ____ ____ ____`, "hidden");
  unhealthyXML.map((l) => mylog(l, "hidden"));
  accessibleXML.map((l) => mylog(l, "info"));
};

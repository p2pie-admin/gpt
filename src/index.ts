import Fastify from "fastify";
import auth from "./services/auth";
import db from "./db";
import { findxml } from "./exchangers/xml";
import { fillRealLinks } from "./exchangers/fillReal";
import { parseBest } from "./exchangers/parsebest";

import { fillArticles } from "./articles";
import { createExchangers } from "./exchangers/createExchangers";
import { checkHealthXML } from "./exchangers/checkHealthXML";
import { HTML } from "./HTML";
import fillDescriptionsAuto from "./exchangers/descriptions/fillDescriptionsAuto";
import fillDescriptionsFromFile from "./exchangers/descriptions/fillDescriptionsFromFile";
import { gql } from "graphql-request";
import callStrapi from "./services/callStrapi";
import fillDirs from "./dirs";
import fillCityDirs from "./dirs/fillCityDirs";
import fillCities from "./dirs/fillCities";
import { changeExchangerNames } from "./exchangers/createExchangers/changeNames";
import loadHTML from "./exchangers/descriptions/loadExchangersHTML";
import generateDefaultDirTexts from "./defaultDirTexts";
import generateDefaultMassDirTexts from "./defaultMassDirTexts";
import { tableFormatter } from "./core";
import { readMyFile } from "./services/fileHandler";
import { mergeSame } from "./exchangers/mergeSame";
import createOffices from "./offices";
import mapsBusiness from "./maps-business";
import buildOutreach from "./maps-business/outreach";
import {
  getAvailableDomains,
  runDomainCheckService,
} from "./services/domainFinder";
import { runDomainTop100Service } from "./services/domainTop100";

const server = Fastify({ logger: true });
let isDomainCheckRunning = false;
let isDomainTop100Running = false;

// Serve interactive HTML with buttons
server.get("/", async (req, reply) => {
  reply.type("text/html").send(HTML);
});

// Script endpoints
server.get("/parsebest", async (req, reply) => {
  parseBest();
  reply.send("parsebest done");
});

server.get("/fillreal", async (req, reply) => {
  fillRealLinks();
  reply.send("fillreal done");
});

server.get("/findxml", async (req, reply) => {
  findxml();
});

server.get("/create", async (req, reply) => {
  createExchangers();
});

server.get("/load_html", async (req, reply) => {
  loadHTML();
});

server.get("/descriptions_auto", async (req, reply) => {
  fillDescriptionsAuto();
});

server.get("/descriptions_file", async (req, reply) => {
  fillDescriptionsFromFile();
});

server.get("/health", async (req, reply) => {
  checkHealthXML();
});

server.get("/fill_dirs", async (req, reply) => {
  fillDirs();
});

server.get("/fill_dirs_cities", async (req, reply) => {
  fillCityDirs();
});

server.get("/fill_cities", async (req, reply) => {
  fillCities();
});

server.get("/default_dirs", async (req, reply) => {
  generateDefaultDirTexts();
});

server.get("/default_mass_dirs", async (req, reply) => {
  generateDefaultMassDirTexts();
});

server.get("/section=:sectionName", async (request, reply) => {
  const { sectionName } = request.params as { sectionName: string };
  fillArticles(sectionName);
});

server.get("/change_exchanger_names", async (request, reply) => {
  changeExchangerNames();
});

server.get("/table_formatter", async (request, reply) => {
  try {
    const result = await tableFormatter();
    reply.send(
      `table_formatter done (${Object.keys(result).length} sheets processed)`
    );
  } catch (error) {
    server.log.error(error);
    reply.status(500).send("table_formatter failed");
  }
});

server.get("/mergeSame", async (request, reply) => {
  try {
    await mergeSame();
    reply.send("mergeSame done");
  } catch (error) {
    server.log.error(error);
    reply.status(500).send("mergeSame failed");
  }
});

server.get("/create_offices", async (request, reply) => {
  try {
    await createOffices();
    reply.send("create_offices done");
  } catch (error) {
    server.log.error(error);
    reply.status(500).send("create_offices failed");
  }
});

server.get("/maps_business", async (request, reply) => {
  try {
    await mapsBusiness();
    reply.send("maps_business done");
  } catch (error) {
    server.log.error(error);
    reply.status(500).send("maps_business failed");
  }
});

server.get("/maps_business_outreach", async (request, reply) => {
  try {
    await buildOutreach();
    reply.send("maps_business_outreach done");
  } catch (error) {
    server.log.error(error);
    reply.status(500).send("maps_business_outreach failed");
  }
});

server.get("/domain_finder", async (request, reply) => {
  if (isDomainCheckRunning) {
    return reply
      .status(409)
      .send("domain_finder is already running, wait for current batch");
  }

  const { limit, saveEvery } = request.query as {
    limit?: string;
    saveEvery?: string;
  };

  const parsedLimit = Number(limit);
  const parsedSaveEvery = Number(saveEvery);
  const limitOption = Number.isFinite(parsedLimit) ? parsedLimit : undefined;
  const saveEveryOption = Number.isFinite(parsedSaveEvery)
    ? parsedSaveEvery
    : 5;

  isDomainCheckRunning = true;
  try {
    const currentAvailable = await getAvailableDomains();
    console.log("[domain_finder] current available domains:");
    for (const domain of currentAvailable) {
      console.log(domain);
    }

    const result = await runDomainCheckService({
      limit: limitOption,
      saveEvery: saveEveryOption,
      progressEvery: 10,
      onProgress: ({ processedInRun, totalChecked, remaining, availableDomains }) => {
        console.log(
          `[domain_finder] progress: processed_in_run=${processedInRun}, total_checked=${totalChecked}, remaining=${remaining}`
        );
        for (const domain of availableDomains) {
          console.log(domain);
        }
      },
    });

    const availableDomains = result.availableTotal
      .map((item) => item.domain)
      .sort((a, b) => a.length - b.length || a.localeCompare(b));

    console.log("[domain_finder] available domains:");
    for (const domain of availableDomains) {
      console.log(domain);
    }

    reply.send(result);
  } catch (error) {
    server.log.error(error);
    reply.status(500).send("domain_finder failed");
  } finally {
    isDomainCheckRunning = false;
  }
});

server.get("/domain_top100", async (request, reply) => {
  if (isDomainTop100Running) {
    return reply
      .status(409)
      .send("domain_top100 is already running, wait for current run");
  }

  isDomainTop100Running = true;
  try {
    const result = await runDomainTop100Service();
    reply.send(result);
  } catch (error) {
    server.log.error(error);
    reply.status(500).send("domain_top100 failed");
  } finally {
    isDomainTop100Running = false;
  }
});

// Start the server
const port = +process.env.PORT!;
const host = process.env.HOST || "127.0.0.1";
const start = async () => {
  try {
    await server.listen({ port, host });

    await auth();

    // mapsBusiness().catch((error) => {
    //   server.log.error(error);
    // });

    // это работа с ядром

    //const generated = await tableFormatter();
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

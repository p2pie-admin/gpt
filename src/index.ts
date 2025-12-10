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

const server = Fastify({ logger: true });

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

// Start the server
const port = +process.env.PORT!;
const start = async () => {
  try {
    await server.listen({ port, host: "0.0.0.0" });
    await auth();

    // это работа с ядром

    //const generated = await tableFormatter();
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

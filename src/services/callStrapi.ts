import { GraphQLClient } from "graphql-request";
import db from "../db";
import normalizer from "./normalizer";
import dotenv from "dotenv";
import { delay } from "../helper";

dotenv.config();

const env = process.env.NODE_ENV || "development";
const strapiLink =
  env === "production" ? process.env.STRAPI! : process.env.DEV_STRAPI!;

const callStrapi = async (query: any, variables?: any) => {
  await delay(2000);
  const jwt = db.getData(".jwt");
  const headers = jwt
    ? {
        authorization: `Bearer ${jwt}`,
      }
    : ({} as {});

  const graphQLClient = new GraphQLClient(strapiLink || "", {
    headers,
  });
  try {
    const data = await graphQLClient.request(query, variables);
    const res = normalizer(data);
    return res;
  } catch (err) {
    console.error("📙 \u001b[1;33m -- GQL ERROR -- ");
    console.error("📙 \u001b[1;33m JWT exists:", jwt && jwt.length > 5);
    console.log("variables: ", variables);
    console.error(JSON.stringify(err, null, 2));
    console.error("📙 \u001b[1;33m -- END GQL ERROR -- ");
  }
};

export default callStrapi;

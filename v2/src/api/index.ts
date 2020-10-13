require("express-async-errors");
import express from "express";
import { setHosts, configureMonitoring } from "../arweave/nodes";

import { handler as proxyHandler } from "./handlers/proxy";
import { handler as dataHandler } from "./handlers/data";
import { handler as errorHandler } from "./middleware/error-handler";

const port = process.env.APP_PORT;

const dataPathRegex = /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i;

setHosts([
  "http://lon-1.eu-west-1.arweave.net:1984",
  "http://lon-2.eu-west-1.arweave.net:1984",
  "http://lon-3.eu-west-1.arweave.net:1984",
  "http://lon-4.eu-west-1.arweave.net:1984",
  "http://lon-5.eu-west-1.arweave.net:1984",
  "http://lon-6.eu-west-1.arweave.net:1984",
]);

configureMonitoring({
  enabled: true,
  interval: 5000,
  timeout: 2000,
  log: true,
});

const app = express();

app.get(dataPathRegex, dataHandler);

app.get("*", proxyHandler);
app.use(errorHandler);

console.log(`[app] Starting...`);

const server = app.listen(port, () => {
  console.log(`[app] Started on http://localhost:${port}`);
});

server.keepAliveTimeout = 120 * 1000;
server.headersTimeout = 120 * 1000;

server.setTimeout(10000);

process.on("SIGINT", function () {
  console.log("\n[app] Shutting down server from SIGINT");
  server.close();
  process.exit();
});

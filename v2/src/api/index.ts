require("express-async-errors");
import express from "express";

import { handler as proxyHandler } from "./handlers/proxy";
import { handler as dataHandler } from "./handlers/data";
import { handler as errorHandler } from "./middleware/error-handler";

const port = process.env.APP_PORT;

const dataPathRegex = /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i;

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

require("express-async-errors");
import { Express } from "express";
import { Server } from "http";
import { init } from "./init";
import { router } from "./router";

console.log(`[app] Starting...`);

app(parseInt(process.env.APP_PORT!));

export function app(port: number) {
  init().then((express) => {
    const server = start(router(express), port);

    process.on("SIGINT", shutdownHandler(server));
  });
}

const start = (app: Express, port: number): Server => {
  const server = app.listen(port, () => {
    console.log(`[app] Started on http://localhost:${port}`);
  });

  server.keepAliveTimeout = 120 * 1000;
  server.headersTimeout = 120 * 1000;

  server.setTimeout(10000);

  return server;
};

const shutdownHandler = (server: Server) => {
  return () => {
    console.log("\n[app] Shutting down server from SIGINT");
    server.close();
    process.exit();
  };
};

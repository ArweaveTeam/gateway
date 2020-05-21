console.log("Starting...");
require("dotenv").config();
import express, { ErrorRequestHandler, RequestHandler } from "express";
require("express-async-errors");
import morgan from "morgan";
import { apolloServer } from "./routes/graphql";
import { handler as dataHandler } from "./routes/data";
import { handler as proxyHandler } from "./routes/api/proxy";
import { handler as arqlHandler } from "./routes/arql";
import { handler as healthHandler } from "./routes/health";
import createError from "http-errors";
import { redirectToSandbox } from "./middleware/sandbox";
import { fetchRequest } from "../lib/arweave";
import bodyParser from "body-parser";
import helmet from "helmet";
import { releaseConnectionPool } from "../database/postgres";

const app = express();
const port = process.env.APP_PORT;

app.use(morgan("common"));

console.log(process.env);

const notFound: RequestHandler = (req, res, next) => {
  errorhandler(new createError.NotFound(), req, res, next);
};

const errorhandler: ErrorRequestHandler = (
  error: createError.HttpError,
  request,
  response,
  next
) => {
  console.error(error);
  if (error.statusCode) {
    response
      .status(error.statusCode)
      .send({ status: error.statusCode, error: error.message });
  } else {
    response.status(500).send({ status: 500, error: "Unknown error" });
  }
};

app.use(helmet());

app.use(redirectToSandbox);

app.post("/arql", express.json(), arqlHandler);

apolloServer.applyMiddleware({ app, path: "/arql" });

app.get(
  /^\/?([a-zA-Z0-9-_]{43})\/?$|^\/?([a-zA-Z0-9-_]{43})\/(.*)$/i,
  dataHandler
);

app.get("/health", healthHandler);

app.get("*", proxyHandler);

app.use(notFound);
app.use(errorhandler);

app.listen(port, () =>
  console.log(`App listening at http://localhost:${port}`)
);

console.log("Latest build");

fetchRequest("info").then((response) => console.log(response.body?.toString()));

setInterval(() => {
  fetchRequest("info").then((response) =>
    console.log(response.body?.toString())
  );
}, 30000);

process.on("SIGINT", function () {
  console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
  releaseConnectionPool().then(() => {
    console.log("DB connections closed");
    process.exit(1);
  });
});

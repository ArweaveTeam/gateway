import requestHandler from "../lib/proxy";
import { app, start } from "../app";

const origins = JSON.parse(process.env.GATEWAY_ORIGINS || "null") as string[];

if (!Array.isArray(origins)) {
  throw new Error(
    `error.config: Invalid env var, process.env.GATEWAY_ORIGINS: ${process.env.GATEWAY_ORIGINS}`
  );
}

console.log(`app.config.origins: ${origins.join(", ")}`);

app.get("/status", (request, response) => {
  response.status(200).json({
    region: process.env.AWS_REGION,
    origins: origins
  });
});

app.get("*", async (request, response) => {
  console.log(`proxy.request.path: ${request.path}`);
  const endpoint =
    request.path.startsWith("/") && request.path.length > 1
      ? request.path.slice(1)
      : request.path;

  await requestHandler(request, response, endpoint, origins);
});

console.log(`app.start`);

export const handler = start();

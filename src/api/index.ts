import API from "lambda-api";
import { handler as newTxHandler } from "./new-tx";
import { handler as proxyHandler } from "./proxy";

const api = API();

api.post("tx", newTxHandler);
api.get("health", proxyHandler);
api.get("*", proxyHandler);

console.log("api.creating");

export const handler = async (event: any, context: any) => {
  console.log("api.run");
  return api.run(event, context);
};

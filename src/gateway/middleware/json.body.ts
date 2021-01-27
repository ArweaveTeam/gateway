import { json } from "body-parser";

export const handler = json({ limit: "15mb", type: () => true });

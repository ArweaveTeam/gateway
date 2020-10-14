import { json } from "body-parser";

export const jsonHandler = json({ limit: "15mb", type: () => true });

import { createLogger, format, transports } from "winston";

const winston = createLogger({
  transports: [
    new transports.Console({
      level: "info",
      format: format.simple(),
    }),
  ],
});

export const log = winston;

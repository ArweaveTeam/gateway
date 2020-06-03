import { createLogger, transports, format } from "winston";

export default createLogger({
  level: "info",
  transports: new transports.Console({
    format: format.simple(),
  }),
});

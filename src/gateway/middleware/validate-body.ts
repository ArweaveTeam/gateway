import Joi, { Schema, ValidationError } from "@hapi/joi";
import { BadRequest } from "http-errors";

export const parseInput = <T = any>(schema: Schema, payload: any): T => {
  try {
    return Joi.attempt(payload, schema, { abortEarly: false });
  } catch (error) {
    const report: ValidationError = error;
    throw new BadRequest({
      // We only want to expose the message and path, so ignore the other fields
      validation: report.details.map(({ message, path }) => ({
        message,
        path,
      })),
    } as any);
  }
};

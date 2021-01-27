import Joi, { Schema, ValidationError } from "@hapi/joi";
import { BadRequest } from "http-errors";

export const parseInput = <T = any>(
  schema: Schema,
  payload: any,
  options: { transform?: (validatedPayload: any) => T } = {}
): T => {
  const { transform } = options;
  try {
    const validatedPayload = Joi.attempt(payload, schema, {
      abortEarly: false,
    });
    return transform ? transform(validatedPayload) : validatedPayload;
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

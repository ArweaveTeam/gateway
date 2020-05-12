import API, {
  HandlerFunction,
  Request,
  Response,
  API as APIInstance,
} from "lambda-api";

export type APIHandler = HandlerFunction;
export type APIRequest = Request;
export type APIResponse = Response;

export const parseJsonBody = <BodyType>(request: Request): BodyType => {
  if (typeof request.body == "object") {
    return request.body;
  }

  return JSON.parse(request.body);
};

export const createRouter = () => {
  return API();
};

export const bindApiHandler = (api: APIInstance, handler: HandlerFunction) => {
  api.any("*", handler);
};

export const createApiHandler = (
  handler: (request: APIRequest, response: APIResponse) => Promise<void>
): HandlerFunction => {
  return async (request: APIRequest, response: APIResponse) => {
    try {
      return await handler(request, response);
    } catch (error) {
      console.error(error);
      response.sendStatus(500);
    }
  };
};

export class APIError extends Error {
  public readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const router = () => {
  return API();
};

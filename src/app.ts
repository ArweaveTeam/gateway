import express, { NextFunction, Response, Request } from "express";
import { createServer, proxy } from "aws-serverless-express";
import { APIGatewayProxyEvent, Context } from "aws-lambda";

const app = express();

const port = 3000;

if (process.env.IS_LOCAL) {
  require("dotenv").config();
}

app.use(function(
  error: any,
  request: Request,
  response: Response,
  next: NextFunction
) {
  console.error(
    `error.uncaught: ${error.message}, error.stack: ${error.stack}`
  );
  response.status(500).send();
});

const start = () => {
  if (process.env.IS_LOCAL) {
    app.listen(port, () => console.log(`app.port: ${port}`));
  }

  const lambdaServer = createServer(app);

  return (event: APIGatewayProxyEvent, context: Context) => {
    proxy(lambdaServer, event, context);
  };
};

export { app, start };

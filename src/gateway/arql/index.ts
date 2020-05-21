import {
  createRouter,
  createApiHandler,
  bindApiHandler,
  parseJsonBody,
  APIError,
} from "../../lib/api-handler";
import {
  getConnectionPool,
  releaseConnectionPool,
} from "../../database/postgres";
import knex from "knex";
import { query as txQuery } from "../../database/transaction-db";
import { graphqlHandler } from "../graphql";

const router = createRouter();

type ArqlQuery = ArqlBooleanQuery | ArqlTagMatch;

interface ArqlTagMatch {
  op: "equals";
  expr1: string;
  expr2: string;
}

interface ArqlTagCompare {
  op: "compare";
  expr1: string;
  expr2: {
    type: ArqlTagMatchQueryType;
    op: ArqlTagMatchQueryOp;
    value: number | string;
  };
}

let q: ArqlTagCompare = {
  op: "compare",
  expr1: "votes",
  expr2: {
    type: "numeric",
    op: "lte",
    value: 78,
  },
};

type ArqlTagMatchQueryType = "string" | "numeric";
type ArqlTagMatchQueryOp = "eq" | "gt" | "lt" | "gte" | "lte";

interface ArqlTagMatchQuery {
  type: ArqlTagMatchQueryType;
  op: ArqlTagMatchQueryOp;
}
interface ArqlBooleanQuery {
  op: "and" | "or";
  expr1: ArqlQuery;
  expr2: ArqlQuery;
}

type ArqlResultSet = string[];

bindApiHandler(
  router,
  createApiHandler(async (request, response) => {
    const query = parseJsonBody<ArqlQuery>(request);

    if (request.body.query) {
      return await graphqlHandler(request, response);
    }

    if (!validateQuery(query)) {
      throw new APIError(400, "invalid query");
    }

    const pool = getConnectionPool("read");

    const results = await executeQuery(pool, query, {
      limit: Math.min(
        Number.isInteger(parseInt(request.query.limit!))
          ? parseInt(request.query.limit!)
          : 100,
        100000
      ),
    });

    response.sendStatus(200);
    response.send(results);
  })
);

export const handler = async (event: any, context: any) => {
  return router.run(event, context);
};

const executeQuery = async (
  connection: knex,
  arqlQuery: ArqlQuery,
  { limit = 100000, offset = 0 }: { limit?: number; offset?: number }
): Promise<ArqlResultSet> => {
  const sqlQuery = arqlToSqlQuery(txQuery(connection, {}), arqlQuery)
    .limit(limit)
    .offset(offset);

  console.log(sqlQuery.toSQL());

  return await sqlQuery.pluck("transactions.id");
};

const validateQuery = (arqlQuery: ArqlQuery): boolean => {
  if (arqlQuery.op == "equals") {
    return (
      typeof arqlQuery.expr1 == "string" && typeof arqlQuery.expr1 == "string"
    );
  }
  if (["and", "or"].includes(arqlQuery.op)) {
    return validateQuery(arqlQuery.expr1) && validateQuery(arqlQuery.expr2);
  }
  return false;
};

const arqlToSqlQuery = (
  sqlQuery: knex.QueryBuilder,
  arqlQuery: ArqlQuery
): knex.QueryBuilder => {
  switch (arqlQuery.op) {
    case "equals":
      return sqlQuery.where((sqlQuery) => {
        switch (arqlQuery.expr1) {
          case "to":
            sqlQuery.whereIn("transactions.target", [arqlQuery.expr2]);
            break;
          case "from":
            sqlQuery.whereIn("transactions.owner_address", [arqlQuery.expr2]);
            break;
          default:
            sqlQuery
              .where("tags.name", arqlQuery.expr1)
              .where("tags.value", arqlQuery.expr2);
            break;
        }
      });

    case "and":
      return arqlToSqlQuery(sqlQuery, arqlQuery.expr1).andWhere((sqlQuery) => {
        arqlToSqlQuery(sqlQuery, arqlQuery.expr2);
      });
    case "or":
      return arqlToSqlQuery(sqlQuery, arqlQuery.expr1).orWhere((sqlQuery) => {
        arqlToSqlQuery(sqlQuery, arqlQuery.expr2);
      });
    default:
      throw new Error("Invalid query");
  }
};

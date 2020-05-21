import { getConnectionPool } from "../../../database/postgres";
import knex from "knex";
import { query as txQuery } from "../../../database/transaction-db";
import { RequestHandler } from "express";
import createError from "http-errors";

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

const pool = getConnectionPool("read");

export const handler: RequestHandler = async (req, res, next: Function) => {
  console.log("arqlHandler");
  if (req.body && req.body.query) {
    console.log("forwarding to graphql");
    return next();
  }

  validateQuery(req.body);

  const results = await executeQuery(pool, req.body, {
    limit: Math.min(
      Number.isInteger(parseInt(req.query.limit! as string))
        ? parseInt(req.query.limit! as string)
        : 100,
      100000
    ),
  });

  res.send(results);
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
  console.log("validating", arqlQuery);
  try {
    if (arqlQuery.op == "equals") {
      if (typeof arqlQuery.expr1 != "string") {
        throw new createError.BadRequest(
          `Invalid value supplied for expr1: '${
            arqlQuery.expr1
          }', expected string got ${typeof arqlQuery.expr1}`
        );
      }

      if (typeof arqlQuery.expr2 != "string") {
        throw new createError.BadRequest(
          `Invalid value supplied for expr2: '${
            arqlQuery.expr2
          }', expected string got ${typeof arqlQuery.expr2}`
        );
      }
      //
      return true;
    }
    if (["and", "or"].includes(arqlQuery.op)) {
      return validateQuery(arqlQuery.expr1) && validateQuery(arqlQuery.expr2);
    }

    throw new createError.BadRequest(
      `Invalid value supplied for op: '${arqlQuery.op}', expected 'equals', 'and', 'or'.`
    );
  } catch (error) {
    if (error instanceof createError.BadRequest) {
      throw error;
    }
    throw new createError.BadRequest(`Failed to parse arql query`);
  }
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
            sqlQuery.whereIn("transactions.id", (query) => {
              query.select("tx_id").from("tags");
              if (arqlQuery.expr2.includes("%")) {
                query
                  .where("tags.name", "=", arqlQuery.expr1)
                  .where("tags.value", "LIKE", arqlQuery.expr2);
              } else {
                query.where({
                  "tags.name": arqlQuery.expr1,
                  "tags.value": arqlQuery.expr2,
                });
              }
            });
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
      throw new createError.BadRequest();
  }
};

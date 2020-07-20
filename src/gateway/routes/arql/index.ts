import { getConnectionPool } from "../../../database/postgres";
import knex from "knex";
import { query as txQuery } from "../../../database/transaction-db";
import { RequestHandler } from "express";
import createError from "http-errors";
import { Logger } from "winston";

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

export const defaultMaxResults = 5000;

export const handler: RequestHandler = async (req, res, next: Function) => {
  if (req.body && req.body.query) {
    req.log.info(`[graphql] resolving arql using graphql`);
    return next();
  }

  const pool = getConnectionPool("read");

  try {
    validateQuery(req.body);
  } catch (error) {
    req.log.info(`[arql] invalid query`, { query: req.body });
    throw error;
  }

  const limit = Math.min(
    Number.isInteger(parseInt(req.query.limit! as string))
      ? parseInt(req.query.limit! as string)
      : defaultMaxResults,
    defaultMaxResults
  );

  req.log.info(`[arql] valid query`, { query: req.body, limit });

  const results = await executeQuery(pool, req.body, { limit });

  req.log.info(`[arql] results: ${results.length}`);

  res.send(results);
};

const executeQuery = async (
  connection: knex,
  arqlQuery: ArqlQuery,
  {
    limit = defaultMaxResults,
    offset = 0,
    log = undefined,
  }: { limit?: number; offset?: number; log?: Logger }
): Promise<ArqlResultSet> => {
  const sqlQuery = arqlToSqlQuery(txQuery(connection, {}), arqlQuery)
    .limit(limit)
    .offset(offset);

  if (log) {
    log.info(`[arql] execute sql`, {
      sql: sqlQuery.toSQL(),
    });
  }

  return await sqlQuery.pluck("transactions.id");
};

const validateQuery = (arqlQuery: ArqlQuery): boolean => {
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

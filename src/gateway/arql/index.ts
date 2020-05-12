import {
  createRouter,
  createApiHandler,
  bindApiHandler,
  parseJsonBody,
  APIError,
} from "../../lib/api-handler";
import {
  createConnectionPool,
  getConnectionPool,
  releaseConnectionPool,
} from "../../database/postgres";
import knex from "knex";

const router = createRouter();

type ArqlQuery = ArqlBooleanQuery | ArqlTagMatch;

interface ArqlTagMatch {
  op: "equals";
  expr1: string;
  expr2: string;
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

    if (!validateQuery(query)) {
      throw new APIError(400, "invalid query");
    }

    try {
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
    } catch (error) {
      console.error(error);
      await releaseConnectionPool("read");
    }
  })
);

export const handler = async (event: any, context: any) => {
  return router.run(event, context);
};

const executeQuery = async (
  connection: knex,
  arqlQuery: ArqlQuery,
  { limit = 100, offset = 0 }: { limit?: number; offset?: number }
): Promise<ArqlResultSet> => {
  const sqlQuery = arqlToSqlQuery(
    connection.queryBuilder().from("tags"),
    arqlQuery
  );

  return await sqlQuery.pluck("tx_id").limit(limit).offset(offset);
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
  sqlBuilder: knex.QueryBuilder,
  arqlQuery: ArqlQuery
): knex.QueryBuilder => {
  switch (arqlQuery.op) {
    case "equals":
      return sqlBuilder.where((sqlBuilder) => {
        sqlBuilder
          .where("tags.name", arqlQuery.expr1)
          .where("tags.value", arqlQuery.expr2);
      });
    case "and":
      return arqlToSqlQuery(sqlBuilder, arqlQuery.expr1).andWhere(
        (sqlBuilder) => {
          arqlToSqlQuery(sqlBuilder, arqlQuery.expr2);
        }
      );
    case "or":
      return arqlToSqlQuery(sqlBuilder, arqlQuery.expr1).orWhere(
        (sqlBuilder) => {
          arqlToSqlQuery(sqlBuilder, arqlQuery.expr2);
        }
      );
    default:
      throw new Error("Invalid query");
  }
};

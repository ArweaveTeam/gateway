import { createApiHandler, router, parseJsonBody } from "../../lib/api-handler";
import { createConnectionPool } from "../../lib/postgres";
import Knex from "knex";

const app = router();

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

app.post(
  "arql",
  createApiHandler(async (request, response) => {
    const query = parseJsonBody<ArqlQuery>(request);

    response.sendStatus(200);
    console.log(await getQueryResults(query, {}));
    response.send(await getQueryResults(query, {}));
  })
);

export const handler = async (event: any, context: any) => {
  return app.run(event, context);
};

const getQueryResults = async (
  arqlQuery: ArqlQuery,
  { limit = 100, offset = 0 }: { limit?: number; offset?: number }
): Promise<ArqlResultSet> => {
  const pool = createConnectionPool("write");
  const sqlBuilder = pool.queryBuilder().from("tags");
  const sqlQuery = arqlToSqlQuery(arqlQuery, sqlBuilder);

  return sqlQuery.pluck("tx_id").limit(limit).offset(offset);
};

const arqlToSqlQuery = (
  arqlQuery: ArqlQuery,
  sqlBuilder: Knex.QueryBuilder
): Knex.QueryBuilder => {
  if (arqlQuery.op == "equals") {
    return sqlBuilder.where((sqlBuilder) => {
      sqlBuilder
        .where("tags.name", arqlQuery.expr1)
        .where("tags.value", arqlQuery.expr2);
    });
  }
  if (arqlQuery.op == "and") {
    return arqlToSqlQuery(arqlQuery.expr1, sqlBuilder).andWhere(
      (sqlBuilder) => {
        arqlToSqlQuery(arqlQuery.expr2, sqlBuilder);
      }
    );
  }
  if (arqlQuery.op == "or") {
    return arqlToSqlQuery(arqlQuery.expr1, sqlBuilder).orWhere((sqlBuilder) => {
      arqlToSqlQuery(arqlQuery.expr2, sqlBuilder);
    });
  }
  throw new Error("Invalid query");
};

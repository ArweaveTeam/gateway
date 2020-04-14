"use strict";
exports.__esModule = true;
var knex = require("knex");
// import { createConnection } from "./lib/postgres";
// createConnection('read');
var k = knex({
    client: "pg"
});
// const q = k
//   .raw(":name: = :i1 or :name: = :otherGuy or :name: = :undefinedBinding", {
//     i1: "users.name",
//     thisGuy: "Bob",
//     otherGuy: "Jay"
//   })
//   .toSQL();
// console.log(q);
var data = [
    {
        id: "abc",
        last_tx: "def"
    },
    {
        id: "ghi",
        last_tx: "jhk"
    }
];
var table = "transactions";
var fields = [
    "id",
    "owner",
    "target",
    "quantity",
    "reward",
    "signature",
    "last_tx"
];
var key = "id";
var insertFields = fields.map(function (field) { return "\"" + field + "\""; }).join(",");
var updateParams = {};
var insertValues = data
    .map(function (record, index) {
    return "(" + fields.map(function (field) {
        var paramKey = field + "_" + index;
        updateParams[paramKey] = record[field];
    }) + ")";
})
    .join(",");
var conflictFields = fields
    .filter(function (field) { return field != key; })
    .map(function (field) { return field + " = excluded." + field; })
    .join(",");
var query = "INSERT INTO " + table + " (" + insertFields + ") VALUES " + insertValues + " ON CONFLICT (" + key + ") DO UPDATE SET " + conflictFields + ";";
console.log(query, updateParams);
// owner = excluded.owner,
// tags = excluded.tags,
// target = excluded.target,
// quantity = excluded.quantity,
// reward = excluded.reward,
// signature = excluded.signature,
// last_tx = excluded.last_tx,
// data_size = excluded.data_size,
// data_root = excluded.data_root,
// data_tree = excluded.data_tree
// const insert = `INSERT INTO "public"."transactions" ("id", "owner", "tags", "target", "quantity", "reward", "signature", "last_tx", "data_size", "data_root", "data_tree")`;

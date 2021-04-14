#!/bin/bash
echo Indexing database please wait

sudo -u postgres psql -d arweave <<EOF

SET statement_timeout to 0;
SET maintenance_work_mem TO '8GB';
SET max_parallel_maintenance_workers TO 16;

COMMIT;

SHOW statement_timeout;
SHOW maintenance_work_mem;
SHOW max_parallel_maintenance_workers;

--- Block Indices
--- Block Height Index
CREATE INDEX "blocks_height" ON blocks USING BTREE ("height");
--- Blocks Mined At Index
CREATE INDEX "blocks_mined_at" ON blocks USING BTREE ("mined_at");

--- Transaction Indices
--- Transaction Height Index
CREATE INDEX "transactions_height" ON transactions USING BTREE ("height");
--- Transaction Target Index
CREATE INDEX "transactions_target" ON transactions USING BTREE ("target");
--- Transaction Owner Address Index
CREATE INDEX "transactions_owner_address" ON transactions USING BTREE ("owner_address");
--- Transaction Namespace Index
CREATE INDEX "index_namespace_transactions" ON transactions USING BTREE ("namespace");
--- Transaction Domain Index
CREATE INDEX "index_domain_transactions" ON transactions USING BTREE ("domain");
--- Transaction App Index
CREATE INDEX "index_app_transactions" ON transactions USING BTREE ("app");
--- Transaction App-Name Index
CREATE INDEX "index_App-Name_transactions" ON transactions USING BTREE ("App-Name");

--- Tag Indices
--- Tag Transaction Id Index
CREATE INDEX "tags_tx_id" ON tags USING BTREE ("tx_id");
--- Tag Name Index (under 64 characters)
CREATE INDEX "tags_name" ON tags USING BTREE ("name") WHERE LENGTH("name") < 64;
--- Tag Value Index (under 64 characters)
CREATE INDEX "tags_value" ON tags USING BTREE ("value") WHERE LENGTH("value") < 64;
--- Tag Name, Value Index (under 64 characters)
CREATE INDEX "tags_name_value" ON tags USING BTREE ("name", "value") WHERE LENGTH("name") < 64 AND LENGTH("value") < 64;
--- Tag Transaction Id, Name Index (under 64 characters)
CREATE INDEX "tags_tx_id_name" ON tags USING BTREE ("tx_id", "name") WHERE LENGTH("name") < 64;
--- Tag Name Index (under 128 chracters)
CREATE INDEX "tags_name_128" ON tags USING BTREE ("name") WHERE LENGTH("name") > 64 AND LENGTH("name") < 128;
--- Tag Value Index (under 128 chracters)
CREATE INDEX "tags_value_128" ON tags USING BTREE ("value") WHERE LENGTH("value") > 64 AND LENGTH("value") < 128;
--- Tag Name, Value Index (under 128 chracters)
CREATE INDEX "tags_name_value_128" ON tags USING BTREE ("name", "value") WHERE LENGTH("name") > 64 AND LENGTH("name") < 128 AND LENGTH("value") > 64 AND LENGTH("value") < 128;
--- Tag Transaction Id, Name Index (under 128 chracters)
CREATE INDEX "tags_tx_id_name_128" ON tags USING BTREE ("tx_id", "name") WHERE LENGTH("name") > 64 AND LENGTH("name") < 128;

EOF

echo Finished indexing database
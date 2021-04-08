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

CREATE INDEX "blocks_height" ON blocks USING BTREE ("height");
CREATE INDEX "blocks_mined_at" ON blocks USING BTREE ("mined_at");

CREATE INDEX "transactions_height" ON transactions USING BTREE ("height");
CREATE INDEX "transactions_target" ON transactions USING BTREE ("target");
CREATE INDEX "transactions_owner_address" ON transactions USING BTREE ("owner_address");
CREATE INDEX "index_namespace_transactions" ON transactions USING BTREE ("namespace");
CREATE INDEX "index_domain_transactions" ON transactions USING BTREE ("domain");
CREATE INDEX "index_app_transactions" ON transactions USING BTREE ("app");
CREATE INDEX "index_App-Name_transactions" ON transactions USING BTREE ("App-Name");

CREATE INDEX "tags_name" ON tags USING BTREE ("name") WHERE LENGTH("name") < 64;
CREATE INDEX "tags_value" ON tags USING BTREE ("value") WHERE LENGTH("value") < 64;
CREATE INDEX "tags_name_value" ON tags USING BTREE ("name", "value") WHERE LENGTH("name") < 64 AND LENGTH("value") < 64;
CREATE INDEX "tags_tx_id_name" ON tags USING BTREE ("tx_id", "name") WHERE LENGTH("name") < 64;
CREATE INDEX "tags_tx_id" ON tags USING BTREE ("tx_id");

EOF

echo Finished indexing database
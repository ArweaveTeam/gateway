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

CREATE INDEX "transactions_height" ON transactions USING BTREE ("height");
CREATE INDEX "transactions_target" ON transactions USING BTREE ("target");
CREATE INDEX "transactions_owner_address" ON transactions USING BTREE ("owner_address");
CREATE INDEX "index_namespace_transactions" ON transactions USING BTREE ("namespace");
CREATE INDEX "index_domain_transactions" ON transactions USING BTREE ("domain");
CREATE INDEX "index_app_transactions" ON transactions USING BTREE ("app");
CREATE INDEX "index_App-Name_transactions" ON transactions USING BTREE ("App-Name");

CREATE INDEX  "tags_name" ON tags USING BTREE ("name");
CREATE INDEX  "tags_name_value" ON tags USING BTREE ("name", "value");
CREATE INDEX  "tags_tx_id_name" ON tags USING BTREE ("tx_id", "name");

EOF

echo Finished indexing database
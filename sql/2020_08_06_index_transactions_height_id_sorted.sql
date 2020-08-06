CREATE INDEX "transactions_height_id_sorted" ON "public"."transactions" USING BTREE (height DESC NULLS FIRST, id ASC);


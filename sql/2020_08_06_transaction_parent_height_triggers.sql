CREATE TRIGGER "transactions_inherit_parent_height"
    BEFORE INSERT ON "public"."transactions"
    FOR EACH ROW
    EXECUTE PROCEDURE func_transactions_inherit_parent_height();

CREATE TRIGGER "transactions_cascade_parent_height"
    AFTER UPDATE ON "public"."transactions"
    FOR EACH ROW
    EXECUTE PROCEDURE func_transactions_cascade_parent_height();


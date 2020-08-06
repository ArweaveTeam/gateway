CREATE OR REPLACE FUNCTION public.func_transactions_inherit_parent_height()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $function$
BEGIN
    IF NEW.parent IS NOT NULL THEN
        SELECT
            transactions.height INTO NEW.height
        FROM
            transactions
        WHERE
            transactions.id = NEW.parent;
    END IF;
    RETURN NEW;
END
$function$

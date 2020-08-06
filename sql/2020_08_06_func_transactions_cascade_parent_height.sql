CREATE OR REPLACE FUNCTION public.func_transactions_cascade_parent_height()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $function$
BEGIN
    IF NEW.parent IS NULL AND NEW.height <> OLD.height THEN
        UPDATE
            transactions
        SET
            height = NEW.height
        WHERE
            transactions.parent = NEW.id;
    END IF;
    RETURN NEW;
END
$function$

-- Remove 'distance' from mode CHECK constraint on leads table
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'leads'::regclass
      AND pg_get_constraintdef(oid) LIKE '%mode%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE leads DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

ALTER TABLE leads ADD CONSTRAINT leads_mode_check CHECK (mode IN ('attending', 'non-attending', 'regular', 'online'));

-- Remove 'distance' from mode CHECK constraint on students table
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'students'::regclass
      AND pg_get_constraintdef(oid) LIKE '%mode%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE students DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

ALTER TABLE students ADD CONSTRAINT students_mode_check CHECK (mode IN ('attending', 'non-attending', 'regular', 'online'));

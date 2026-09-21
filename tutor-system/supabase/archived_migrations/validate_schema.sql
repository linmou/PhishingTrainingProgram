-- =====================================================
-- SCHEMA VALIDATION SCRIPT
-- =====================================================
-- This script extracts and compares database schemas
-- Run this against your Supabase database to extract current state

-- =====================================================
-- 1. EXTRACT CUSTOM TYPES
-- =====================================================
SELECT '-- CUSTOM TYPES' as section;
SELECT 
    format('CREATE TYPE %I AS ENUM (%s);',
        t.typname,
        string_agg(format('%L', e.enumlabel), ', ' ORDER BY e.enumsortorder)
    ) as ddl
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
GROUP BY t.typname
ORDER BY t.typname;

-- =====================================================
-- 2. EXTRACT TABLES WITH COLUMNS
-- =====================================================
SELECT '-- TABLES' as section;
WITH table_columns AS (
    SELECT 
        c.table_name,
        c.ordinal_position,
        format('    %I %s%s%s%s',
            c.column_name,
            CASE 
                WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
                WHEN c.data_type = 'character varying' THEN format('varchar(%s)', c.character_maximum_length)
                WHEN c.data_type = 'numeric' THEN format('numeric(%s,%s)', c.numeric_precision, c.numeric_scale)
                ELSE c.data_type
            END,
            CASE WHEN c.column_default IS NOT NULL THEN ' DEFAULT ' || c.column_default ELSE '' END,
            CASE WHEN c.is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END,
            CASE 
                WHEN tc.constraint_type = 'PRIMARY KEY' THEN ' PRIMARY KEY'
                WHEN tc.constraint_type = 'UNIQUE' THEN ' UNIQUE'
                ELSE ''
            END
        ) as column_def
    FROM information_schema.columns c
    LEFT JOIN information_schema.key_column_usage kcu 
        ON c.table_name = kcu.table_name 
        AND c.column_name = kcu.column_name
        AND c.table_schema = kcu.table_schema
    LEFT JOIN information_schema.table_constraints tc
        ON kcu.constraint_name = tc.constraint_name
        AND kcu.table_schema = tc.table_schema
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position
)
SELECT format('CREATE TABLE %I (%s%s);',
    table_name,
    E'\n',
    string_agg(column_def, E',\n' ORDER BY ordinal_position)
) as ddl
FROM table_columns
GROUP BY table_name
ORDER BY table_name;

-- =====================================================
-- 3. EXTRACT FOREIGN KEY CONSTRAINTS
-- =====================================================
SELECT '-- FOREIGN KEY CONSTRAINTS' as section;
SELECT DISTINCT
    format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(%I)%s;',
        tc.table_name,
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name,
        ccu.column_name,
        CASE 
            WHEN rc.delete_rule != 'NO ACTION' THEN ' ON DELETE ' || rc.delete_rule
            ELSE ''
        END
    ) as ddl
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name
    AND rc.constraint_schema = tc.table_schema
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY 1;

-- =====================================================
-- 4. EXTRACT CHECK CONSTRAINTS
-- =====================================================
SELECT '-- CHECK CONSTRAINTS' as section;
SELECT 
    format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s);',
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
    ) as ddl
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
    AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
    AND tc.constraint_type = 'CHECK'
    AND tc.constraint_name NOT LIKE '%_not_null'
ORDER BY tc.table_name, tc.constraint_name;

-- =====================================================
-- 5. EXTRACT INDEXES
-- =====================================================
SELECT '-- INDEXES' as section;
SELECT indexdef || ';' as ddl
FROM pg_indexes
WHERE schemaname = 'public'
    AND indexname NOT LIKE '%_pkey'
    AND indexname NOT LIKE '%_key'
ORDER BY tablename, indexname;

-- =====================================================
-- 6. EXTRACT FUNCTIONS
-- =====================================================
SELECT '-- FUNCTIONS' as section;
SELECT 
    pg_get_functiondef(p.oid) || ';' as ddl
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- =====================================================
-- 7. EXTRACT TRIGGERS
-- =====================================================
SELECT '-- TRIGGERS' as section;
SELECT 
    format('CREATE TRIGGER %I %s %s ON %I FOR EACH %s EXECUTE FUNCTION %s;',
        t.tgname,
        CASE 
            WHEN t.tgtype & 2 = 2 THEN 'BEFORE'
            ELSE 'AFTER'
        END,
        CASE 
            WHEN t.tgtype & 4 = 4 THEN 'INSERT'
            WHEN t.tgtype & 8 = 8 THEN 'DELETE'  
            WHEN t.tgtype & 16 = 16 THEN 'UPDATE'
            ELSE 'INSERT OR UPDATE OR DELETE'
        END,
        c.relname,
        CASE 
            WHEN t.tgtype & 1 = 1 THEN 'ROW'
            ELSE 'STATEMENT'
        END,
        p.proname || '()'
    ) as ddl
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- =====================================================
-- 8. EXTRACT RLS STATUS
-- =====================================================
SELECT '-- ROW LEVEL SECURITY' as section;
SELECT 
    format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', c.relname) as ddl
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = true
ORDER BY c.relname;

-- =====================================================
-- 9. EXTRACT RLS POLICIES
-- =====================================================
SELECT '-- RLS POLICIES' as section;
SELECT 
    format('CREATE POLICY %I ON %I FOR %s%s%s%s;',
        pol.polname,
        c.relname,
        CASE pol.polcmd
            WHEN 'r' THEN 'SELECT'
            WHEN 'a' THEN 'INSERT'
            WHEN 'w' THEN 'UPDATE'
            WHEN 'd' THEN 'DELETE'
            WHEN '*' THEN 'ALL'
        END,
        CASE 
            WHEN pol.polqual IS NOT NULL THEN E'\n    USING (' || pg_get_expr(pol.polqual, pol.polrelid) || ')'
            ELSE ''
        END,
        CASE 
            WHEN pol.polwithcheck IS NOT NULL THEN E'\n    WITH CHECK (' || pg_get_expr(pol.polwithcheck, pol.polrelid) || ')'
            ELSE ''
        END,
        CASE 
            WHEN NOT pol.polpermissive THEN E'\n    AS RESTRICTIVE'
            ELSE ''
        END
    ) as ddl
FROM pg_policy pol
JOIN pg_class c ON pol.polrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY c.relname, pol.polname;

-- =====================================================
-- 10. EXTRACT PERMISSIONS
-- =====================================================
SELECT '-- PERMISSIONS' as section;
SELECT 
    format('GRANT %s ON %s %I TO %I;',
        string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type),
        table_schema,
        table_name,
        grantee
    ) as ddl
FROM information_schema.table_privileges
WHERE table_schema = 'public'
    AND grantee IN ('anon', 'authenticated', 'service_role')
GROUP BY table_schema, table_name, grantee
ORDER BY table_name, grantee;

-- =====================================================
-- 11. EXTRACT FUNCTION PERMISSIONS
-- =====================================================
SELECT '-- FUNCTION PERMISSIONS' as section;
SELECT 
    format('GRANT EXECUTE ON FUNCTION %s TO %I;',
        routine_name || '(' || 
        COALESCE(string_agg(parameter_data_type, ', ' ORDER BY ordinal_position), '') || 
        ')',
        grantee
    ) as ddl
FROM information_schema.routine_privileges rp
JOIN information_schema.parameters p 
    ON rp.specific_name = p.specific_name
    AND p.parameter_mode = 'IN'
WHERE rp.routine_schema = 'public'
    AND rp.grantee IN ('anon', 'authenticated', 'service_role')
    AND rp.privilege_type = 'EXECUTE'
GROUP BY rp.routine_name, rp.grantee
ORDER BY rp.routine_name, rp.grantee;

-- =====================================================
-- 12. SUMMARY STATISTICS
-- =====================================================
SELECT '-- SUMMARY' as section;
SELECT 'Total tables: ' || count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
SELECT 'Total indexes: ' || count(*) FROM pg_indexes WHERE schemaname = 'public';
SELECT 'Total functions: ' || count(*) FROM information_schema.routines WHERE routine_schema = 'public';
SELECT 'Total triggers: ' || count(*) FROM information_schema.triggers WHERE trigger_schema = 'public';
SELECT 'Total RLS policies: ' || count(*) FROM pg_policies WHERE schemaname = 'public';
SELECT 'Total custom types: ' || count(DISTINCT typname) FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE n.nspname = 'public' AND t.typtype = 'e';
# Schema Validation Plan

## Objective
Validate that `final_schema.sql` is equivalent to running all 18 migrations sequentially and matches the existing Supabase schema.

## Validation Strategy

### Phase 1: Migration Analysis
1. **Identify Migration Conflicts**
   - Check for duplicate migration numbers (e.g., multiple 003_*.sql files)
   - Analyze migration dependencies
   - Document the correct execution order

2. **Migration Categorization**
   - DDL operations (CREATE, ALTER, DROP)
   - DML operations (INSERT, UPDATE)
   - Permission grants
   - RLS policies
   - Functions and triggers

### Phase 2: Schema Extraction

#### A. Extract Current Supabase Schema
```sql
-- 1. Extract table definitions
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length,
    column_default,
    is_nullable,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- 2. Extract constraints
SELECT 
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage ccu 
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type;

-- 3. Extract indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 4. Extract functions
SELECT 
    routine_name,
    routine_type,
    data_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- 5. Extract triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 6. Extract RLS policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 7. Extract custom types
SELECT 
    n.nspname as schema,
    t.typname as type_name,
    e.enumlabel as enum_value,
    e.enumsortorder as sort_order
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid  
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder;
```

#### B. Schema Dump Approach
```bash
# Full schema dump from existing database
pg_dump -h [supabase-host] -U postgres -d postgres \
  --schema-only --no-owner --no-privileges \
  -f existing_schema.sql

# Create test database and apply migrations
createdb test_migrations
psql test_migrations < 001_initial_schema.sql
psql test_migrations < 002_ai_assistant_support.sql
# ... continue for all 18 migrations
pg_dump test_migrations --schema-only --no-owner --no-privileges \
  -f migrations_result.sql

# Create another test database with final schema
createdb test_final
psql test_final < final_schema.sql
pg_dump test_final --schema-only --no-owner --no-privileges \
  -f final_result.sql
```

### Phase 3: Comparison Methods

#### Method 1: Automated SQL Comparison Script
Create a comprehensive comparison script that checks:
- Table existence and structure
- Column definitions match
- Constraint definitions match
- Index definitions match
- Function signatures and bodies match
- Trigger definitions match
- RLS policies match

#### Method 2: Manual Diff Analysis
```bash
# Compare the schema dumps
diff -u migrations_result.sql final_result.sql > schema_diff.txt

# Use a more sophisticated diff tool
git diff --no-index --word-diff migrations_result.sql final_result.sql
```

#### Method 3: Object-by-Object Validation
Create validation queries for each object type:

```sql
-- Validate tables match
WITH final_schema_tables AS (
    -- Extract from final_schema.sql
),
migration_tables AS (
    -- Extract from sequential migrations
)
SELECT 
    'Missing in final' as issue,
    m.*
FROM migration_tables m
LEFT JOIN final_schema_tables f ON m.table_name = f.table_name
WHERE f.table_name IS NULL
UNION ALL
SELECT 
    'Extra in final' as issue,
    f.*
FROM final_schema_tables f
LEFT JOIN migration_tables m ON f.table_name = m.table_name
WHERE m.table_name IS NULL;
```

### Phase 4: Special Considerations

1. **Migration Order Issues**
   - Check for migrations that modify the same objects
   - Identify if order matters (it likely does)
   - Document the canonical order

2. **Duplicate Migration Numbers**
   - 003_simplified_auth.sql
   - 003_fix_ai_assistant.sql
   - Determine which should run first

3. **Storage Configuration**
   - Storage buckets are configured outside SQL
   - Document these separately

4. **System-Generated Names**
   - Constraint names might differ
   - Focus on constraint definitions, not names

5. **Comments and Metadata**
   - Some migrations add comments
   - Ensure final schema includes all comments

### Phase 5: Test Execution Plan

1. **Local Testing**
   ```bash
   # Start fresh Postgres container
   docker run --name test-postgres -e POSTGRES_PASSWORD=postgres -d postgres:15
   
   # Test migrations approach
   docker exec -i test-postgres psql -U postgres < combined_migrations.sql
   
   # Test final schema approach  
   docker exec -i test-postgres psql -U postgres -c "CREATE DATABASE final_test"
   docker exec -i test-postgres psql -U postgres final_test < final_schema.sql
   ```

2. **Validation Queries**
   Run comprehensive validation queries to compare:
   - Object counts
   - Object definitions
   - Permissions and policies

3. **Functional Testing**
   - Test basic operations work the same
   - Verify RLS policies behave identically
   - Check function execution results

### Phase 6: Reconciliation Process

1. **Document All Differences**
   - Create a spreadsheet of discrepancies
   - Categorize by severity
   - Identify root cause

2. **Update Final Schema**
   - Fix any missing objects
   - Correct any definition differences
   - Ensure proper ordering

3. **Re-validate**
   - Run validation again
   - Confirm all issues resolved

## Deliverables

1. **Validation Report**
   - List of all discrepancies found
   - Root cause analysis
   - Recommended fixes

2. **Updated final_schema.sql**
   - Corrected to match migration sequence exactly
   - Properly ordered
   - Fully commented

3. **Migration Order Documentation**
   - Canonical order for migrations
   - Dependencies between migrations
   - Resolution of conflicts

4. **Test Scripts**
   - Automated validation scripts
   - Reusable comparison queries
   - CI/CD integration recommendations
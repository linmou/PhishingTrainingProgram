const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // You'll need this key

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase URL or Service Role Key');
    console.error('Make sure you have REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local');
    process.exit(1);
}

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function runMigration(migrationFile) {
    try {
        console.log(`🔄 Running migration: ${migrationFile}`);
        
        const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        console.log('📝 SQL to execute:');
        console.log(sql);
        
        // Split SQL by semicolons and execute each statement
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (const statement of statements) {
            const cleanStatement = statement.trim();
            if (cleanStatement) {
                console.log(`\n🔄 Executing: ${cleanStatement.substring(0, 50)}...`);
                const { error } = await supabase.rpc('exec_sql', { sql: cleanStatement });
                
                if (error) {
                    console.error('❌ Error executing statement:', error);
                    throw error;
                }
                console.log('✅ Statement executed successfully');
            }
        }
        
        console.log(`\n✅ Migration ${migrationFile} completed successfully!`);
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the storage policy fix migration
runMigration('005_fix_storage_policies.sql');
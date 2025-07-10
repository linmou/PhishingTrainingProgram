const { createClient } = require('@supabase/supabase-js');

// Read environment variables
require('dotenv').config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log('Testing Supabase connection...');
console.log('URL:', supabaseUrl);
console.log('Key length:', supabaseKey?.length);

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
    try {
        // Test database connection
        console.log('\n1. Testing database connection...');
        const { data: testData, error: testError } = await supabase
            .from('users')
            .select('count')
            .limit(1);
        
        if (testError) {
            console.error('❌ Database connection failed:', testError);
            return;
        }
        console.log('✅ Database connection successful');

        // Check current users
        console.log('\n2. Checking current users...');
        const { data: currentUsers, error: usersError } = await supabase
            .from('users')
            .select('*');
        
        if (usersError) {
            console.error('❌ Failed to fetch users:', usersError);
        } else {
            console.log(`✅ Current users in database: ${currentUsers.length}`);
            currentUsers.forEach(user => {
                console.log(`   - ${user.display_name} (${user.current_role}) - Status: ${user.status}`);
            });
        }

        // Try to create a test user
        console.log('\n3. Testing user creation...');
        // Generate a proper UUID
        const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };
        
        const testUser = {
            id: generateUUID(),
            display_name: 'Test User',
            current_role: 'student',
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: insertData, error: insertError } = await supabase
            .from('users')
            .insert(testUser)
            .select()
            .single();

        if (insertError) {
            console.error('❌ User creation failed:', insertError);
        } else {
            console.log('✅ User created successfully:', insertData);
            
            // Clean up test user
            const { error: deleteError } = await supabase
                .from('users')
                .delete()
                .eq('id', testUser.id);
            
            if (deleteError) {
                console.error('❌ Failed to clean up test user:', deleteError);
            } else {
                console.log('✅ Test user cleaned up');
            }
        }

    } catch (error) {
        console.error('💥 Unexpected error:', error);
    }
}

testLogin();
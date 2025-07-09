/**
 * Authentication Diagnostics Utility
 * 
 * This utility helps diagnose authentication issues by testing:
 * 1. Environment variables
 * 2. Supabase connectivity
 * 3. Database access
 * 4. RLS policies
 * 5. User profile operations
 */

import { supabase } from '../services/supabase';

export interface DiagnosticResult {
    test: string;
    status: 'pass' | 'fail' | 'warning';
    message: string;
    error?: any;
}

export class AuthDiagnostics {
    private results: DiagnosticResult[] = [];

    private addResult(test: string, status: 'pass' | 'fail' | 'warning', message: string, error?: any) {
        this.results.push({ test, status, message, error });
        const emoji = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
        console.log(`${emoji} [${test}] ${message}`);
        if (error) {
            console.error('Error details:', error);
        }
    }

    async runDiagnostics(): Promise<DiagnosticResult[]> {
        console.log('🔍 Starting Authentication Diagnostics...\n');
        this.results = [];

        await this.testEnvironmentVariables();
        await this.testSupabaseConnectivity();
        await this.testDatabaseAccess();
        await this.testUserTableStructure();
        await this.testRLSPolicies();
        await this.testAuthFlow();

        console.log('\n📊 Diagnostics Summary:');
        const passed = this.results.filter(r => r.status === 'pass').length;
        const failed = this.results.filter(r => r.status === 'fail').length;
        const warnings = this.results.filter(r => r.status === 'warning').length;

        console.log(`✅ Passed: ${passed}, ❌ Failed: ${failed}, ⚠️ Warnings: ${warnings}`);

        return this.results;
    }

    private async testEnvironmentVariables() {
        const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
        const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

        if (!supabaseUrl) {
            this.addResult('Environment', 'fail', 'REACT_APP_SUPABASE_URL is missing');
        } else if (!supabaseUrl.includes('supabase.co')) {
            this.addResult('Environment', 'warning', `Supabase URL format may be incorrect: ${supabaseUrl}`);
        } else {
            this.addResult('Environment', 'pass', 'Supabase URL is set');
        }

        if (!supabaseKey) {
            this.addResult('Environment', 'fail', 'REACT_APP_SUPABASE_ANON_KEY is missing');
        } else if (supabaseKey.length < 100) {
            this.addResult('Environment', 'warning', `Supabase key may be incorrect (length: ${supabaseKey.length})`);
        } else {
            this.addResult('Environment', 'pass', 'Supabase anonymous key is set');
        }
    }

    private async testSupabaseConnectivity() {
        try {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
                this.addResult('Connectivity', 'fail', 'Failed to connect to Supabase auth service', error);
            } else {
                this.addResult('Connectivity', 'pass', 'Successfully connected to Supabase auth service');
            }
        } catch (error) {
            this.addResult('Connectivity', 'fail', 'Network error connecting to Supabase', error);
        }
    }

    private async testDatabaseAccess() {
        try {
            // Test basic database connectivity by querying the users table
            const { data, error } = await supabase
                .from('users')
                .select('count', { count: 'exact', head: true });

            if (error) {
                this.addResult('Database', 'fail', 'Cannot access users table', error);
            } else {
                this.addResult('Database', 'pass', `Database accessible, users table has ${data?.length || 0} records`);
            }
        } catch (error) {
            this.addResult('Database', 'fail', 'Database connection error', error);
        }
    }

    private async testUserTableStructure() {
        try {
            // Try to select all columns to verify table structure
            const { data, error } = await supabase
                .from('users')
                .select('id, email, display_name, current_role, status, created_at, updated_at')
                .limit(1);

            if (error) {
                this.addResult('Schema', 'fail', 'Users table schema mismatch or access denied', error);
            } else {
                this.addResult('Schema', 'pass', 'Users table schema is correct');
            }
        } catch (error) {
            this.addResult('Schema', 'fail', 'Error checking table structure', error);
        }
    }

    private async testRLSPolicies() {
        try {
            // Test if we can insert without authentication (should fail for security)
            const { error } = await supabase
                .from('users')
                .insert({
                    id: 'test-id',
                    email: 'test@example.com',
                    display_name: 'Test User',
                    status: 'active'
                });

            if (error) {
                if (error.message.includes('RLS') || error.message.includes('policy') || error.code === '42501') {
                    this.addResult('RLS', 'pass', 'Row Level Security is properly configured');
                } else {
                    this.addResult('RLS', 'warning', 'Unexpected insert error (not RLS-related)', error);
                }
            } else {
                this.addResult('RLS', 'fail', 'RLS may be misconfigured - insert succeeded without auth');
            }
        } catch (error) {
            this.addResult('RLS', 'warning', 'Error testing RLS policies', error);
        }
    }

    private async testAuthFlow() {
        try {
            // Test sign up with a test email
            const testEmail = `test-${Date.now()}@example.com`;
            const testPassword = 'testpass123';

            console.log(`🧪 Testing auth flow with email: ${testEmail}`);

            const { data, error } = await supabase.auth.signUp({
                email: testEmail,
                password: testPassword
            });

            if (error) {
                if (error.message.includes('email') && error.message.includes('confirmation')) {
                    this.addResult('Auth Flow', 'pass', 'Sign up requires email confirmation (expected)');
                } else {
                    this.addResult('Auth Flow', 'fail', 'Sign up failed unexpectedly', error);
                }
            } else if (data.user) {
                // Try to create user profile
                const { error: profileError } = await supabase
                    .from('users')
                    .insert({
                        id: data.user.id,
                        email: data.user.email!,
                        display_name: 'Test User',
                        status: 'active'
                    });

                if (profileError) {
                    this.addResult('Auth Flow', 'fail', 'User profile creation failed', profileError);
                } else {
                    this.addResult('Auth Flow', 'pass', 'Sign up and profile creation successful');

                    // Cleanup: remove test user
                    await supabase.from('users').delete().eq('id', data.user.id);
                }
            }
        } catch (error) {
            this.addResult('Auth Flow', 'fail', 'Auth flow test failed', error);
        }
    }

    getFailedTests(): DiagnosticResult[] {
        return this.results.filter(r => r.status === 'fail');
    }

    getRecommendations(): string[] {
        const recommendations: string[] = [];
        const failed = this.getFailedTests();

        for (const test of failed) {
            switch (test.test) {
                case 'Environment':
                    recommendations.push('Check your .env file and ensure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY are set correctly');
                    break;
                case 'Connectivity':
                    recommendations.push('Check your internet connection and Supabase project status');
                    break;
                case 'Database':
                    recommendations.push('Verify your Supabase database is running and the users table exists');
                    break;
                case 'Schema':
                    recommendations.push('Run the database migrations to create the proper table structure');
                    break;
                case 'RLS':
                    recommendations.push('Check Row Level Security policies in your Supabase dashboard');
                    break;
                case 'Auth Flow':
                    recommendations.push('Check Supabase auth settings and email confirmation requirements');
                    break;
            }
        }

        return recommendations;
    }
}

// Convenience function to run diagnostics
export const runAuthDiagnostics = async (): Promise<DiagnosticResult[]> => {
    const diagnostics = new AuthDiagnostics();
    return await diagnostics.runDiagnostics();
};

// Make diagnostics available globally for debugging
(window as any).runAuthDiagnostics = runAuthDiagnostics; 
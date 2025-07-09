/**
 * Unit Tests for Authentication Diagnostics
 * 
 * Tests the authDiagnostics utility functionality
 * Run with: npm test src/utils/__tests__/authDiagnostics.test.ts
 */

import { AuthDiagnostics, DiagnosticResult } from '../authDiagnostics';
import { supabase } from '../../services/supabase';

// Mock Supabase
jest.mock('../../services/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
            signUp: jest.fn()
        },
        from: jest.fn()
    }
}));

describe('AuthDiagnostics', () => {
    let diagnostics: AuthDiagnostics;

    beforeEach(() => {
        jest.clearAllMocks();
        diagnostics = new AuthDiagnostics();

        // Reset environment variables
        delete (process.env as any).REACT_APP_SUPABASE_URL;
        delete (process.env as any).REACT_APP_SUPABASE_ANON_KEY;
    });

    describe('Environment Variable Tests', () => {
        it('should detect missing environment variables', async () => {
            const results = await diagnostics.runDiagnostics();

            const envResults = results.filter(r => r.test === 'Environment');
            expect(envResults).toHaveLength(2);
            expect(envResults.every(r => r.status === 'fail')).toBe(true);
        });

        it('should validate correct environment variables', async () => {
            (process.env as any).REACT_APP_SUPABASE_URL = 'https://test.supabase.co';
            (process.env as any).REACT_APP_SUPABASE_ANON_KEY = 'a'.repeat(150); // Long enough key

            const results = await diagnostics.runDiagnostics();

            const envResults = results.filter(r => r.test === 'Environment');
            expect(envResults).toHaveLength(2);
            expect(envResults.every(r => r.status === 'pass')).toBe(true);
        });

        it('should warn about potentially incorrect environment variables', async () => {
            (process.env as any).REACT_APP_SUPABASE_URL = 'https://wrong-format.com';
            (process.env as any).REACT_APP_SUPABASE_ANON_KEY = 'short'; // Too short

            const results = await diagnostics.runDiagnostics();

            const envResults = results.filter(r => r.test === 'Environment');
            expect(envResults.some(r => r.status === 'warning')).toBe(true);
        });
    });

    describe('Connectivity Tests', () => {
        it('should pass connectivity test when Supabase responds', async () => {
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: { session: null },
                error: null
            });

            const results = await diagnostics.runDiagnostics();

            const connectivityResult = results.find(r => r.test === 'Connectivity');
            expect(connectivityResult?.status).toBe('pass');
        });

        it('should fail connectivity test when Supabase errors', async () => {
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: null,
                error: new Error('Connection failed')
            });

            const results = await diagnostics.runDiagnostics();

            const connectivityResult = results.find(r => r.test === 'Connectivity');
            expect(connectivityResult?.status).toBe('fail');
        });

        it('should handle network errors', async () => {
            (supabase.auth.getSession as jest.Mock).mockRejectedValue(new Error('Network error'));

            const results = await diagnostics.runDiagnostics();

            const connectivityResult = results.find(r => r.test === 'Connectivity');
            expect(connectivityResult?.status).toBe('fail');
        });
    });

    describe('Database Access Tests', () => {
        it('should pass database test when table is accessible', async () => {
            const mockFromChain = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [],
                    error: null
                })
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            const results = await diagnostics.runDiagnostics();

            const dbResult = results.find(r => r.test === 'Database');
            expect(dbResult?.status).toBe('pass');
        });

        it('should fail database test when table is inaccessible', async () => {
            const mockFromChain = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: null,
                    error: new Error('Table not found')
                })
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            const results = await diagnostics.runDiagnostics();

            const dbResult = results.find(r => r.test === 'Database');
            expect(dbResult?.status).toBe('fail');
        });
    });

    describe('Schema Tests', () => {
        it('should pass schema test when all columns exist', async () => {
            const mockFromChain = {
                select: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: [{ id: '1', email: 'test@example.com' }],
                    error: null
                })
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            const results = await diagnostics.runDiagnostics();

            const schemaResult = results.find(r => r.test === 'Schema');
            expect(schemaResult?.status).toBe('pass');
        });

        it('should fail schema test when columns are missing', async () => {
            const mockFromChain = {
                select: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({
                    data: null,
                    error: new Error('Column not found')
                })
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            const results = await diagnostics.runDiagnostics();

            const schemaResult = results.find(r => r.test === 'Schema');
            expect(schemaResult?.status).toBe('fail');
        });
    });

    describe('RLS Policy Tests', () => {
        it('should pass RLS test when policies block unauthorized access', async () => {
            const mockFromChain = {
                insert: jest.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'RLS policy violation', code: '42501' }
                })
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            const results = await diagnostics.runDiagnostics();

            const rlsResult = results.find(r => r.test === 'RLS');
            expect(rlsResult?.status).toBe('pass');
        });

        it('should fail RLS test when unauthorized access succeeds', async () => {
            const mockFromChain = {
                insert: jest.fn().mockResolvedValue({
                    data: { id: '1' },
                    error: null
                })
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            const results = await diagnostics.runDiagnostics();

            const rlsResult = results.find(r => r.test === 'RLS');
            expect(rlsResult?.status).toBe('fail');
        });
    });

    describe('Auth Flow Tests', () => {
        it('should pass auth flow test when email confirmation is required', async () => {
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({
                data: null,
                error: { message: 'email confirmation required' }
            });

            const results = await diagnostics.runDiagnostics();

            const authResult = results.find(r => r.test === 'Auth Flow');
            expect(authResult?.status).toBe('pass');
        });

        it('should handle successful signup with profile creation', async () => {
            const mockUser = { id: 'test-id', email: 'test@example.com' };

            (supabase.auth.signUp as jest.Mock).mockResolvedValue({
                data: { user: mockUser },
                error: null
            });

            const mockFromChain = {
                insert: jest.fn().mockResolvedValue({
                    data: { id: mockUser.id },
                    error: null
                }),
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null
                })
            };

            (supabase.from as jest.Mock).mockReturnValue(mockFromChain);

            const results = await diagnostics.runDiagnostics();

            const authResult = results.find(r => r.test === 'Auth Flow');
            expect(authResult?.status).toBe('pass');
        });

        it('should fail auth flow test when signup fails unexpectedly', async () => {
            (supabase.auth.signUp as jest.Mock).mockResolvedValue({
                data: null,
                error: { message: 'Unexpected error' }
            });

            const results = await diagnostics.runDiagnostics();

            const authResult = results.find(r => r.test === 'Auth Flow');
            expect(authResult?.status).toBe('fail');
        });
    });

    describe('Result Analysis', () => {
        it('should correctly identify failed tests', async () => {
            // Mock some failures
            (supabase.auth.getSession as jest.Mock).mockResolvedValue({
                data: null,
                error: new Error('Connection failed')
            });

            const results = await diagnostics.runDiagnostics();
            const failedTests = diagnostics.getFailedTests();

            expect(failedTests.length).toBeGreaterThan(0);
            expect(failedTests.every(test => test.status === 'fail')).toBe(true);
        });

        it('should provide recommendations for failed tests', async () => {
            // Mock failures
            (supabase.auth.getSession as jest.Mock).mockRejectedValue(new Error('Network error'));

            await diagnostics.runDiagnostics();
            const recommendations = diagnostics.getRecommendations();

            expect(recommendations.length).toBeGreaterThan(0);
            expect(recommendations.every(rec => typeof rec === 'string')).toBe(true);
        });
    });
}); 
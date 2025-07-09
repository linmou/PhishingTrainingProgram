import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/LoginForm';
import SignupForm from '../components/SignupForm';
import RoleSelection from '../components/RoleSelection';
import { runAuthDiagnostics, DiagnosticResult } from '../utils/authDiagnostics';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, loading } = useAuth();
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [showDiagnostics, setShowDiagnostics] = useState(false);
    const [diagnosticResults, setDiagnosticResults] = useState<DiagnosticResult[]>([]);

    // Redirect based on user role
    useEffect(() => {
        if (user?.current_role) {
            navigate(`/${user.current_role}`);
        }
    }, [user, navigate]);

    const toggleAuthMode = () => {
        setIsLoginMode(!isLoginMode);
    };

    const handleRunDiagnostics = async () => {
        console.log('🔍 Running authentication diagnostics...');
        setShowDiagnostics(true);
        const results = await runAuthDiagnostics();
        setDiagnosticResults(results);
    };

    const renderDiagnostics = () => {
        if (!showDiagnostics) return null;

        const passed = diagnosticResults.filter(r => r.status === 'pass').length;
        const failed = diagnosticResults.filter(r => r.status === 'fail').length;
        const warnings = diagnosticResults.filter(r => r.status === 'warning').length;

        return (
            <div style={{
                marginTop: '20px',
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '5px',
                backgroundColor: '#f9f9f9'
            }}>
                <h3>🔍 Authentication Diagnostics Results</h3>
                <p><strong>Summary:</strong> ✅ {passed} passed, ❌ {failed} failed, ⚠️ {warnings} warnings</p>

                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {diagnosticResults.map((result, index) => (
                        <div key={index} style={{
                            margin: '5px 0',
                            padding: '5px',
                            borderLeft: `3px solid ${result.status === 'pass' ? 'green' : result.status === 'fail' ? 'red' : 'orange'}`
                        }}>
                            <strong>{result.test}:</strong> {result.message}
                            {result.error && (
                                <details style={{ marginTop: '5px', fontSize: '0.9em' }}>
                                    <summary>Error Details</summary>
                                    <pre style={{ fontSize: '0.8em', overflow: 'auto' }}>
                                        {JSON.stringify(result.error, null, 2)}
                                    </pre>
                                </details>
                            )}
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => setShowDiagnostics(false)}
                    style={{ marginTop: '10px', padding: '5px 10px' }}
                >
                    Hide Diagnostics
                </button>
            </div>
        );
    };

    // Show loading state
    if (loading) {
        return (
            <div className="container">
                <div className="card">
                    <div className="loading-message">Loading...</div>
                </div>
            </div>
        );
    }

    // Show role selection for authenticated users without a role
    if (user && !user.current_role) {
        return <RoleSelection />;
    }

    // Show authentication forms for unauthenticated users
    if (!user) {
        return (
            <div className="container">
                <div className="card">
                    <h1>Welcome to Tutor System</h1>
                    <p>1v1 Online Tutor-Student Training Platform</p>

                    {isLoginMode ? (
                        <LoginForm onToggleMode={toggleAuthMode} />
                    ) : (
                        <SignupForm onToggleMode={toggleAuthMode} />
                    )}

                    {/* Diagnostics Section */}
                    <div style={{ marginTop: '20px', textAlign: 'center' }}>
                        <button
                            onClick={handleRunDiagnostics}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.9em'
                            }}
                        >
                            🔧 Run Auth Diagnostics
                        </button>
                        <p style={{ fontSize: '0.8em', color: '#666', margin: '5px 0' }}>
                            Having trouble signing in/up? Click to diagnose issues.
                        </p>
                    </div>

                    {renderDiagnostics()}
                </div>
            </div>
        );
    }

    // This should not happen as users with roles are redirected above
    return null;
};

export default HomePage; 
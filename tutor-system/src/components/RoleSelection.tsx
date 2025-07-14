import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

const RoleSelection: React.FC = () => {
    const { user, setUserRole, signOut } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleRoleSelect = async (role: UserRole) => {
        setError('');
        setIsLoading(true);

        try {
            await setUserRole(role);
        } catch (err: any) {
            setError(err.message || 'Failed to set role');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
        } catch (err: any) {
            console.error('Error signing out:', err);
        }
    };

    return (
        <div className="container">
            <div className="card">
                <div className="auth-header">
                    <h1>Welcome, {user?.display_name}!</h1>
                    <button
                        type="button"
                        className="sign-out-button"
                        onClick={handleSignOut}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Leave Session
                    </button>
                </div>

                <p>1v1 Online Tutor-Student Training Platform</p>

                {user?.current_role ? (
                    <>
                        <p>Your current role: <strong>{user.current_role.charAt(0).toUpperCase() + user.current_role.slice(1)}</strong></p>
                        <h2>Change Your Role</h2>
                    </>
                ) : (
                    <h2>Choose Your Role</h2>
                )}

                {error && <div className="error-message" style={{
                    color: 'red',
                    marginBottom: '15px',
                    padding: '10px',
                    backgroundColor: '#ffe6e6',
                    border: '1px solid #ff9999',
                    borderRadius: '4px'
                }}>{error}</div>}

                <div className="role-selection">
                    <div
                        className={`role-card ${isLoading ? 'disabled' : ''} ${user?.current_role === 'student' ? 'selected' : ''}`}
                        onClick={() => !isLoading && handleRoleSelect('student')}
                        style={{
                            padding: '20px',
                            border: user?.current_role === 'student' ? '2px solid #007bff' : '1px solid #ddd',
                            borderRadius: '8px',
                            margin: '10px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            backgroundColor: user?.current_role === 'student' ? '#f0f8ff' : '#fff',
                            opacity: isLoading ? 0.6 : 1
                        }}
                    >
                        <h3>Student</h3>
                        <p>Join rooms and participate in learning sessions</p>
                    </div>

                    <div
                        className={`role-card ${isLoading ? 'disabled' : ''} ${user?.current_role === 'tutor' ? 'selected' : ''}`}
                        onClick={() => !isLoading && handleRoleSelect('tutor')}
                        style={{
                            padding: '20px',
                            border: user?.current_role === 'tutor' ? '2px solid #007bff' : '1px solid #ddd',
                            borderRadius: '8px',
                            margin: '10px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            backgroundColor: user?.current_role === 'tutor' ? '#f0f8ff' : '#fff',
                            opacity: isLoading ? 0.6 : 1
                        }}
                    >
                        <h3>Tutor</h3>
                        <p>Create rooms and teach students</p>
                    </div>

                    <div
                        className={`role-card ${isLoading ? 'disabled' : ''} ${user?.current_role === 'observer' ? 'selected' : ''}`}
                        onClick={() => !isLoading && handleRoleSelect('observer')}
                        style={{
                            padding: '20px',
                            border: user?.current_role === 'observer' ? '2px solid #007bff' : '1px solid #ddd',
                            borderRadius: '8px',
                            margin: '10px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            backgroundColor: user?.current_role === 'observer' ? '#f0f8ff' : '#fff',
                            opacity: isLoading ? 0.6 : 1
                        }}
                    >
                        <h3>Observer</h3>
                        <p>Watch sessions and learn</p>
                    </div>
                </div>

                {isLoading && (
                    <div className="loading-message" style={{
                        marginTop: '15px',
                        textAlign: 'center',
                        color: '#666'
                    }}>
                        Setting your role...
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoleSelection; 
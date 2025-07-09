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
                    >
                        Sign Out
                    </button>
                </div>

                <p>1v1 Online Tutor-Student Training Platform</p>

                <h2>Choose Your Role</h2>
                {error && <div className="error-message">{error}</div>}

                <div className="role-selection">
                    <div
                        className={`role-card ${isLoading ? 'disabled' : ''}`}
                        onClick={() => !isLoading && handleRoleSelect('student')}
                    >
                        <h3>Student</h3>
                        <p>Join rooms and participate in learning sessions</p>
                        <small>Maximum: 1 student at a time</small>
                    </div>

                    <div
                        className={`role-card ${isLoading ? 'disabled' : ''}`}
                        onClick={() => !isLoading && handleRoleSelect('tutor')}
                    >
                        <h3>Tutor</h3>
                        <p>Create rooms and teach students</p>
                        <small>Maximum: 1 tutor at a time</small>
                    </div>

                    <div
                        className={`role-card ${isLoading ? 'disabled' : ''}`}
                        onClick={() => !isLoading && handleRoleSelect('observer')}
                    >
                        <h3>Observer</h3>
                        <p>Watch sessions and learn</p>
                        <small>Unlimited observers allowed</small>
                    </div>
                </div>

                {isLoading && (
                    <div className="loading-message">
                        Setting your role...
                    </div>
                )}
            </div>
        </div>
    );
};

export default RoleSelection; 
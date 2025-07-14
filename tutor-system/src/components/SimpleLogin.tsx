import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

const SimpleLogin: React.FC = () => {
    const [displayName, setDisplayName] = useState('');
    const [selectedRole, setSelectedRole] = useState<UserRole>('student');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { joinWithNameAndRole } = useAuth();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!displayName.trim()) {
            setError('Please enter your name');
            return;
        }

        setIsLoading(true);

        try {
            console.log('🚀 SimpleLogin: Calling joinWithNameAndRole...', { displayName, selectedRole });
            await joinWithNameAndRole(displayName.trim(), selectedRole);
            console.log('✅ SimpleLogin: Join completed successfully');
            // If we reach here, the join was successful and the user should be set
        } catch (err: any) {
            console.error('❌ SimpleLogin: Join failed:', err);
            console.error('❌ SimpleLogin: Error details:', {
                message: err.message,
                stack: err.stack,
                name: err.name
            });
            setError(err.message || 'Failed to join');
        } finally {
            console.log('🔄 SimpleLogin: Setting loading to false');
            setIsLoading(false);
        }
    };

    return (
        <div className="container">
            <div className="card">
                <h1>Welcome to Tutor System</h1>
                <p>1v1 Online Tutor-Student Training Platform</p>

                <form onSubmit={handleSubmit} className="simple-login-form">
                    <div className="form-group">
                        <label htmlFor="displayName">Your Name:</label>
                        <input
                            type="text"
                            id="displayName"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Enter your name"
                            required
                            disabled={isLoading}
                            style={{
                                padding: '10px',
                                fontSize: '16px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                width: '100%',
                                marginBottom: '15px'
                            }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Choose Your Role:</label>
                        <div className="role-selection" style={{ marginTop: '10px' }}>
                            <div className="role-options">
                                <label className="role-option">
                                    <input
                                        type="radio"
                                        name="role"
                                        value="student"
                                        checked={selectedRole === 'student'}
                                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                                        disabled={isLoading}
                                    />
                                    <div className="role-info">
                                        <strong>Student</strong>
                                        <p>Join rooms and participate in learning sessions</p>
                                    </div>
                                </label>

                                <label className="role-option">
                                    <input
                                        type="radio"
                                        name="role"
                                        value="tutor"
                                        checked={selectedRole === 'tutor'}
                                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                                        disabled={isLoading}
                                    />
                                    <div className="role-info">
                                        <strong>Tutor</strong>
                                        <p>Create rooms and teach students</p>
                                    </div>
                                </label>

                                <label className="role-option">
                                    <input
                                        type="radio"
                                        name="role"
                                        value="observer"
                                        checked={selectedRole === 'observer'}
                                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                                        disabled={isLoading}
                                    />
                                    <div className="role-info">
                                        <strong>Observer</strong>
                                        <p>Watch sessions and learn</p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {error && <div className="error-message" style={{
                        color: 'red',
                        marginBottom: '15px',
                        padding: '10px',
                        backgroundColor: '#ffe6e6',
                        border: '1px solid #ff9999',
                        borderRadius: '4px'
                    }}>{error}</div>}

                    <button
                        type="submit"
                        disabled={isLoading}
                        style={{
                            width: '100%',
                            padding: '12px',
                            fontSize: '16px',
                            backgroundColor: isLoading ? '#ccc' : '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isLoading ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {isLoading ? 'Joining...' : 'Join Session'}
                    </button>
                </form>

                {isLoading && (
                    <div className="loading-message" style={{
                        marginTop: '15px',
                        textAlign: 'center',
                        color: '#666'
                    }}>
                        Setting up your session...
                        <br />
                        <small style={{ color: '#999', marginTop: '5px', display: 'block' }}>
                            If this takes too long, the app will switch to offline mode
                        </small>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SimpleLogin; 
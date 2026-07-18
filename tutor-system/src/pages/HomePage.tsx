import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SimpleLogin from '../components/SimpleLogin';
import RoleSelection from '../components/RoleSelection';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, loading } = useAuth();

    // Redirect based on user role
    useEffect(() => {
        if (user?.current_role && !loading) {
            navigate(`/${user.current_role}`);
        }
    }, [user, navigate, loading]);

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

    // Show simple login for unauthenticated users
    if (!user) {
        return <SimpleLogin />;
    }

    // Users with roles are redirected above
    return null;
};

export default HomePage;

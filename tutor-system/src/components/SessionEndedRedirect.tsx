import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Returns this tab to sign-in when its session ended because of another tab (AuthContext sessionNotice). */
const SessionEndedRedirect: React.FC = () => {
    const { sessionNotice } = useAuth();
    const navigate = useNavigate();
    useEffect(() => {
        if (sessionNotice) navigate('/', { replace: true });
    }, [sessionNotice, navigate]);
    return null;
};

export default SessionEndedRedirect;

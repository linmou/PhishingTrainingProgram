import React from 'react';
import { Link } from 'react-router-dom';

const ObserverView: React.FC = () => {
    return (
        <div className="container">
            <div className="card">
                <h1>Observer Dashboard</h1>
                <p>Welcome! You are logged in as an Observer.</p>

                <h2>Available Rooms to Observe</h2>
                <div className="waiting-message">
                    <p>No active rooms available to observe.</p>
                    <p>[Room browsing will be implemented in Task 6]</p>
                </div>

                <Link to="/" className="btn btn-secondary">Back to Home</Link>
            </div>
        </div>
    );
};

export default ObserverView; 
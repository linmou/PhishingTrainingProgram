import React from 'react';
import { Link } from 'react-router-dom';

const StudentView: React.FC = () => {
    return (
        <div className="container">
            <div className="card">
                <h1>Student Dashboard</h1>
                <p>Welcome! You are logged in as a Student.</p>

                <div className="capacity-status">
                    <p>Capacity Status: [Will be implemented in Task 4]</p>
                </div>

                <h2>Available Rooms</h2>
                <div className="waiting-message">
                    <p>No rooms available. Please wait for a tutor to create a room.</p>
                    <p>[Room browsing will be implemented in Task 6]</p>
                </div>

                <Link to="/" className="btn btn-secondary">Back to Home</Link>
            </div>
        </div>
    );
};

export default StudentView; 
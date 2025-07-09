import React from 'react';
import { Link } from 'react-router-dom';

const TutorView: React.FC = () => {
    return (
        <div className="container">
            <div className="card">
                <h1>Tutor Dashboard</h1>
                <p>Welcome! You are logged in as a Tutor.</p>

                <div className="capacity-status">
                    <p>Capacity Status: [Will be implemented in Task 4]</p>
                </div>

                <h2>Create New Room</h2>
                <div className="form-group">
                    <label>Room Title</label>
                    <input type="text" placeholder="Enter room title" />
                </div>
                <div className="form-group">
                    <label>Description</label>
                    <textarea placeholder="Enter room description"></textarea>
                </div>
                <div className="form-group">
                    <label>Upload Image</label>
                    <input type="file" accept="image/*" />
                </div>
                <button className="btn btn-primary" disabled>
                    Create Room [Task 5]
                </button>

                <h2>Your Rooms</h2>
                <p>[Room management will be implemented in Task 5]</p>

                <Link to="/" className="btn btn-secondary">Back to Home</Link>
            </div>
        </div>
    );
};

export default TutorView; 
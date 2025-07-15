import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RoomProvider } from './contexts/RoomContext';
import HomePage from './pages/HomePage';
import StudentView from './pages/StudentView';
import TutorView from './pages/TutorView';
import ObserverView from './pages/ObserverView';
import RoomPagePost from './pages/RoomPagePost';
import UserProfile from './pages/UserProfile';
import './App.css';

function App() {
    return (
        <div className="App">
            <AuthProvider>
                <RoomProvider>
                    <Router>
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/student" element={<StudentView />} />
                            <Route path="/tutor" element={<TutorView />} />
                            <Route path="/observer" element={<ObserverView />} />
                            <Route path="/room/:roomId" element={<RoomPagePost />} />
                            <Route path="/profile" element={<UserProfile />} />
                        </Routes>
                    </Router>
                </RoomProvider>
            </AuthProvider>
        </div>
    );
}

export default App; 
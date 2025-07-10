import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Database } from '../types/database';
import RoomCard from '../components/RoomCard';

type Room = Database['public']['Tables']['rooms']['Row'];
type User = Database['public']['Tables']['users']['Row'];

interface RoomWithTutor extends Room {
    tutor?: User;
}

const ObserverView: React.FC = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState<RoomWithTutor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRooms();
    }, []);

    const fetchRooms = async () => {
        try {
            // Fetch active rooms with tutor information
            const { data: roomsData, error } = await supabase
                .from('rooms')
                .select(`
                    *,
                    tutor:users!tutor_id(*)
                `)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching rooms:', error);
                return;
            }

            // For observers, we don't need to check capacity restrictions
            // Observers can join any room regardless of student capacity
            setRooms(roomsData || []);
        } catch (err) {
            console.error('Error in fetchRooms:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleObserveRoom = (roomId: string) => {
        navigate(`/room/${roomId}`);
    };

    return (
        <div className="container">
            <div className="card">
                <h1>Observer Dashboard</h1>
                <p>Welcome! You are logged in as an Observer.</p>

                <h2>Available Rooms to Observe</h2>
                {loading ? (
                    <p>Loading rooms...</p>
                ) : rooms.length > 0 ? (
                    <div className="rooms-list">
                        {rooms.map((room) => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                tutor={room.tutor || null}
                                onJoin={handleObserveRoom}
                                joinButtonText="Observe Room"
                                roomStatus="Available"
                                isJoinDisabled={false}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="waiting-message">
                        <p>No rooms available</p>
                        <p>Please wait for a tutor to create a room</p>
                    </div>
                )}

                <Link to="/" className="btn btn-secondary">Back to Home</Link>
            </div>
        </div>
    );
};

export default ObserverView; 
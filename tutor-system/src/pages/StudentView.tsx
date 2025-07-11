import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Database } from '../types/database';
import RoomCard from '../components/RoomCard';
import { useAuth } from '../contexts/AuthContext';

type Room = Database['public']['Tables']['rooms']['Row'];
type User = Database['public']['Tables']['users']['Row'];

interface RoomWithTutor extends Room {
    tutor?: User;
}

interface RoomWithStatus extends RoomWithTutor {
    status: string;
    isJoinDisabled: boolean;
}

const StudentView: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [rooms, setRooms] = useState<RoomWithStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRooms = useCallback(async () => {
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

            // Check capacity for each room
            const roomsWithStatus = await Promise.all(
                (roomsData || []).map(async (room) => {
                    const { data: sessionData, error: sessionError } = await supabase
                        .from('sessions')
                        .select('*')
                        .eq('room_id', room.id)
                        .eq('status', 'active')
                        .single();

                    // If no session found (PGRST116 error) or session error, room is available
                    const hasActiveSession = sessionData && !sessionError;
                    const status = hasActiveSession ? 'Room Full' : 'Available';
                    const isJoinDisabled = hasActiveSession;

                    return {
                        ...room,
                        status,
                        isJoinDisabled
                    } as RoomWithStatus;
                })
            );

            setRooms(roomsWithStatus);
        } catch (err) {
            console.error('Error in fetchRooms:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRooms();

        // Set up real-time subscription for room changes
        const roomSubscription = supabase
            .channel('rooms_channel')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'rooms'
                },
                (payload) => {
                    console.log('Room change detected:', payload);
                    // Refetch rooms when there are changes
                    fetchRooms();
                }
            )
            .subscribe();

        // Set up real-time subscription for session changes
        const sessionSubscription = supabase
            .channel('sessions_channel')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'sessions'
                },
                (payload) => {
                    console.log('Session change detected:', payload);
                    // Refetch rooms when session status changes (affects room availability)
                    fetchRooms();
                }
            )
            .subscribe();

        return () => {
            roomSubscription.unsubscribe();
            sessionSubscription.unsubscribe();
        };
    }, [fetchRooms]);

    const handleJoinRoom = async (roomId: string) => {
        try {
            setError(null);
            
            if (!user) {
                setError('You must be logged in to join a room.');
                return;
            }
            
            // First, get the room details to find the tutor_id
            const room = rooms.find(r => r.id === roomId);
            if (!room) {
                setError('Room not found.');
                return;
            }
            
            // Debug logging
            console.log('Attempting to join room:', {
                roomId,
                tutorId: room.tutor_id,
                studentId: user.id,
                userObject: user
            });
            
            // First verify the user exists in the database
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();
                
            if (userError || !userData) {
                console.error('User not found in database:', userError);
                setError('User not found. Please log out and log back in.');
                return;
            }
            
            console.log('User found in database:', userData);
            
            // Check if we can join by attempting to create a session
            const { data: sessionData, error: joinError } = await supabase
                .from('sessions')
                .insert({ 
                    room_id: roomId,
                    tutor_id: room.tutor_id,
                    student_id: user.id,
                    status: 'active'
                })
                .select();
                
            if (joinError) {
                console.error('Join error:', joinError);
                // Provide more specific error messages
                if (joinError.code === '23503') {
                    setError('User not found. Please ensure you are properly logged in.');
                } else if (joinError.code === '23505') {
                    setError('You are already in this room.');
                } else if (joinError.code === '42501') {
                    setError('Permission denied. Please check your access rights.');
                } else {
                    setError(`Failed to join the room: ${joinError.message || 'Unknown error'}`);
                }
                return;
            }
            
            console.log('Session created successfully:', sessionData);
            navigate(`/room/${roomId}`);
        } catch (err) {
            console.error('Error joining room:', err);
            setError('Failed to join the room. Please try again.');
        }
    };

    return (
        <div className="container">
            <div className="card">
                <h1>Student Dashboard</h1>
                <p>Welcome! You are logged in as a Student.</p>

                <div className="capacity-status">
                    <p>Capacity Status: [Will be implemented in Task 4]</p>
                </div>

                <h2>Available Rooms</h2>
                {error && <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
                {loading ? (
                    <p>Loading rooms...</p>
                ) : rooms.length > 0 ? (
                    <div className="rooms-list">
                        {rooms.map((room) => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                tutor={room.tutor || null}
                                onJoin={handleJoinRoom}
                                roomStatus={room.status}
                                isJoinDisabled={room.isJoinDisabled}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="waiting-message">
                        <p>No rooms available</p>
                        <p>Please wait for a tutor to create a room.</p>
                    </div>
                )}

                <Link to="/" className="btn btn-secondary">Back to Home</Link>
            </div>
        </div>
    );
};

export default StudentView; 
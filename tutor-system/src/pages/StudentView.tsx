import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Database } from '../types/database';
import RoomCard from '../components/RoomCard';

type Room = Database['public']['Tables']['rooms']['Row'];
type User = Database['public']['Tables']['users']['Row'];
type Session = Database['public']['Tables']['sessions']['Row'];

interface RoomWithTutor extends Room {
    tutor?: User;
}

interface RoomWithStatus extends RoomWithTutor {
    status: string;
    isJoinDisabled: boolean;
}

const StudentView: React.FC = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState<RoomWithStatus[]>([]);
    const [loading, setLoading] = useState(true);

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

    const handleJoinRoom = (roomId: string) => {
        navigate(`/room/${roomId}`);
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
                        <p>Please wait for a tutor to create a room</p>
                    </div>
                )}

                <Link to="/" className="btn btn-secondary">Back to Home</Link>
            </div>
        </div>
    );
};

export default StudentView; 
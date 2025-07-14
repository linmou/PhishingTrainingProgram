import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { Database } from '../types/database';
import RoomCard from '../components/RoomCard';
import AvatarDisplay from '../components/AvatarDisplay';
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
            console.log('🔍 StudentView: Fetching rooms...');
            
            // Add timeout and retry logic for room fetching
            let roomsData = null;
            let fetchError = null;
            
            for (let attempt = 1; attempt <= 2; attempt++) {
                try {
                    console.log(`🔍 StudentView: Fetch attempt ${attempt}/2...`);
                    
                    const result = await supabase
                        .from('rooms')
                        .select(`
                            *,
                            tutor:users!tutor_id(*)
                        `)
                        .eq('is_active', true)
                        .order('created_at', { ascending: false });

                    if (result.error) {
                        fetchError = result.error;
                        console.warn(`⚠️ StudentView: Fetch attempt ${attempt} failed:`, result.error);
                    } else {
                        roomsData = result.data;
                        console.log('✅ StudentView: Rooms fetched successfully');
                        break;
                    }
                } catch (err) {
                    fetchError = err;
                    console.warn(`⚠️ StudentView: Fetch attempt ${attempt} failed:`, err);
                }
                
                // Wait before retry
                if (attempt < 2) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            if (!roomsData && fetchError) {
                console.error('❌ StudentView: All fetch attempts failed, using offline mode');
                setError('Unable to connect to server. Showing offline mode.');
                // Set empty rooms array in offline mode
                setRooms([]);
                return;
            }

            // No capacity limits - all rooms are always available
            const roomsWithStatus = (roomsData || []).map((room) => ({
                ...room,
                status: 'Available',
                isJoinDisabled: false
            } as RoomWithStatus));

            setRooms(roomsWithStatus);
            setError(null); // Clear any previous errors
            
        } catch (err) {
            console.error('❌ StudentView: Unexpected error in fetchRooms:', err);
            setError('Unable to load rooms. Please try again later.');
            setRooms([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchRooms();

        // Only set up real-time subscriptions if we're not in offline mode
        let roomSubscription: any = null;
        let sessionSubscription: any = null;

        // Add a delay before setting up subscriptions to see if the initial fetch works
        const setupSubscriptions = setTimeout(() => {
            if (!error) { // Only setup subscriptions if no error occurred during fetch
                try {
                    console.log('🔄 StudentView: Setting up real-time subscriptions...');
                    
                    // Set up real-time subscription for room changes
                    roomSubscription = supabase
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
                    sessionSubscription = supabase
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
                    
                    console.log('✅ StudentView: Real-time subscriptions setup complete');
                } catch (subscriptionError) {
                    console.warn('⚠️ StudentView: Failed to setup subscriptions:', subscriptionError);
                }
            } else {
                console.log('📴 StudentView: Skipping subscriptions due to offline mode');
            }
        }, 3000);

        return () => {
            clearTimeout(setupSubscriptions);
            if (roomSubscription) {
                roomSubscription.unsubscribe();
            }
            if (sessionSubscription) {
                sessionSubscription.unsubscribe();
            }
        };
    }, [fetchRooms, error]);

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
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem'
                }}>
                    <div>
                        <h1 style={{ margin: 0 }}>Student Dashboard</h1>
                        <p style={{ margin: '0.5rem 0 0 0' }}>Welcome! You are logged in as a Student.</p>
                    </div>
                    <Link 
                        to="/profile" 
                        className="nav-profile-link"
                        style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <AvatarDisplay
                            avatarUrl={user?.avatar_url}
                            displayName={user?.display_name || 'User'}
                            size="small"
                            className="nav-avatar"
                        />
                        <span>Profile</span>
                    </Link>
                </div>


                <h2>Available Rooms</h2>
                {error && (
                    <div className="error-message" style={{ 
                        color: 'red', 
                        marginBottom: '15px',
                        padding: '10px',
                        backgroundColor: '#ffe6e6',
                        border: '1px solid #ff9999',
                        borderRadius: '4px'
                    }}>
                        {error}
                        <br />
                        <button 
                            onClick={() => {
                                setError(null);
                                setLoading(true);
                                fetchRooms();
                            }}
                            style={{
                                marginTop: '10px',
                                padding: '8px 16px',
                                backgroundColor: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            Try Again
                        </button>
                    </div>
                )}
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
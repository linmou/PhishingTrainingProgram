import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, getRoomsByObserver, joinRoomAsObserver } from '../services/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Database } from '../types/database';
import RoomCard from '../components/RoomCard';
import AvatarDisplay from '../components/AvatarDisplay';

type Room = Database['public']['Tables']['rooms']['Row'];
type User = Database['public']['Tables']['users']['Row'];

interface RoomWithTutor extends Room {
    tutor?: User;
}

const ObserverView: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [rooms, setRooms] = useState<RoomWithTutor[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    // Handle window resize for responsive design
    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchRooms = useCallback(async () => {
        try {
            const roomsData = await getRoomsByObserver();
            setRooms(roomsData || []);
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
            .channel('observer_rooms_channel')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'rooms'
                },
                (payload) => {
                    console.log('Observer: Room change detected:', payload);
                    // Refetch rooms when there are changes
                    fetchRooms();
                }
            )
            .subscribe();

        return () => {
            roomSubscription.unsubscribe();
        };
    }, [fetchRooms]);

    const handleObserveRoom = async (roomId: string) => {
        try {
            setError(null); // Clear any previous errors
            
            if (!user?.id) {
                setError('User not authenticated.');
                return;
            }
            
            await joinRoomAsObserver(roomId, user.id);
            navigate(`/room/${roomId}`);
        } catch (err: any) {
            console.error('Error joining room as observer:', err);
            setError('Failed to join the room. Please try again.');
        }
    };

    // Determine layout classes based on screen size
    const isMobile = windowWidth < 768;
    const isDesktop = windowWidth >= 1024;
    const layoutClasses = isMobile ? 'mobile-layout' : isDesktop ? 'desktop-layout' : 'tablet-layout';

    return (
        <div className="container">
            <div className={`card ${layoutClasses}`} data-testid="observer-dashboard">
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '1rem'
                }}>
                    <div>
                        <h1 style={{ margin: 0 }}>Observer Dashboard</h1>
                        <p style={{ margin: '0.5rem 0 0 0' }}>Welcome! You are logged in as an Observer.</p>
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
                {error && <div className="error-message" style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
                {loading ? (
                    <p>Loading rooms...</p>
                ) : rooms.length > 0 ? (
                    <div className={`rooms-list ${isDesktop ? 'grid-layout' : 'list-layout'}`} data-testid="room-list">
                        {rooms.map((room) => (
                            <RoomCard
                                key={room.id}
                                room={room}
                                tutor={room.tutor || null}
                                onJoin={handleObserveRoom}
                                joinButtonText="Join"
                                roomStatus="Available"
                                isJoinDisabled={false}
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

export default ObserverView; 
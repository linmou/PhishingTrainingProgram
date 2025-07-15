import React from 'react';
import { Database } from '../types/database';
import AvatarDisplay from './AvatarDisplay';

type Room = Database['public']['Tables']['rooms']['Row'];
type User = Database['public']['Tables']['users']['Row'];

interface RoomCardProps {
    room: Room;
    tutor: User | null;
    onJoin: (roomId: string) => void;
    isJoinDisabled?: boolean;
    joinButtonText?: string;
    roomStatus?: string;
    showOp?: boolean;
}

const RoomCard: React.FC<RoomCardProps> = ({ 
    room, 
    tutor, 
    onJoin, 
    isJoinDisabled = false,
    joinButtonText = 'Join Room',
    roomStatus = 'Available',
    showOp = false
}) => {
    return (
        <div className="room-card" data-testid={`room-card-${room.id}`} style={{
            border: '1px solid #ddd',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '15px',
            backgroundColor: '#f9f9f9'
        }}>
            {room.image_url && (
                <img 
                    src={room.image_url} 
                    alt={room.title}
                    style={{
                        width: '100%',
                        height: '150px',
                        objectFit: 'cover',
                        borderRadius: '4px',
                        marginBottom: '10px'
                    }}
                />
            )}
            <h3>{room.title}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <strong>{showOp ? 'OP:' : 'Tutor:'}</strong>
                <AvatarDisplay
                    avatarUrl={showOp ? room.op_avatar_url : tutor?.avatar_url}
                    displayName={showOp ? (room.op_display_name || 'Unknown') : (tutor?.display_name || 'Unknown')}
                    size="small"
                    className="room-card-avatar"
                />
                <span>{showOp ? (room.op_display_name || 'Unknown') : (tutor?.display_name || 'Unknown')}</span>
            </div>
            {room.description && <p><strong>Description:</strong> {room.description}</p>}
            <p><strong>Status:</strong> {roomStatus}</p>
            {roomStatus === 'Room Full' && <span>Full</span>}
            <button
                onClick={() => onJoin(room.id)}
                disabled={isJoinDisabled}
                style={{
                    width: '100%',
                    padding: '8px',
                    marginTop: '10px',
                    backgroundColor: isJoinDisabled ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isJoinDisabled ? 'not-allowed' : 'pointer'
                }}
            >
                {joinButtonText}
            </button>
        </div>
    );
};

export default RoomCard;
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
    const statusClass = roomStatus === 'Room Full' ? 'full' : 'available';
    
    return (
        <div className="room-card" data-testid={`room-card-${room.id}`}>
            {room.image_url && (
                <img 
                    src={room.image_url} 
                    alt={room.title}
                    className="room-card-image"
                />
            )}
            <div className="room-card-content">
                <h3 className="room-card-title">{room.title}</h3>
                
                <div className="room-card-meta">
                    <span className="room-card-meta-label">{showOp ? 'OP:' : 'Tutor:'}</span>
                    <div className="room-card-meta-info">
                        <AvatarDisplay
                            avatarUrl={showOp ? room.op_avatar_url : tutor?.avatar_url}
                            displayName={showOp ? (room.op_display_name || 'Unknown') : (tutor?.display_name || 'Unknown')}
                            size="small"
                            className="room-card-avatar"
                        />
                        <span className="room-card-meta-name">
                            {showOp ? (room.op_display_name || 'Unknown') : (tutor?.display_name || 'Unknown')}
                        </span>
                    </div>
                </div>
                
                {room.description && (
                    <p className="room-card-description">{room.description}</p>
                )}
                
                <div className={`room-card-status ${statusClass}`}>
                    {roomStatus === 'Room Full' ? '🔒 Room Full' : '🟢 Available'}
                </div>
                
                <button
                    onClick={() => onJoin(room.id)}
                    disabled={isJoinDisabled}
                    className="room-card-button"
                >
                    {joinButtonText}
                </button>
            </div>
        </div>
    );
};

export default RoomCard;
import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import './FeedbackRating.css';

interface FeedbackRatingProps {
    isLike: boolean;
    onSubmit: (rating: number) => void;
    onCancel: () => void;
    currentRating?: number;
}

const FeedbackRating: React.FC<FeedbackRatingProps> = ({
    isLike,
    onSubmit,
    onCancel,
    currentRating = 0
}) => {
    const [hoveredRating, setHoveredRating] = useState(0);
    const [selectedRating, setSelectedRating] = useState(currentRating);

    const handleStarClick = (rating: number) => {
        setSelectedRating(rating);
    };

    const handleSubmit = () => {
        if (selectedRating > 0) {
            onSubmit(selectedRating);
        }
    };

    const getRatingText = (rating: number) => {
        if (isLike) {
            switch (rating) {
                case 1: return 'Slightly helpful';
                case 2: return 'Somewhat helpful';
                case 3: return 'Moderately helpful';
                case 4: return 'Very helpful';
                case 5: return 'Extremely helpful';
                default: return 'How helpful was this?';
            }
        } else {
            switch (rating) {
                case 1: return 'Slightly unhelpful';
                case 2: return 'Somewhat unhelpful';
                case 3: return 'Moderately unhelpful';
                case 4: return 'Very unhelpful';
                case 5: return 'Extremely unhelpful';
                default: return 'How unhelpful was this?';
            }
        }
    };

    const displayRating = hoveredRating || selectedRating;

    return (
        <div className={`feedback-rating ${isLike ? 'feedback-rating-like' : 'feedback-rating-dislike'}`}>
            <div className="feedback-rating-header">
                <h4 className="feedback-rating-title">
                    {isLike ? '👍 Rate this comment' : '👎 Rate this comment'}
                </h4>
                <button 
                    className="feedback-rating-close" 
                    onClick={onCancel}
                    title="Cancel rating"
                >
                    <X size={16} />
                </button>
            </div>
            
            <div className="feedback-rating-content">
                <p className="feedback-rating-description">
                    {getRatingText(displayRating)}
                </p>
                
                <div className="feedback-rating-stars">
                    {[1, 2, 3, 4, 5].map((rating) => {
                        const isActive = displayRating >= rating;
                        return (
                            <button
                                key={rating}
                                className={`feedback-star ${isActive ? 'feedback-star-active' : ''}`}
                                onMouseEnter={() => setHoveredRating(rating)}
                                onMouseLeave={() => setHoveredRating(0)}
                                onClick={() => handleStarClick(rating)}
                                title={`Rate ${rating} star${rating !== 1 ? 's' : ''}`}
                            >
                                <Star 
                                    size={24} 
                                    fill={isActive ? 'currentColor' : 'none'}
                                />
                            </button>
                        );
                    })}
                </div>
                
                <div className="feedback-rating-actions">
                    <button 
                        className="feedback-rating-btn feedback-rating-cancel"
                        onClick={onCancel}
                    >
                        Cancel
                    </button>
                    <button 
                        className="feedback-rating-btn feedback-rating-submit"
                        onClick={handleSubmit}
                        disabled={selectedRating === 0}
                    >
                        Submit Rating
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeedbackRating;
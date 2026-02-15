"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export default function StarRating({
    value = 0,
    onChange,
    size = 24,
    readonly = false,
    showHalfStars = true
}) {
    const [hoverValue, setHoverValue] = useState(null);

    const handleClick = (rating) => {
        if (!readonly && onChange) {
            onChange(rating);
        }
    };

    const handleMouseMove = (e, index) => {
        if (readonly) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const halfWidth = rect.width / 2;

        if (showHalfStars) {
            const rating = x < halfWidth ? index + 0.5 : index + 1;
            setHoverValue(rating);
        } else {
            setHoverValue(index + 1);
        }
    };

    const handleMouseLeave = () => {
        setHoverValue(null);
    };

    const displayValue = hoverValue !== null ? hoverValue : value;

    const renderStar = (index) => {
        const starValue = index + 1;
        const fillPercentage = Math.max(0, Math.min(1, displayValue - index));

        return (
            <div
                key={index}
                className={`relative ${readonly ? "" : "cursor-pointer"}`}
                onClick={() => {
                    if (readonly) return;
                    const next = showHalfStars
                        ? (hoverValue != null ? hoverValue : starValue)
                        : starValue;
                    handleClick(next);
                }}
                onMouseMove={(e) => handleMouseMove(e, index)}
                onMouseLeave={handleMouseLeave}
                style={{ width: size, height: size }}
            >
                {/* Background star (empty) */}
                <Star
                    size={size}
                    className="absolute top-0 left-0 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                />

                {/* Foreground star (filled) */}
                <div
                    className="absolute top-0 left-0 overflow-hidden"
                    style={{ width: `${fillPercentage * 100}%` }}
                >
                    <Star
                        size={size}
                        className="text-accent"
                        fill="currentColor"
                        stroke="currentColor"
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="flex items-center gap-1">
            {[...Array(5)].map((_, index) => renderStar(index))}
        </div>
    );
}

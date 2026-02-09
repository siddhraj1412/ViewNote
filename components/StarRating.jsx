"use client";

import { useState } from "react";
import { Star } from "lucide-react";

const RATING_LABELS = {
    0.5: "Didn't work",
    1.0: "Very Poor",
    1.5: "Poor",
    2.0: "Weak",
    2.5: "Mixed",
    3.0: "Decent",
    3.5: "Good",
    4.0: "Very Good",
    4.5: "Outstanding",
    5.0: "Exceptional",
};

export default function StarRating({
    value,
    onChange,
    readonly = false,
    size = 24,
}) {
    const [hoverValue, setHoverValue] = useState(null);

    const displayValue = hoverValue !== null ? hoverValue : value;
    const displayLabel = RATING_LABELS[displayValue] || "";

    const handleClick = (starValue) => {
        if (readonly || !onChange) return;
        onChange(starValue);
    };

    const handleMouseEnter = (starValue) => {
        if (readonly) return;
        setHoverValue(starValue);
    };

    const handleMouseLeave = () => {
        setHoverValue(null);
    };

    return (
        <div className="flex flex-col items-center gap-2">
            <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                    const fullFill = displayValue >= star;
                    const halfFill = displayValue >= star - 0.5 && displayValue < star;

                    return (
                        <div
                            key={star}
                            className="relative cursor-pointer"
                            onMouseLeave={handleMouseLeave}
                        >
                            <div
                                className="absolute inset-0 w-1/2 overflow-hidden"
                                onClick={() => handleClick(star - 0.5)}
                                onMouseEnter={() => handleMouseEnter(star - 0.5)}
                            >
                                <Star
                                    size={size}
                                    className={`transition-colors ${halfFill || fullFill
                                            ? "text-accent fill-accent"
                                            : "text-textSecondary"
                                        }`}
                                />
                            </div>

                            <div
                                className="relative"
                                onClick={() => handleClick(star)}
                                onMouseEnter={() => handleMouseEnter(star)}
                            >
                                <Star
                                    size={size}
                                    className={`transition-colors ${fullFill
                                            ? "text-accent fill-accent"
                                            : "text-textSecondary"
                                        }`}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {displayLabel && (
                <div className="text-sm text-textSecondary">
                    {displayValue.toFixed(1)} - {displayLabel}
                </div>
            )}
        </div>
    );
}

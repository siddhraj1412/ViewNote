"use client";

import { useState, useEffect } from "react";

export default function useScrollDirection() {
    const [scrollDirection, setScrollDirection] = useState("up");
    const [prevScrollY, setPrevScrollY] = useState(0);

    useEffect(() => {
        let ticking = false;

        const updateScrollDirection = () => {
            const scrollY = window.scrollY;

            if (Math.abs(scrollY - prevScrollY) < 10) {
                ticking = false;
                return;
            }

            setScrollDirection(scrollY > prevScrollY ? "down" : "up");
            setPrevScrollY(scrollY);
            ticking = false;
        };

        const onScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(updateScrollDirection);
                ticking = true;
            }
        };

        window.addEventListener("scroll", onScroll);

        return () => window.removeEventListener("scroll", onScroll);
    }, [prevScrollY]);

    return scrollDirection;
}

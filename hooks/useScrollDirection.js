"use client";

import { useState, useEffect, useRef } from "react";

export default function useScrollDirection() {
    const [scrollDirection, setScrollDirection] = useState("up");
    const prevScrollY = useRef(0);

    useEffect(() => {
        let ticking = false;

        const updateScrollDirection = () => {
            const scrollY = window.scrollY;

            if (Math.abs(scrollY - prevScrollY.current) < 10) {
                ticking = false;
                return;
            }

            setScrollDirection(scrollY > prevScrollY.current ? "down" : "up");
            prevScrollY.current = scrollY;
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
    }, []);

    return scrollDirection;
}

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps {
    children: ReactNode;
    className?: string;
    hover?: boolean;
}

export default function Card({ children, className, hover = false }: CardProps) {
    return (
        <div
            className={cn(
                "bg-secondary rounded-xl p-6",
                hover && "hover:bg-opacity-80 transition-all cursor-pointer",
                className
            )}
        >
            {children}
        </div>
    );
}

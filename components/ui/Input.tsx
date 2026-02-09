import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, ...props }, ref) => {
        return (
            <div className="w-full">
                {label && (
                    <label className="block text-sm font-medium text-textSecondary mb-2">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    className={cn(
                        "w-full px-4 py-3 bg-secondary text-textPrimary rounded-lg border-2 border-transparent",
                        "focus:border-accent focus:outline-none transition-colors",
                        "placeholder:text-textSecondary",
                        error && "border-warning",
                        className
                    )}
                    {...props}
                />
                {error && (
                    <p className="mt-2 text-sm text-warning">{error}</p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";

export default Input;

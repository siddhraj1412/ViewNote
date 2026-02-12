"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * /profile → redirects to /{username} or /profile/{uid} as fallback
 */
export default function ProfileRedirect() {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;
        if (!user) {
            router.replace("/login");
            return;
        }

        const redirect = async () => {
            // Try to get username from the user object first
            if (user.username) {
                router.replace(`/${user.username}`);
                return;
            }

            // Fallback: look up in Firestore
            try {
                const userDocSnap = await getDoc(doc(db, "user_profiles", user.uid));
                if (userDocSnap.exists()) {
                    const data = userDocSnap.data();
                    if (data.username) {
                        router.replace(`/${data.username}`);
                        return;
                    }
                }
            } catch (e) {
                console.error("Error fetching profile for redirect:", e);
            }

            // Final fallback: use UID-based route (old compat page will handle)
            router.replace(`/profile/${user.uid}`);
        };

        redirect();
    }, [user, loading, router]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-2xl text-textSecondary">Loading...</div>
        </div>
    );
}

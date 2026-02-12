"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { Suspense } from "react";

/**
 * Legacy route: /profile/[id]
 * Redirects to /{username} if the user has a username.
 * Falls back to showing the profile if no username is set.
 */
function ProfileLegacyRedirectContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const profileId = params.id;

    useEffect(() => {
        if (!profileId) return;

        const redirect = async () => {
            try {
                const userDocSnap = await getDoc(doc(db, "user_profiles", profileId));
                if (userDocSnap.exists()) {
                    const data = userDocSnap.data();
                    if (data.username) {
                        const tab = searchParams.get("tab");
                        const url = tab ? `/${data.username}?tab=${tab}` : `/${data.username}`;
                        router.replace(url);
                        return;
                    }
                }
            } catch (e) {
                console.error("Legacy profile redirect failed:", e);
            }
            // If no username found, redirect to the [username] page using the UID
            // The [username] page has fallback logic to resolve UIDs
            const tab = searchParams.get("tab");
            const url = tab ? `/${profileId}?tab=${tab}` : `/${profileId}`;
            router.replace(url);
        };

        redirect();
    }, [profileId, router, searchParams]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="text-2xl text-textSecondary">Redirecting...</div>
        </div>
    );
}

export default function ProfileLegacyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-2xl text-textSecondary">Loading...</div>
            </div>
        }>
            <ProfileLegacyRedirectContent />
        </Suspense>
    );
}
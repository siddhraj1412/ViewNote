"use client";

import MediaGrid from "@/components/MediaGrid";
import { List } from "lucide-react";

export default function ListsSection() {
    return (
        <section>
            <h2 className="text-3xl font-bold mb-6">Lists</h2>

            <div className="text-center py-12">
                <List size={64} className="mx-auto text-textSecondary mb-4 opacity-50" />
                <p className="text-textSecondary mb-2">No custom lists yet</p>
                <p className="text-sm text-textSecondary opacity-70">
                    Create custom lists to organize your favorites
                </p>
            </div>
        </section>
    );
}

import { Film, Tv, Clapperboard, Layers } from "lucide-react";

/**
 * Detect the dominant media type of a list from its items.
 * Returns: "movie" | "tv" | "episode" | "mixed"
 */
export function detectListType(items = []) {
    if (items.length === 0) return "mixed";
    const types = new Set(items.map(i => {
        const t = i.mediaType || i.type || "movie";
        if (t === "season" || t === "episode") return "episode";
        return t;
    }));
    if (types.size === 1) return [...types][0];
    return "mixed";
}

/**
 * Get the icon component and label for a list type.
 */
export function getListTypeInfo(listType) {
    switch (listType) {
        case "movie":
            return { Icon: Film, label: "Movies", color: "text-blue-400" };
        case "tv":
            return { Icon: Tv, label: "Series", color: "text-purple-400" };
        case "episode":
            return { Icon: Clapperboard, label: "Episodes", color: "text-amber-400" };
        case "mixed":
        default:
            return { Icon: Layers, label: "Mixed", color: "text-textSecondary" };
    }
}

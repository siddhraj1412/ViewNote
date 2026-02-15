"use client";

export default function TmdbRatingBadge({ value }) {
    const n = Number(value || 0);
    if (!Number.isFinite(n) || n <= 0) return null;

    const display = n.toFixed(1);
    const pct = Math.max(0, Math.min(100, (n / 10) * 100));

    return (
        <div className="bg-secondary rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between">
                <div className="text-xs font-semibold tracking-wide text-[#90cea1]">TMDB</div>
                <div className="text-xs text-textSecondary">Rating</div>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
                <div className="text-2xl font-bold text-white tabular-nums leading-none">{display}</div>
                <div className="text-xs text-textSecondary">/ 10</div>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: "linear-gradient(90deg, #90cea1 0%, #01b4e4 100%)" }}
                />
            </div>
        </div>
    );
}

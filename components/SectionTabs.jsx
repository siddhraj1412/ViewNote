"use client";

export default function SectionTabs({ tabs, activeTab, onChange, rightSlot = null }) {
    if (!Array.isArray(tabs) || tabs.length === 0) return null;

    return (
        <div className="flex items-center justify-between gap-4 mb-8">
            <div className="flex-1 min-w-0">
                <div className="flex gap-3 overflow-x-auto whitespace-nowrap scrollbar-hide pr-2">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => onChange(t.id)}
                        type="button"
                        className={`px-6 py-3 rounded-xl text-base font-semibold border transition-colors ${
                            activeTab === t.id
                                ? "bg-accent/20 text-white border-accent/40"
                                : "bg-white/5 text-textSecondary border-white/10 hover:text-white"
                        } flex-shrink-0`}
                    >
                        {t.label}
                    </button>
                ))}
                </div>
            </div>
            {rightSlot ? <div className="flex-shrink-0">{rightSlot}</div> : null}
        </div>
    );
}

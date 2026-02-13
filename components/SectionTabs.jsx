"use client";

export default function SectionTabs({ tabs, activeTab, onChange, rightSlot = null }) {
    if (!Array.isArray(tabs) || tabs.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
            <div className="flex flex-wrap gap-3">
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        onClick={() => onChange(t.id)}
                        className={`px-6 py-3 rounded-xl text-base font-semibold border transition-colors ${
                            activeTab === t.id
                                ? "bg-accent/20 text-white border-accent/40"
                                : "bg-white/5 text-textSecondary border-white/10 hover:text-white"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            {rightSlot}
        </div>
    );
}

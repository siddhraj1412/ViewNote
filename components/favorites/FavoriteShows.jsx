"use client";

import { useState } from "react";
import MediaGrid from "@/components/MediaGrid";
import MediaCard from "@/components/MediaCard";
import EmptySlot from "@/components/EmptySlot";
import SearchModal from "@/components/favorites/SearchModal";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableCard({ id, media, onRemove }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style}>
            <MediaCard
                media={media}
                onRemove={onRemove}
                isDraggable={true}
                dragHandleProps={{ ...attributes, ...listeners }}
            />
        </div>
    );
}

export default function FavoriteShows({ favorites, onAdd, onRemove, onReorder }) {
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            const oldIndex = favorites.findIndex((item) => item.id === active.id);
            const newIndex = favorites.findIndex((item) => item.id === over.id);

            const newOrder = arrayMove(favorites, oldIndex, newIndex);
            onReorder(newOrder);
        }
    };

    const handleSelect = (show) => {
        onAdd(show);
    };

    const emptySlots = Math.max(0, 5 - favorites.length);

    return (
        <section>
            <h2 className="text-2xl font-bold mb-4">Favorite Shows</h2>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={favorites.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    <MediaGrid>
                        {favorites.map((favorite) => (
                            <SortableCard
                                key={favorite.id}
                                id={favorite.id}
                                media={favorite}
                                onRemove={() => onRemove(favorite.id)}
                            />
                        ))}

                        {Array.from({ length: emptySlots }).map((_, index) => (
                            <EmptySlot
                                key={`empty-${index}`}
                                onClick={() => setIsSearchOpen(true)}
                                label="Add Show"
                            />
                        ))}
                    </MediaGrid>
                </SortableContext>
            </DndContext>

            <SearchModal
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                onSelect={handleSelect}
                type="tv"
                title="Search TV Shows"
            />
        </section>
    );
}

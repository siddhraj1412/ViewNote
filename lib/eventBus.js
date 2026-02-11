/**
 * Centralized Event Bus for cross-component communication
 * Replaces invalid store.events pattern
 */

class EventBus {
    constructor() {
        this.listeners = {};
    }

    on(event, callback) {
        if (!event || typeof callback !== "function") {
            console.warn("EventBus: Invalid event or callback");
            return;
        }

        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }

        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!event || !this.listeners[event]) return;

        this.listeners[event] = this.listeners[event].filter((cb) => cb !== callback);

        // Clean up empty arrays
        if (this.listeners[event].length === 0) {
            delete this.listeners[event];
        }
    }

    emit(event, data) {
        if (!event || !this.listeners[event]) return;

        // Create a copy to avoid issues if listeners modify the array
        const callbacks = [...this.listeners[event]];
        callbacks.forEach((callback) => {
            try {
                callback(data);
            } catch (error) {
                console.error(`EventBus: Error in listener for "${event}":`, error);
            }
        });
    }

    // Remove all listeners for an event
    removeAllListeners(event) {
        if (event) {
            delete this.listeners[event];
        } else {
            this.listeners = {};
        }
    }

    // Get listener count for debugging
    listenerCount(event) {
        return this.listeners[event] ? this.listeners[event].length : 0;
    }
}

// Create singleton instance
const eventBus = new EventBus();

export default eventBus;

import logger from '../logger.js';

export class EventEmitter {
	constructor() {
		this.events = new Map();
	}

	/**
	 * Register an event handler
	 * @param {string} event - The event name
	 * @param {Function} callback - The callback function
	 */
	on(event, callback) {
		if (!this.events.has(event))
			this.events.set(event, []);
		this.events.get(event).push(callback);

		return () => this.off(event, callback);
	}

	/**
	 * Remove an event handler
	 * @param {string} event - The event name
	 * @param {Function} callback - The callback function
	 */
	off(event, callback) {
		if (!this.events.has(event)) return;

		const callbacks = this.events.get(event);
		const index = callbacks.indexOf(callback);

		if (index !== -1) {
			callbacks.splice(index, 1);
			if (callbacks.length === 0) {
				this.events.delete(event);
			}
		}
	}

	/**
	 * Emit an event
	 * @param {string} event - The event name
	 * @param {Object} data - The event data
	 */
	emit(event, data) {
		if (!this.events.has(event)) return;

		try {
			const callbacks = this.events.get(event);
			callbacks.forEach(callback => {
				try {
					callback(data);
				} catch (error) {
					logger.error(`Error in event handler for ${event}:`, error);
				}
			});
		} catch (error) {
			logger.error(`Error emitting event ${event}:`, error);
		}
	}

	/**
	 * Remove all event handlers
	 */
	clear() {
		this.events.clear();
	}

	/**
	 * Remove all handlers for a specific event
	 * @param {string} event - The event name
	 */
	clearEvent(event) {
		this.events.delete(event);
	}

	/**
	 * Get all registered events
	 * @returns {Array<string>} - Array of event names
	 */
	getEvents() {
		return Array.from(this.events.keys());
	}

	/**
	 * Check if an event has handlers
	 * @param {string} event - The event name
	 * @returns {boolean} - Whether the event has handlers
	 */
	hasHandlers(event) {
		return this.events.has(event) && this.events.get(event).length > 0;
	}
} 
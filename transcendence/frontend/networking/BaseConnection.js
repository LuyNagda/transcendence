/**
 * Connection states using a state pattern.
 * Each state defines allowed transitions and capabilities.
 */
export const ConnectionState = {
	DISCONNECTED: {
		name: 'disconnected',
		canConnect: true,
		canDisconnect: false,
		canSend: false
	},
	CONNECTING: {
		name: 'connecting',
		canConnect: false,
		canDisconnect: true,
		canSend: false
	},
	SIGNALING: {
		name: 'signaling',
		canConnect: false,
		canDisconnect: true,
		canSend: false
	},
	CONNECTED: {
		name: 'connected',
		canConnect: false,
		canDisconnect: true,
		canSend: true
	},
	ERROR: {
		name: 'error',
		canConnect: true,
		canDisconnect: true,
		canSend: false
	}
};

/**
 * Base connection class providing common functionality for network connections.
 * Implements event handling, message queueing, and state management.
 */
export class BaseConnection {
	constructor(name) {
		this._name = name;
		this._state = ConnectionState.DISCONNECTED;
		this._handlers = new Map();
		this._messageQueue = [];
	}

	get state() {
		return this._state;
	}

	set state(newState) {
		this._state = newState;
		this.emit('stateChange', newState);
	}

	/**
	 * Registers an event handler
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler function
	 */
	on(event, handler) {
		if (!this._handlers.has(event)) {
			this._handlers.set(event, new Set());
		}
		this._handlers.get(event).add(handler);
	}

	/**
	 * Removes an event handler
	 * @param {string} event - Event name
	 * @param {Function} handler - Event handler function to remove
	 */
	off(event, handler) {
		if (this._handlers.has(event)) {
			this._handlers.get(event).delete(handler);
		}
	}

	/**
	 * Emits an event to registered handlers
	 * @param {string} event - Event name
	 * @param {*} data - Event data
	 */
	emit(event, data) {
		if (this._handlers.has(event)) {
			this._handlers.get(event).forEach(handler => handler(data));
		}
	}

	/**
	 * Queues a message for later sending
	 * @param {*} data - Message data
	 */
	queueMessage(data) {
		this._messageQueue.push(data);
	}

	/**
	 * Processes queued messages if connection can send
	 */
	processQueue() {
		while (this._messageQueue.length > 0 && this._state.canSend) {
			const message = this._messageQueue.shift();
			this.send(message);
		}
	}

	// Abstract methods to be implemented by subclasses
	connect() { throw new Error('Must implement connect()'); }
	disconnect() { throw new Error('Must implement disconnect()'); }
	send(data) { throw new Error('Must implement send()'); }
}

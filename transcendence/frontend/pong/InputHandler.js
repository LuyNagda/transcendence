import logger from '../utils/logger.js';

export class InputHandler {
	constructor(isHost) {
		this._isHost = isHost;
		this._keyStates = new Map();
		this._handlers = new Map();
		this._enabled = true;

		// Define control schemes
		this._controls = {
			host: {
				up: 'w',
				down: 's'
			},
			guest: {
				up: 'ArrowUp',
				down: 'ArrowDown'
			}
		};

		// Bind methods
		this._handleKeyDown = this._handleKeyDown.bind(this);
		this._handleKeyUp = this._handleKeyUp.bind(this);
		logger.debug('InputHandler initialized with isHost:', isHost);
	}

	initialize() {
		window.addEventListener('keydown', this._handleKeyDown);
		window.addEventListener('keyup', this._handleKeyUp);
		logger.info('Input event listeners registered');
	}

	destroy() {
		window.removeEventListener('keydown', this._handleKeyDown);
		window.removeEventListener('keyup', this._handleKeyUp);
		this._handlers.clear();
		this._keyStates.clear();
		logger.info('InputHandler destroyed and event listeners removed');
	}

	enable() {
		this._enabled = true;
		logger.debug('InputHandler enabled');
	}

	disable() {
		this._enabled = false;
		// Clear all key states when disabled
		this._keyStates.clear();
		logger.debug('InputHandler disabled and key states cleared');
	}

	isEnabled() {
		return this._enabled;
	}

	onInput(type, handler) {
		if (!this._handlers.has(type)) {
			this._handlers.set(type, new Set());
		}
		this._handlers.get(type).add(handler);
		logger.debug('Input handler registered for type:', type);
	}

	offInput(type, handler) {
		if (this._handlers.has(type)) {
			this._handlers.get(type).delete(handler);
			logger.debug('Input handler removed for type:', type);
		} else {
			logger.warn('Attempted to remove handler for non-existent input type:', type);
		}
	}

	_handleKeyDown(event) {
		if (!this._enabled) {
			logger.debug('Key down event ignored - InputHandler disabled');
			return;
		}

		const key = event.key.toLowerCase();
		const controls = this._isHost ? this._controls.host : this._controls.guest;

		// Prevent default behavior for game controls
		if (Object.values(controls).includes(key)) {
			event.preventDefault();
		}

		// Update key state
		if (!this._keyStates.get(key)) {
			this._keyStates.set(key, true);
			this._notifyHandlers('keydown', { key, isHost: this._isHost });
			logger.debug('Key down event processed:', key);
		}

		// Handle paddle movement
		if (key === controls.up || key === controls.down) {
			const direction = key === controls.up ? 'up' : 'down';
			this._notifyHandlers('paddleMove', { direction, isHost: this._isHost });
			logger.debug('Paddle move event triggered:', direction);
		}
	}

	_handleKeyUp(event) {
		if (!this._enabled) {
			logger.debug('Key up event ignored - InputHandler disabled');
			return;
		}

		const key = event.key.toLowerCase();
		const controls = this._isHost ? this._controls.host : this._controls.guest;

		// Prevent default behavior for game controls
		if (Object.values(controls).includes(key)) {
			event.preventDefault();
		}

		// Update key state
		this._keyStates.set(key, false);
		this._notifyHandlers('keyup', { key, isHost: this._isHost });
		logger.debug('Key up event processed:', key);

		// Handle paddle stop
		if (key === controls.up || key === controls.down) {
			this._notifyHandlers('paddleStop', { isHost: this._isHost });
			logger.debug('Paddle stop event triggered');
		}
	}

	_notifyHandlers(type, data) {
		if (this._handlers.has(type)) {
			try {
				for (const handler of this._handlers.get(type)) {
					handler(data);
				}
				logger.debug('Handlers notified for event type:', type);
			} catch (error) {
				logger.error('Error notifying handlers:', error);
			}
		} else {
			logger.warn('No handlers registered for event type:', type);
		}
	}

	isKeyPressed(key) {
		return this._keyStates.get(key.toLowerCase()) || false;
	}

	getActiveControls() {
		return this._isHost ? this._controls.host : this._controls.guest;
	}
} 
import logger from '../../logger.js';

export class InputHandler {
	constructor(isHost, gameMode = 'multiplayer') {
		this._isHost = isHost;
		this._gameMode = gameMode; // 'local', 'multiplayer', or 'ai'
		this._keyStates = new Map();
		this._handlers = new Map();
		this._enabled = true;
		this._lastInputTime = 0;
		this._inputThrottleMs = 16; // ~60fps

		// Define control schemes
		this._controls = {
			shared: {
				up: ['w', 'W', 'ArrowUp', 'Up'],
				down: ['s', 'S', 'ArrowDown', 'Down']
			},
			local: {
				host: {
					up: ['w', 'W'],
					down: ['s', 'S']
				},
				guest: {
					up: ['ArrowUp', 'Up'],
					down: ['ArrowDown', 'Down']
				}
			}
		};

		// Bind methods
		this._handleKeyDown = this._handleKeyDown.bind(this);
		this._handleKeyUp = this._handleKeyUp.bind(this);
		logger.debug('InputHandler initialized with isHost:', isHost, 'gameMode:', gameMode);
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
		this._keyStates.clear();
		logger.debug('InputHandler disabled and key states cleared');
	}

	isEnabled() {
		return this._enabled;
	}

	onInput(type, handler) {
		if (!this._handlers.has(type))
			this._handlers.set(type, new Set());
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
		const now = Date.now();
		if (now - this._lastInputTime < this._inputThrottleMs) return;
		this._lastInputTime = now;

		if (!this._enabled) {
			logger.debug('Key down event ignored - InputHandler disabled');
			return;
		}

		const key = event.key;
		const controls = this._gameMode === 'local'
			? (this._isHost ? this._controls.local.host : this._controls.local.guest)
			: this._controls.shared;

		// Check if the key is a valid control
		const isUpKey = controls.up.includes(key);
		const isDownKey = controls.down.includes(key);

		// Prevent default behavior for game controls
		if (isUpKey || isDownKey)
			event.preventDefault();

		// Update key state
		if (!this._keyStates.get(key)) {
			this._keyStates.set(key, true);
			logger.debug('Key down event processed:', key);
		}

		// Handle paddle movement
		if (isUpKey || isDownKey) {
			const direction = isUpKey ? 'up' : 'down';
			this._notifyHandlers('paddleMove', { direction, isHost: this._isHost });
			logger.debug('Paddle move event triggered:', direction);
		}
	}

	_handleKeyUp(event) {
		if (!this._enabled) {
			logger.debug('Key up event ignored - InputHandler disabled');
			return;
		}

		const key = event.key;
		const controls = this._gameMode === 'local'
			? (this._isHost ? this._controls.local.host : this._controls.local.guest)
			: this._controls.shared;

		// Check if the key is a valid control
		const isUpKey = controls.up.includes(key);
		const isDownKey = controls.down.includes(key);

		// Prevent default behavior for game controls
		if (isUpKey || isDownKey)
			event.preventDefault();

		// Update key state
		this._keyStates.set(key, false);
		logger.debug('Key up event processed:', key);

		// Handle paddle stop
		if (isUpKey || isDownKey)
			this._notifyHandlers('paddleStop', { isHost: this._isHost });
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
		return this._gameMode === 'local'
			? (this._isHost ? this._controls.local.host : this._controls.local.guest)
			: this._controls.shared;
	}

	setGameMode(mode) {
		if (['local', 'multiplayer', 'ai'].includes(mode)) {
			this._gameMode = mode;
			logger.debug('Game mode set to:', mode);
		} else {
			logger.warn('Invalid game mode:', mode);
		}
	}
} 
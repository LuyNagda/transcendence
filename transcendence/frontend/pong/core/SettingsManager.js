import logger from '../../logger.js';
import { GameRules } from './GameRules.js';

export class SettingsManager {
	static DEFAULT_SETTINGS = {
		...GameRules.DEFAULT_SETTINGS,
		canvasWidth: 858,
		canvasHeight: 525
	};

	constructor(initialSettings = {}) {
		this._listeners = new Set();
		this._settings = {
			...SettingsManager.DEFAULT_SETTINGS,
			...initialSettings
		};
		logger.debug('SettingsManager initialized with settings:', this._settings);
	}

	// Get canvas dimensions
	getCanvasWidth() {
		return this._settings.canvasWidth;
	}

	getCanvasHeight() {
		return this._settings.canvasHeight;
	}

	// Calculate paddle height based on current settings
	getPaddleHeight() {
		return 20 + (this._settings.paddleSize * 4);
	}

	// Calculate paddle speed based on current settings
	getPaddleSpeed() {
		const scaleFactor = 0.4 + (this._settings.paddleSpeed / 5);
		return GameRules.BASE_PADDLE_SPEED * scaleFactor;
	}

	// Calculate ball speed based on current settings
	getBallSpeed() {
		return GameRules.BASE_BALL_SPEED * (this._settings.ballSpeed / 5);
	}

	// Get initial ball velocity based on current settings
	getInitialBallVelocity() {
		const ballSpeed = this.getBallSpeed();
		const angle = (Math.random() * 2 - 1) * Math.PI / 4; // Random angle between -45 and 45 degrees
		return {
			dx: ballSpeed * (Math.random() > 0.5 ? 1 : -1) * Math.cos(angle),
			dy: ballSpeed * Math.sin(angle)
		};
	}

	// Get initial ball position
	getInitialBallPosition() {
		return {
			x: this.getCanvasWidth() / 2,
			y: this.getCanvasHeight() / 2
		};
	}

	// Get initial paddle positions
	getInitialPaddlePositions() {
		const paddleHeight = this.getPaddleHeight();
		const centerY = this.getCanvasHeight() / 2 - paddleHeight / 2;

		return {
			left: {
				x: 50,
				y: centerY
			},
			right: {
				x: this.getCanvasWidth() - 60,
				y: centerY
			}
		};
	}

	// Add a listener for settings changes
	addListener(callback) {
		this._listeners.add(callback);
		logger.debug('Added settings listener');
	}

	// Remove a listener
	removeListener(callback) {
		this._listeners.delete(callback);
		logger.debug('Removed settings listener');
	}

	// Update settings and notify listeners
	updateSettings(newSettings) {
		const oldSettings = { ...this._settings };
		this._settings = {
			...this._settings,
			...newSettings
		};

		logger.debug('Settings updated:', {
			old: oldSettings,
			new: this._settings,
			changed: Object.keys(newSettings)
		});

		this._notifyListeners(this._settings, oldSettings);
	}

	// Get current settings
	getSettings() {
		return { ...this._settings };
	}

	// Private method to notify listeners
	_notifyListeners(newSettings, oldSettings) {
		this._listeners.forEach(listener => {
			try {
				listener(newSettings, oldSettings);
			} catch (error) {
				logger.error('Error in settings listener:', error);
			}
		});
	}
} 
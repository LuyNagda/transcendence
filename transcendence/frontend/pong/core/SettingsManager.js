import logger from '../../logger.js';
import { GameRules } from './GameRules.js';

export class SettingsManager {
	constructor(initialSettings = {}) {
		const { settings } = GameRules.validateSettings(initialSettings);
		this._settings = {
			...GameRules.DEFAULT_SETTINGS,
			...settings
		};
		logger.debug('SettingsManager initialized with settings:', this._settings);
	}

	getCanvasWidth() {
		return GameRules.CANVAS_WIDTH;
	}

	getCanvasHeight() {
		return GameRules.CANVAS_HEIGHT;
	}

	getPaddleWidth() {
		return GameRules.BASE_PADDLE_WIDTH;
	}

	getPaddleHeight() {
		return GameRules.calculatePaddleHeight(this._settings.paddleSize);
	}

	getPaddleSpeed() {
		return GameRules.calculatePaddleSpeed(this._settings.paddleSpeed);
	}

	getBallSpeed() {
		return GameRules.calculateBallSpeed(this._settings.ballSpeed);
	}

	getBallRadius() {
		return GameRules.BALL_WIDTH / 2;
	}

	getInitialBallVelocity() {
		const ballSpeed = this.getBallSpeed();
		const angle = (Math.random() * 2 - 1) * Math.PI / 4; // Random angle between -45 and 45 degrees
		return {
			dx: ballSpeed * (Math.random() > 0.5 ? 1 : -1) * Math.cos(angle),
			dy: ballSpeed * Math.sin(angle)
		};
	}

	getInitialBallPosition() {
		return {
			x: GameRules.CANVAS_WIDTH / 2,
			y: GameRules.CANVAS_HEIGHT / 2
		};
	}

	getInitialPaddlePositions() {
		const paddleHeight = this.getPaddleHeight();
		const centerY = GameRules.CANVAS_HEIGHT / 2 - paddleHeight / 2;

		return {
			left: {
				x: 50,
				y: centerY
			},
			right: {
				x: GameRules.CANVAS_WIDTH - 60,
				y: centerY
			}
		};
	}

	getRelaunchTime() {
		return GameRules.RELAUNCH_TIME;
	}

	updateSettings(newSettings) {
		const oldSettings = { ...this._settings };
		const { isValid, settings } = GameRules.validateSettings(newSettings);

		if (!isValid) {
			logger.warn('Some settings were invalid and reset to defaults:', {
				original: newSettings,
				validated: settings
			});
		}

		this._settings = {
			...this._settings,
			...settings
		};

		// logger.debug('Settings updated:', {
		// 	old: oldSettings,
		// 	new: this._settings,
		// 	changed: Object.keys(newSettings)
		// });
	}

	getSettings() {
		return { ...this._settings };
	}
} 
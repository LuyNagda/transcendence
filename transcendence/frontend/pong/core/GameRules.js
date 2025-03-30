export class GameRules {
	// Game physical properties
	static CANVAS_WIDTH = 858;
	static CANVAS_HEIGHT = 525;
	static BALL_WIDTH = 10;
	static BALL_HEIGHT = 10;
	static BASE_PADDLE_WIDTH = 10;
	static BASE_PADDLE_HEIGHT = 30;
	static RELAUNCH_TIME = 2000;

	// Modifiable settings
	static BASE_PADDLE_SPEED = 50;
	static BASE_BALL_SPEED = 70;

	static DIFFICULTY_LEVELS = {
		Marvin: 'Marvin'
	};

	static SETTINGS_SCHEMA = {
		maxScore: {
			type: 'number',
			min: 1,
			max: 20,
			default: 5
		},
		ballSpeed: {
			type: 'number',
			min: 1,
			max: 10,
			default: 5
		},
		paddleSpeed: {
			type: 'number',
			min: 1,
			max: 10,
			default: 5
		},
		paddleSize: {
			type: 'number',
			min: 1,
			max: 10,
			default: 5
		},
		aiDifficulty: {
			type: 'string',
			default: 'Marvin',
			optional: true
		}
	};

	static DEFAULT_SETTINGS = Object.entries(GameRules.SETTINGS_SCHEMA).reduce((acc, [key, schema]) => {
		acc[key] = schema.default;
		return acc;
	}, {});

	static DEFAULT_AI_SETTINGS = {
		...GameRules.DEFAULT_SETTINGS,
		ballSpeed: 4,
		paddleSpeed: 6
	};

	/**
	 * Calculate actual paddle height based on paddleSize setting
	 * The formula is: BASE_HEIGHT + (paddleSize * 4)
	 * This means each unit of paddleSize adds 4 pixels to the base height:
	 * - paddleSize 1: 30 + 4 = 34 pixels
	 * - paddleSize 5: 30 + 20 = 50 pixels
	 * - paddleSize 10: 30 + 40 = 70 pixels
	 * 
	 * @param {number} paddleSize - Paddle size setting (1-10)
	 * @returns {number} - Actual paddle height in pixels
	 */
	static calculatePaddleHeight(paddleSize = GameRules.DEFAULT_SETTINGS.paddleSize) {
		return GameRules.BASE_PADDLE_HEIGHT + (paddleSize * 4);
	}

	/**
	 * Calculate actual paddle speed based on paddleSpeed setting
	 * @param {number} paddleSpeed - Paddle speed setting (1-10)
	 * @returns {number} - Actual paddle speed in pixels per second
	 */
	static calculatePaddleSpeed(paddleSpeed = GameRules.DEFAULT_SETTINGS.paddleSpeed) {
		return GameRules.BASE_PADDLE_SPEED * paddleSpeed;
	}

	/**
	 * Calculate actual ball speed based on ballSpeed setting
	 * @param {number} ballSpeed - Ball speed setting (1-10)
	 * @returns {number} - Actual ball speed in pixels per second
	 */
	static calculateBallSpeed(ballSpeed = GameRules.DEFAULT_SETTINGS.ballSpeed) {
		return GameRules.BASE_BALL_SPEED * ballSpeed;
	}

	static validateSetting(key, value) {
		const schema = GameRules.SETTINGS_SCHEMA[key];
		if (!schema) return false;

		if (value === undefined && !schema.optional) return false;
		if (value === undefined && schema.optional) return true;

		switch (schema.type) {
			case 'string':
				if (typeof value !== 'string') return false;
				if (schema.enum) return schema.enum.includes(value);
				return true;
			case 'number':
				const num = Number(value);
				if (isNaN(num)) return false;
				if (schema.min !== undefined && num < schema.min) return false;
				if (schema.max !== undefined && num > schema.max) return false;
				return true;
			default:
				return false;
		}
	}

	static convertSettingValue(key, value) {
		const schema = GameRules.SETTINGS_SCHEMA[key];
		if (!schema) return value;
		switch (schema.type) {
			case 'number':
				return Number(value);
			default:
				return value;
		}
	}

	static validateSettings(settings) {
		const validatedSettings = { ...settings };
		let isValid = true;

		for (const [key, value] of Object.entries(settings)) {
			if (!GameRules.validateSetting(key, value)) {
				isValid = false;
				validatedSettings[key] = GameRules.SETTINGS_SCHEMA[key]?.default;
			} else {
				validatedSettings[key] = GameRules.convertSettingValue(key, value);
			}
		}

		return {
			isValid,
			settings: validatedSettings
		};
	}
} 
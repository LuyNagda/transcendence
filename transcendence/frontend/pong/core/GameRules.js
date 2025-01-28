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
	static BASE_PADDLE_SPEED = 10;
	static BASE_BALL_SPEED = 25;

	static DIFFICULTY_LEVELS = {
		EASY: 'Easy',
		MEDIUM: 'Medium',
		HARD: 'Hard'
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
			enum: ['Easy', 'Medium', 'Hard'],
			default: 'Easy',
			optional: true
		}
	};

	static DEFAULT_SETTINGS = Object.entries(GameRules.SETTINGS_SCHEMA).reduce((acc, [key, schema]) => {
		acc[key] = schema.default;
		return acc;
	}, {});

	static DEFAULT_AI_SETTINGS = {
		...GameRules.DEFAULT_SETTINGS,
		aiDifficulty: 'Easy',
		ballSpeed: 4,
		paddleSpeed: 6
	};

	static DEFAULT_RANKED_SETTINGS = {
		...GameRules.DEFAULT_SETTINGS,
		maxScore: 11,
		ballSpeed: 6,
		paddleSize: 4
	};

	static AI_SPEED_MULTIPLIERS = {
		Easy: 0.7,
		Medium: 1.0,
		Hard: 1.3
	};

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

	static getAISpeedMultiplier(difficulty) {
		return GameRules.AI_SPEED_MULTIPLIERS[difficulty] || GameRules.AI_SPEED_MULTIPLIERS.MEDIUM;
	}
} 
export class GameRules {
	// Game physical properties
	static CANVAS_WIDTH = 858;
	static CANVAS_HEIGHT = 525;
	static BALL_WIDTH = 10;
	static BALL_HEIGHT = 10;
	static BASE_PADDLE_WIDTH = 10;
	static BASE_PADDLE_HEIGHT = 30;

	// Modifiable settings
	static BASE_PADDLE_SPEED = 10;
	static BASE_BALL_SPEED = 25;

	static DIFFICULTY_LEVELS = {
		EASY: 'EASY',
		MEDIUM: 'MEDIUM',
		HARD: 'HARD'
	};

	static DEFAULT_SETTINGS = {
		ballSpeed: 5,
		paddleSpeed: 5,
		paddleSize: 5,
		maxScore: 5,
		aiDifficulty: 'EASY',
		relaunchTime: 2000
	};

	static DEFAULT_AI_SETTINGS = {
		...GameRules.DEFAULT_SETTINGS,
		aiDifficulty: 'EASY',
		ballSpeed: 4,
		paddleSpeed: 6
	};

	static DEFAULT_RANKED_SETTINGS = {
		...GameRules.DEFAULT_SETTINGS,
		maxScore: 11,
		ballSpeed: 6,
		paddleSize: 4,
		relaunchTime: 1000
	};

	static AI_SPEED_MULTIPLIERS = {
		EASY: 0.7,
		MEDIUM: 1.0,
		HARD: 1.3
	};

	static validateSettings(settings) {
		const validatedSettings = { ...settings };

		// Clamp values to reasonable ranges
		validatedSettings.ballSpeed = Math.max(1, Math.min(10, settings.ballSpeed));
		validatedSettings.paddleSpeed = Math.max(1, Math.min(10, settings.paddleSpeed));
		validatedSettings.paddleSize = Math.max(1, Math.min(100, settings.paddleSize));
		validatedSettings.maxScore = Math.max(1, Math.min(21, settings.maxScore));

		// Validate AI difficulty
		if (settings.aiDifficulty && !Object.values(GameRules.DIFFICULTY_LEVELS).includes(settings.aiDifficulty)) {
			validatedSettings.aiDifficulty = GameRules.DEFAULT_SETTINGS.aiDifficulty;
		}

		return validatedSettings;
	}

	static getAISpeedMultiplier(difficulty) {
		return GameRules.AI_SPEED_MULTIPLIERS[difficulty] || GameRules.AI_SPEED_MULTIPLIERS.MEDIUM;
	}
} 
import logger from '../logger.js';
import GameDirector from './GameDirector.js';

/**
 * Create a Pong game instance
 * @param {Object} options - Configuration options
 * @param {string} options.gameId - The ID of the game
 * @param {boolean} options.isHost - Whether this client is the host
 * @param {boolean} options.useWebGL - Whether to use WebGL for rendering
 * @param {Object} options.settings - Game settings
 * @param {HTMLCanvasElement} canvas - The canvas element for rendering
 * @returns {Promise<GameDirector>} - The game director instance
 */
export async function createPongGame(options, canvas) {
	logger.info('[createPongGame] Creating Pong game with options:', options);

	if (!options.settings) {
		logger.warn('[createPongGame] No settings provided, using defaults');
		options.settings = {};
	} else
		logger.info('[createPongGame] Game settings:', options.settings);

	const gameDirector = new GameDirector(options);

	const initialized = await gameDirector.initializeGame(canvas);
	if (!initialized) {
		logger.error('[createPongGame] Failed to initialize game');
		return null;
	}

	const gameStarted = await gameDirector.startGame();
	if (!gameStarted)
		return null;

	return gameDirector;
}

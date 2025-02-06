import logger from '../logger.js';
import { RoomModes } from '../state/roomState.js';
import { GameRules } from '../pong/core/GameRules.js';

/**
 * Manages game-specific logic for a room
 */
export class RoomGameManager {
	constructor(roomId, currentUser, networkManager) {
		this._roomId = roomId;
		this._currentUser = currentUser;
		this._networkManager = networkManager;
		this._gameInProgress = false;
		this._gameInstance = null;
		this._useWebGL = false;
		this._eventHandlers = new Map();

		this._initializeNetworkHandlers();
	}

	_initializeNetworkHandlers() {
		if (!this._networkManager) return;

		this._networkManager.on('message', (data) => {
			if (data.type === 'game_started') {
				this._handleGameStarted(data);
			} else if (data.type === 'game_ended') {
				this._handleGameEnded(data);
			}
		});
	}

	async _handleGameStarted(data) {
		try {
			const { game_id, player1_id, player2_id, settings } = data;
			const isHost = this._currentUser.id === player1_id;

			await this._initializeGame(game_id, isHost, settings);
			this._emit('game_started', data);
		} catch (error) {
			logger.error('Error handling game start:', error);
			this.handleGameFailure(error);
		}
	}

	_handleGameEnded(data) {
		try {
			this._destroyGame();
			this._emit('game_ended', data);
		} catch (error) {
			logger.error('Error handling game end:', error);
		}
	}

	async _initializeGame(gameId, isHost, settings) {
		try {
			// Ensure game container is ready
			const container = document.querySelector('#game-container .screen');
			if (!container) {
				throw new Error('Game container not found');
			}

			// Clear any existing game messages
			const existingMessage = container.querySelector('.game-message');
			if (existingMessage) {
				existingMessage.remove();
			}

			// Ensure canvas exists and is properly sized
			const canvas = container.querySelector('#game');
			if (!canvas) {
				throw new Error('Game canvas not found');
			}

			// Set canvas dimensions
			canvas.width = GameRules.CANVAS_WIDTH;
			canvas.height = GameRules.CANVAS_HEIGHT;

			// Initialize game instance
			const gameMode = settings.mode || RoomModes.CLASSIC;
			const GameClass = await this._loadGameClass(gameMode);

			this._gameInstance = new GameClass(
				canvas,
				this._networkManager,
				{
					gameId,
					isHost,
					settings: this._validateGameSettings(settings),
					useWebGL: this._useWebGL
				}
			);

			// Start the game
			await this._gameInstance.start();
			this._gameInProgress = true;

			logger.info('Game initialized successfully:', {
				gameId,
				isHost,
				mode: gameMode
			});
		} catch (error) {
			logger.error('Failed to initialize game:', error);
			throw error;
		}
	}

	async _loadGameClass(mode) {
		try {
			switch (mode) {
				case RoomModes.AI:
					const { AIGame } = await import('../pong/AIGame.js');
					return AIGame;
				case RoomModes.RANKED:
					const { RankedGame } = await import('../pong/RankedGame.js');
					return RankedGame;
				case RoomModes.TOURNAMENT:
					const { TournamentGame } = await import('../pong/TournamentGame.js');
					return TournamentGame;
				case RoomModes.CLASSIC:
				default:
					const { ClassicGame } = await import('../pong/ClassicGame.js');
					return ClassicGame;
			}
		} catch (error) {
			logger.error('Failed to load game class:', error);
			throw new Error(`Failed to load game mode: ${mode}`);
		}
	}

	_validateGameSettings(settings) {
		const { settings: validatedSettings } = GameRules.validateSettings(settings);
		return validatedSettings;
	}

	// Public API
	isGameInProgress() {
		return this._gameInProgress;
	}

	setGameInProgress(value) {
		this._gameInProgress = value;
	}

	setWebGL(value) {
		this._useWebGL = value;
	}

	handleGameFailure(error) {
		logger.error('Game failure:', error);
		this._gameInProgress = false;
		this._destroyGame();
		this._emit('game_failure', error);
	}

	_destroyGame() {
		if (this._gameInstance) {
			this._gameInstance.destroy();
			this._gameInstance = null;
		}
		this._gameInProgress = false;
	}

	// Event handling
	on(event, handler) {
		if (!this._eventHandlers.has(event)) {
			this._eventHandlers.set(event, new Set());
		}
		this._eventHandlers.get(event).add(handler);
		return () => this.off(event, handler);
	}

	off(event, handler) {
		const handlers = this._eventHandlers.get(event);
		if (handlers) {
			handlers.delete(handler);
		}
	}

	_emit(event, data) {
		const handlers = this._eventHandlers.get(event);
		if (handlers) {
			handlers.forEach(handler => {
				try {
					handler(data);
				} catch (error) {
					logger.error(`Error in ${event} handler:`, error);
				}
			});
		}
	}

	updateNetworkManager(networkManager) {
		if (this._networkManager) {
			this._networkManager.off('game_started', this._handleGameStarted);
			this._networkManager.off('game_ended', this._handleGameEnded);
		}
		this._networkManager = networkManager;
		this._initializeNetworkHandlers();
	}

	destroy() {
		this._destroyGame();
		if (this._networkManager) {
			this._networkManager.off('game_started', this._handleGameStarted);
			this._networkManager.off('game_ended', this._handleGameEnded);
		}
		this._eventHandlers.clear();
	}
}

// Factory function to create RoomGameManager instance
export const createRoomGameManager = (roomId, currentUser, networkManager) => {
	return new RoomGameManager(roomId, currentUser, networkManager);
}; 
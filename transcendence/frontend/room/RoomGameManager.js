import logger from '../logger.js';
import { GameRules } from '../pong/core/GameRules.js';
import { store, actions } from '../state/store.js';
import { createPongGameController } from '../pong/PongGameController.js';

/**
 * Manages game-specific logic for a room
 */
export class RoomGameManager {
	constructor(roomId, networkManager) {
		this._roomId = roomId;
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
			if (data.type === 'game_started')
				this._handleGameStarted(data);
			else if (data.type === 'game_ended')
				this._handleGameEnded(data);
		});
	}

	async _handleGameStarted(data) {
		try {
			const { game_id, player1_id, player2_id, settings } = data;

			store.dispatch({
				domain: 'room',
				type: actions.room.UPDATE_ROOM,
				payload: {
					currentGameId: game_id
				}
			});

			await this._initializeGame(game_id);
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
			logger.info('Game ended successfully, room state reset to LOBBY');
		} catch (error) {
			logger.error('Error handling game end:', error);
		}
	}

	async _initializeGame(gameId) {
		try {
			const container = document.querySelector('#game-container .screen');
			if (!container)
				throw new Error('Game container not found');
			const canvas = container.querySelector('#game');
			if (!canvas)
				throw new Error('Game canvas not found');

			canvas.width = GameRules.CANVAS_WIDTH;
			canvas.height = GameRules.CANVAS_HEIGHT;

			// Create context handlers for WebGL
			const contextHandlers = {
				onContextLost: () => {
					logger.warn('WebGL context lost');
					store.dispatch({
						domain: 'room',
						type: actions.room.TOGGLE_WEBGL,
						payload: { useWebGL: false }
					})
					this._recreateGame();
				},
				onContextRestored: () => {
					logger.info('WebGL context restored');
					store.dispatch({
						domain: 'room',
						type: actions.room.TOGGLE_WEBGL,
						payload: { useWebGL: true }
					})
				}
			};

			const roomState = store.getState('room');
			const userState = store.getState('user');

			// Determine if current user is host
			const isHost = roomState.mode === 'AI' || (roomState.owner && roomState.owner.id === userState.id);
			logger.info('Game host status:', {
				isAIMode: roomState.mode === 'AI',
				userId: userState.id,
				ownerId: roomState.owner?.id,
				isHost: isHost
			});

			// Create game controller
			this._gameInstance = createPongGameController({
				gameId: gameId || roomState.currentGameId,
				currentUser: userState,
				isHost: isHost,
				useWebGL: false,
				settings: roomState.settings,
				contextHandlers: contextHandlers
			});

			const initialized = await this._gameInstance.initialize();
			if (!initialized)
				throw new Error('Failed to initialize game controller');

			const started = await this._gameInstance.start();
			if (!started)
				throw new Error('Failed to start game');

			this._gameInProgress = true;

			logger.info('Game initialized successfully:', {
				gameId: gameId || roomState.currentGameId,
				isHost: isHost,
				mode: roomState.mode,
				settings: roomState.settings
			});
		} catch (error) {
			logger.error('Failed to initialize game:', error);
			throw error;
		}
	}

	async _recreateGame() {
		try {
			// Destroy existing game instance
			if (this._gameInstance) {
				this._gameInstance.destroy();
				this._gameInstance = null;
			}
			await this._initializeGame();
		} catch (error) {
			logger.error('Failed to recreate game:', error);
			this.handleGameFailure(error);
		}
	}

	_validateGameSettings(settings) {
		const validatedSettings = GameRules.validateSettings(settings);
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
			logger.info('Starting game cleanup...');

			// Stop all intervals first
			if (this._gameInstance._syncInterval) {
				logger.info('Clearing sync interval...');
				clearInterval(this._gameInstance._syncInterval);
				this._gameInstance._syncInterval = null;
			}
			if (this._gameInstance._ballLaunchInterval) {
				logger.info('Clearing ball launch interval...');
				clearInterval(this._gameInstance._ballLaunchInterval);
				this._gameInstance._ballLaunchInterval = null;
			}

			// Stop the game engine and wait for it to fully stop
			if (this._gameInstance._gameEngine) {
				logger.info('Stopping game engine...');
				this._gameInstance._gameEngine.stop();

				// Unregister all components in reverse order
				logger.info('Unregistering game components...');
				this._gameInstance._gameEngine.unregisterComponent('aiHandler');
				this._gameInstance._gameEngine.unregisterComponent('input');
				// this._gameInstance._gameEngine.unregisterComponent('network');
				this._gameInstance._gameEngine.unregisterComponent('renderer');
				this._gameInstance._gameEngine.unregisterComponent('state');
				this._gameInstance._gameEngine.unregisterComponent('controller');

				// Clear the update loop
				this._gameInstance._gameEngine._components.clear();
				this._gameInstance._gameEngine = null;
			}

			// Clear AI controller
			if (this._gameInstance._aiController) {
				logger.info('Clearing AI controller...');
				this._gameInstance._aiController = null;
			}

			// Clear physics and input handlers
			if (this._gameInstance._physics) {
				logger.info('Clearing physics...');
				this._gameInstance._physics._observers.clear();
				this._gameInstance._physics = null;
			}

			if (this._gameInstance._inputHandler) {
				logger.info('Clearing input handler...');
				this._gameInstance._inputHandler.disable();
				this._gameInstance._inputHandler = null;
			}

			// Destroy the game instance
			logger.info('Destroying game instance...');
			this._gameInstance.destroy();
			this._gameInstance = null;
		}
		this._gameInProgress = false;

		store.dispatch({
			domain: 'game',
			type: actions.game.UPDATE_STATUS,
			payload: 'finished'
		});

		store.dispatch({
			domain: 'game',
			type: actions.game.RESET_GAME
		});

		logger.info('Game cleanup completed successfully');
	}

	// Event handling
	on(event, handler) {
		if (!this._eventHandlers.has(event))
			this._eventHandlers.set(event, new Set());
		this._eventHandlers.get(event).add(handler);
		return () => this.off(event, handler);
	}

	off(event, handler) {
		const handlers = this._eventHandlers.get(event);
		if (handlers)
			handlers.delete(handler);
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
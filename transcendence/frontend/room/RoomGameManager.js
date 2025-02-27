import logger from '../logger.js';
import { GameRules } from '../pong/core/GameRules.js';
import { store, actions } from '../state/store.js';
import { createPongGame } from '../pong/createPongGame.js';

/**
 * Manages game-specific logic for a room
 */
export class RoomGameManager {
	constructor(roomId, networkManager) {
		this._roomId = roomId;
		this._networkManager = networkManager;
		this._gameInProgress = false;
		this._gameInstance = null;
		this._eventHandlers = new Map();
	}

	isGameInProgress() {
		return this._gameInProgress;
	}

	async handleGameStarted(data) {
		try {
			const { player1_id, player2_id, game_id, settings } = data;

			const user_id = store.getState('user').id;

			if (user_id !== player1_id && user_id !== player2_id) {
				return;
			}

			const isHost = player1_id == user_id;

			store.dispatch({
				domain: 'room',
				type: actions.room.UPDATE_ROOM,
				payload: {
					settings: settings
				}
			});

			await this._initializeGame(game_id, isHost);
			this._emit('game_started', data);
		} catch (error) {
			logger.error('[RoomGameManager] Error handling game start:', error);
			this.handleGameFailure(error);
		}
	}

	handleGameEnded(data) {
		try {
			this.cleanup();
			this._emit('game_ended', data);
			logger.info('[RoomGameManager] Game ended successfully');
		} catch (error) {
			logger.error('[RoomGameManager] Error handling game end:', error);
			this.handleGameFailure(error);
		}
	}

	async prepareGame(roomState) {
		try {
			const container = document.querySelector('#game-container .screen');
			if (!container)
				throw new Error('Game container not found');
			const canvas = container.querySelector('#game');
			if (!canvas)
				throw new Error('Game canvas not found');

			canvas.width = GameRules.CANVAS_WIDTH;
			canvas.height = GameRules.CANVAS_HEIGHT;

			logger.info('[RoomGameManager] Game canvas prepared for initialization');
			return true;
		} catch (error) {
			logger.error('[RoomGameManager] Failed to prepare game:', error);
			return false;
		}
	}

	async _initializeGame(gameId, isHost) {
		try {
			const container = document.querySelector('#game-container .screen');
			if (!container)
				throw new Error('Game container not found');
			const canvas = container.querySelector('#game');
			if (!canvas)
				throw new Error('Game canvas not found');

			const roomState = store.getState('room');
			const gameOptions = {
				gameId: gameId,
				isHost: roomState.mode === 'AI' || (roomState.owner && roomState.owner.id === store.getState('user').id),
				useWebGL: roomState.useWebGL,
				settings: roomState.settings
			};

			this._gameInstance = await createPongGame(gameOptions, canvas);

			if (!this._gameInstance)
				throw new Error('Failed to create game instance');

			this._gameInstance.eventEmitter.on('gameError', (error) => {
				logger.error('[RoomGameManager] Game error received:', error);
				this.handleGameFailure(error);
			});

			this._gameInProgress = true;

			logger.info('[RoomGameManager] Game initialized successfully, gameOptions:', gameOptions);
		} catch (error) {
			logger.error('[RoomGameManager] Failed to initialize game:', error);
			throw error;
		}
	}

	async _recreateGame() {
		try {
			this.cleanup();
			const roomState = store.getState('room');
			if (roomState.currentGameId)
				await this._initializeGame(roomState.currentGameId);
		} catch (error) {
			logger.error('[RoomGameManager] Failed to recreate game:', error);
			this.handleGameFailure(error);
		}
	}

	handleGameFailure(error) {
		this._gameInProgress = false;
		store.dispatch({
			domain: 'room',
			type: actions.room.SET_ERROR,
			payload: error
		});
		this.cleanup();
	}

	cleanup() {
		if (this._gameInstance) {
			logger.info('[RoomGameManager] Destroying game instance...');
			this._gameInstance.destroy();
			this._gameInstance = null;
		}
		this._gameInProgress = false;

		store.dispatch([{
			domain: 'game',
			type: actions.game.SET_STATUS,
			payload: 'finished'
		}, {
			domain: 'game',
			type: actions.game.RESET,
			payload: null
		}]);

		logger.info('[RoomGameManager] Game cleanup completed successfully');
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
					logger.error(`[RoomGameManager] Error in ${event} handler:`, error);
				}
			});
		}
	}

	updateNetworkManager(networkManager) {
		this._networkManager = networkManager;
	}

	destroy() {
		this.cleanup();
		this._eventHandlers.clear();
		this._networkManager = null;
	}
}

// Factory function to create RoomGameManager instance
export const createRoomGameManager = (roomId, networkManager) => {
	return new RoomGameManager(roomId, networkManager);
}; 
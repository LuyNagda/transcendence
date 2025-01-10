import { createPongGameController } from '../pong/PongGameController.js';
import { UIService } from '../UI/UIService.js';
import Store from '../state/store.js';
import logger from '../logger.js';

export class RoomGameManager {
	constructor(roomId, currentUser, networkManager) {
		this._roomId = roomId;
		this._currentUser = currentUser;
		this._store = Store.getInstance();
		this._networkManager = networkManager;
		this._pongGame = null;
		this._useWebGL = false;
		this._startGameInProgress = false;
		this._isResetting = false;
	}

	async initializeAndStartGame(gameId, isHost, settings) {
		const canvas = document.querySelector('#game-container .screen #game');
		if (!canvas) {
			UIService.showAlert('error', 'Game canvas not found');
			throw new Error("Game canvas not found");
		}

		try {
			// Create context handlers
			const contextHandlers = this._createContextHandlers();

			// Create new game instance
			this._pongGame = createPongGameController(
				gameId,
				this._currentUser,
				isHost,
				this._useWebGL,
				settings,
				contextHandlers
			);

			const initialized = await this._pongGame.initialize();
			if (!initialized) {
				UIService.showAlert('error', 'Failed to initialize game');
				throw new Error("Game initialization failed");
			}

			// Start the game
			const started = await this._pongGame.start();
			if (!started) {
				UIService.showAlert('error', 'Failed to start game');
				throw new Error("Game start failed");
			}

			this._startGameInProgress = false;
			return true;
		} catch (error) {
			logger.error("Failed to initialize game:", error);
			UIService.showAlert('error', `Failed to start game: ${error.message}`);
			throw error;
		}
	}

	async handleGameComplete(scores) {
		if (this._isResetting) {
			logger.warn('Room reset already in progress, skipping');
			return;
		}

		this._isResetting = true;
		this._startGameInProgress = false;

		try {
			// Stop game engine first if it exists
			if (this._pongGame) {
				await this._pongGame.stop();
			}

			// Reset network state
			try {
				await this._networkManager.resetRoomState();
			} catch (error) {
				logger.error('Failed to reset room state:', error);
			}

			// Update store
			this._store.dispatch({
				domain: 'room',
				type: 'UPDATE_ROOM_STATUS',
				payload: {
					roomId: this._roomId,
					status: 'finished'
				}
			});

			// Clean up game instance last
			if (this._pongGame) {
				this._pongGame.destroy();
				this._pongGame = null;
			}
		} finally {
			this._isResetting = false;
		}
	}

	handleGameFailure() {
		if (this._pongGame) {
			this._pongGame.destroy();
			this._pongGame = null;
		}

		this._startGameInProgress = false;
		UIService.showAlert('error', 'Game failed to start. Returning to lobby...');

		// Update store
		this._store.dispatch({
			domain: 'room',
			type: 'UPDATE_ROOM_STATUS',
			payload: {
				roomId: this._roomId,
				status: 'finished'
			}
		});
	}

	_createContextHandlers() {
		return {
			onContextLost: (event) => {
				event.preventDefault();
				logger.warn('WebGL context lost');
				UIService.showAlert('error', 'Game graphics context lost. Attempting to restore...');
				setTimeout(() => this._pongGame?.restoreContext(), 1000);
			},
			onContextRestored: () => {
				logger.info('WebGL context restored');
				UIService.showAlert('success', 'Game graphics restored successfully');
				this._pongGame?.reinitialize();
			},
			onGameComplete: (scores) => {
				this.handleGameComplete(scores);
			}
		};
	}

	setWebGL(useWebGL) {
		this._useWebGL = useWebGL;
	}

	isGameInProgress() {
		return this._startGameInProgress;
	}

	setGameInProgress(inProgress) {
		this._startGameInProgress = inProgress;
	}

	destroy() {
		if (this._pongGame) {
			this._pongGame.destroy();
			this._pongGame = null;
		}
	}
} 
import { store, actions } from '../state/store.js';
import { EventEmitter } from '../networking/EventEmitter.js';
import { PongPhysics } from './core/PongState.js';
import { InputSystem, KeyboardInput, KeyboardInputGuest, NetworkInput, AIInput } from './core/InputSystem.js';
import { RenderSystem } from './renderers/RenderSystem.js';
import { PongNetworkManager } from './PongNetworkManager.js';
import { GameRules } from './core/GameRules.js';
import { RoomErrorCodes } from '../room/RoomConnectionManager.js';
import logger from '../logger.js';

export default class GameDirector {
	/**
	 * Creates a new GameDirector instance
	 * @param {Object} options - Configuration options
	 * @param {string} options.gameId - The ID of the game
	 * @param {boolean} options.isHost - Whether this client is the host
	 * @param {boolean} options.useWebGL - Whether to use WebGL for rendering
	 * @param {Object} options.settings - Game settings
	 */
	constructor(options) {
		this.gameId = options.gameId;
		this.isHost = options.isHost || false;
		this.useWebGL = options.useWebGL !== undefined ? options.useWebGL : true;
		this.eventEmitter = new EventEmitter();
		this.components = new Map();
		this.gameFinished = false;
		this.animationFrameId = null;

		this.currentUser = store.getState('user');
		this.isLocalGame = store.getState('room')?.mode === 'AI' ||
			store.getState('room')?.mode === 'LOCAL';
		this.isAiGame = store.getState('room')?.mode === 'AI';

		const { isValid, settings: validatedSettings } = GameRules.validateSettings(options.settings || {});
		if (!isValid) {
			logger.warn('[GameDirector] Invalid game settings detected, using validated settings:', {
				original: options.settings,
				validated: validatedSettings
			});
		}
		this.settings = validatedSettings;

		logger.info('[GameDirector] Game director initialized with user:', {
			username: this.currentUser.username,
			isHost: this.isHost,
			isLocalGame: this.isLocalGame,
			isAiGame: this.isAiGame,
			settings: this.settings
		});

		store.subscribe('game', this._handleGameStateChange.bind(this));
	}

	/**
	 * Initializes the game with the specified mode and canvas
	 * @param {HTMLCanvasElement} canvas - The canvas element for rendering
	 * @returns {Promise<boolean>} - Whether initialization was successful
	 */
	async initializeGame(canvas) {
		try {
			if (this.isAiGame) {
				logger.info('[GameDirector] Initializing game with mode:', this.isLocalGame ? 'AI' : (this.isHost ? 'host' : 'guest'));
			} else {
				logger.info('[GameDirector] Initializing game with mode:', this.isLocalGame ? 'LOCAL' : (this.isHost ? 'host' : 'guest'));
			}
			if (canvas.width !== GameRules.CANVAS_WIDTH || canvas.height !== GameRules.CANVAS_HEIGHT) {
				canvas.width = GameRules.CANVAS_WIDTH;
				canvas.height = GameRules.CANVAS_HEIGHT;
			}

			this._registerComponent('networkSystem', new PongNetworkManager(
				this.eventEmitter,
				this.gameId,
				this.currentUser,
				this.isHost,
				this.isLocalGame,
				this.isAiGame
			));

			const networkSystem = this.components.get('networkSystem');
			networkSystem.connect();

			const pongPhysics = new PongPhysics(this.eventEmitter, this.settings);
			pongPhysics.isHost = this.isHost; // Set host flag for state synchronization
			this._registerComponent('state', pongPhysics);
			this._registerComponent('inputSystem', new InputSystem(this.eventEmitter));
			this._registerComponent('renderSystem', new RenderSystem(
				this.eventEmitter,
				canvas,
				this.useWebGL,
				this.isHost,
				this.isLocalGame
				// this.isAigame
			));

			this._setupEventHandlers();
			this._setupInputHandlers();

			store.dispatch([{
				domain: 'game',
				type: actions.game.SET_SETTINGS,
				payload: this.settings
			}, {
				domain: 'game',
				type: actions.game.SET_STATUS,
				payload: 'waiting'
			}]);

			return true;
		} catch (error) {
			logger.error('[GameDirector] Failed to initialize game:', error);
			return false;
		}
	}

	/**
	 * Sets up input handlers based on game mode
	 * @private
	 */
	_setupInputHandlers() {
		const inputSystem = this.components.get('inputSystem');
		if (!inputSystem) {
			logger.error('[GameDirector] Input system not found, cannot setup input handlers');
			return;
		}

		if (this.isLocalGame) {
			logger.info('[GameDirector] Setting up local game');
			inputSystem.registerInput('left', new KeyboardInput());

			if (this.isAiGame) {
				// In AI mode, player controls left paddle, AI controls right paddle
				logger.info('[GameDirector] Setting up AI game: keyboard for left paddle, AI for right paddle');
				inputSystem.registerInput('right', new AIInput(this.eventEmitter, this.settings?.aiDifficulty || 'Marvin'));
			} else {
				// In LOCAL VS mode, player controls left paddle, guest player controls right paddle
				logger.info('[GameDirector] Setting up Local VS game: keyboard key "w" and "s" for left paddle, "arrow-up" and "arrow-down" for right paddle');
				inputSystem.registerInput('right', new KeyboardInputGuest());
			}
		} else {
			// In multiplayer mode
			const networkSystem = this.components.get('networkSystem');
			if (this.isHost) {
				// Host controls left paddle
				logger.info('[GameDirector] Setting up multiplayer game (host): keyboard for left paddle, network for right paddle');
				inputSystem.registerInput('left', new KeyboardInput());
				if (networkSystem)
					inputSystem.registerInput('right', new NetworkInput(networkSystem));
			} else {
				// Guest controls right paddle
				logger.info('[GameDirector] Setting up multiplayer game (guest): keyboard for right paddle, network for left paddle');
				inputSystem.registerInput('right', new KeyboardInput());
				if (networkSystem)
					inputSystem.registerInput('left', new NetworkInput(networkSystem));
			}
		}
	}

	/**
	 * Starts the game
	 * @returns {Promise<boolean>} - Whether the game started successfully
	 */
	async startGame() {
		try {
			logger.info('[GameDirector] Starting game');

			const networkSystem = this.components.get('networkSystem');

			const startGame = async () => {
				logger.info('[GameDirector] Network connection ready, starting game');
				this._setupGameLoop();

				store.dispatch({
					domain: 'game',
					type: actions.game.SET_STATUS,
					payload: 'playing'
				});

				if (this.isHost) {
					setTimeout(() => {
						this._launchBall();
					}, 1000);
				}

				return true;
			};

			if (this.isLocalGame) {
				return startGame();
			} else if (networkSystem) {
				return networkSystem.waitUntilConnected().then(connected => {
					if (connected) {
						return startGame();
					}
					return false;
				});
			}
			return false;
		} catch (error) {
			logger.error('[GameDirector] Failed to start game:', error);

			this.eventEmitter.emit('gameError', {
				code: RoomErrorCodes.GAME_START_ERROR,
				message: 'Failed to start game',
				details: error.message,
				timestamp: Date.now()
			});

			return false;
		}
	}

	/**
	 * Sets up the game loop
	 * @private
	 */
	_setupGameLoop() {
		const state = this.components.get('state');
		if (!state) {
			logger.error('[GameDirector] Cannot set up game loop: state component not found');
			return;
		}

		logger.info('[GameDirector] Setting up game loop with state:', {
			isHost: this.isHost,
			isLocalGame: this.isLocalGame,
			isAiGame: this.isAiGame,
			gameStatus: state.physicsState?.gameStatus || 'unknown'
		});

		let lastTime = performance.now();
		const gameLoop = (currentTime) => {
			// Calculate delta time in seconds
			const deltaTime = (currentTime - lastTime) / 1000;
			lastTime = currentTime;

			if (Math.random() < 0.01) { // Log approximately 1% of frames
				logger.debug('[GameDirector] Game loop iteration:', {
					deltaTime: deltaTime.toFixed(3),
					gameStatus: state.physicsState?.gameStatus || 'unknown',
					isFinished: this.gameFinished
				});
			}

			if (state.physicsState?.gameStatus === 'playing')
				state.update(deltaTime);

			if (!this.gameFinished)
				this.animationFrameId = requestAnimationFrame(gameLoop);
			else
				logger.info('[GameDirector] Game loop stopped: game finished');
		};

		// Start game loop
		this.animationFrameId = requestAnimationFrame(gameLoop);
		logger.info('[GameDirector] Game loop started');
	}

	/**
	 * Pauses the game
	 */
	pauseGame() {
		store.dispatch({
			domain: 'game',
			type: actions.game.SET_STATUS,
			payload: 'paused'
		});

		this.eventEmitter.emit('gamePaused');

		// Stop game loop
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}
	}

	/**
	 * Resumes the game
	 */
	resumeGame() {
		store.dispatch({
			domain: 'game',
			type: actions.game.SET_STATUS,
			payload: 'playing'
		});

		this.eventEmitter.emit('gameResumed');
		this._setupGameLoop();
	}

	/**
	 * Stops and cleans up the game
	 */
	destroy() {
		logger.info('[GameDirector] Destroying game director');

		// Stop game loop
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}

		this.eventEmitter.emit('gameDestroyed');

		// Clean up components
		for (const [name, component] of this.components.entries()) {
			if (typeof component.destroy === 'function') {
				component.destroy();
			}
			this.components.delete(name);
		}

		this.eventEmitter.clear();
	}

	/**
	 * Registers a component with the game director
	 * @private
	 * @param {string} name - The name of the component
	 * @param {Object} component - The component instance
	 */
	_registerComponent(name, component) {
		this.components.set(name, component);
		if (typeof component.initialize === 'function') {
			logger.info('[GameDirector] Component : ', name)
			component.initialize();
		}
	}

	/**
	 * Sets up event handlers for game events
	 * @private
	 */
	_setupEventHandlers() {
		this.eventEmitter.on('scorePoint', ({ player }) => {
			store.dispatch({
				domain: 'game',
				type: actions.game.SCORE_GOAL,
				payload: player
			});

			// Send score update to server if we're the host (including AI games)
			if (this.isHost) {
				const networkSystem = this.components.get('networkSystem');
				const gameState = store.getState('game');
				if (networkSystem && networkSystem.checkConnection() && gameState.scores) {
					networkSystem.sendScoreUpdate(gameState.scores);
				}
			}
		});

		this.eventEmitter.on('ballReadyForLaunch', () => {
			if (this.isHost)
				setTimeout(() => {
					this._launchBall();
				}, GameRules.RELAUNCH_TIME);
		});

		this.eventEmitter.on('playerInput', ({ player, input }) => {
			if (this.isLocalGame) return;
			const networkSystem = this.components.get('networkSystem');
			if (networkSystem && networkSystem.checkConnection()
				&& ((this.isHost && player === 'left') || (!this.isHost && player === 'right')))
				networkSystem.sendPaddleInput(input.direction, input.intensity);
		});

		if (this.isHost && !this.isLocalGame) {
			this.eventEmitter.on('physicsUpdated', (physicsState) => {
				const networkSystem = this.components.get('networkSystem');
				if (networkSystem && networkSystem.checkConnection()) {
					networkSystem.sendPhysicsUpdate(physicsState);
				}
			});
		}

		this.eventEmitter.on('gameComplete', ({ scores }) => {
			if (!this.gameFinished)
				this._handleGameComplete(scores);
		});
	}

	/**
	 * Handles game state changes from the store
	 * @private
	 * @param {Object} state - The new game state
	 */
	_handleGameStateChange(state) {
		logger.info('[GameDirector] Game state changed:', {
			previousStatus: this.components.get('state')?.physicsState?.gameStatus || 'unknown',
			newStatus: state.status || 'unknown',
			scores: state.scores ? `${state.scores.left}-${state.scores.right}` : 'unknown',
			gameFinished: this.gameFinished
		});

		if (state.status === 'finished' && !this.gameFinished) {
			logger.info('[GameDirector] Game is finished. Calling handleGameComplete with scores:', state.scores);
			this.gameFinished = true;
			this._handleGameComplete(state.scores);
		}

		if (state.status === 'playing' &&
			this.components.get('state')?.physicsState?.gameStatus !== 'playing') {
			logger.info('[GameDirector] Game status changed to playing');
		}
	}

	/**
	 * Handles game completion
	 * @private
	 * @param {Object} scores - The final scores
	 */
	async _handleGameComplete(scores) {
		if (this.gameFinished && this._gameCompletionSent) {
			logger.debug('[GameDirector] Game completion already handled, ignoring duplicate call');
			return;
		}

		logger.info('[GameDirector] Handling game completion with scores:', scores);
		this.gameFinished = true;
		this._gameCompletionSent = true;

		// Stop game loop
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}

		const renderSystem = this.components.get('renderSystem');
		if (renderSystem) {
			renderSystem.stopRenderLoop();
		}

		// Send game completion to server if we're the host (including AI games)
		if (this.isHost) {
			const networkSystem = this.components.get('networkSystem');
			if (networkSystem) {
				try {
					await networkSystem.sendGameComplete(scores);
				} catch (error) {
					logger.error('Error sending game completion:', error);
				}
			}
		}

		this.eventEmitter.emit('gameComplete', { scores });

		logger.info('[GameDirector] Game completion handling finished');
	}

	/**
	 * Launches the ball (host only)
	 * @private
	 */
	_launchBall() {
		if (!this.isHost) return;
		if (this.gameFinished) return; // Don't launch the ball if the game is finished

		const state = this.components.get('state');
		if (!state) return;

		logger.info('[GameDirector] Launching ball', {
			gameStatus: state.physicsState.gameStatus,
			ballPosition: {
				x: state.physicsState.ball.x,
				y: state.physicsState.ball.y
			}
		});

		state.launchBall();
	}
} 
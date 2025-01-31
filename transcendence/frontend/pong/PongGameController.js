import logger from '../logger.js';
import jaiPasVu from '../UI/JaiPasVu.js';
import { store, actions } from '../state/store.js';

import { GameEngine } from './core/GameEngine';
import { PongPhysics } from './core/PongPhysics';
import { SettingsManager } from './core/SettingsManager.js';
import { GameRules } from './core/GameRules.js';

import { InputHandler } from './InputHandler.js';
import { WebGLRenderer } from './renderers/WebGLRenderer.js';
import { Canvas2DRenderer } from './renderers/CanvasRenderer.js';
import { AIController } from './AIController.js';
import { PongNetworkManager } from './PongNetworkManager.js';
import { LocalNetworkManager } from './LocalNetworkManager.js';

// Base game controller with common functionality
class BasePongGameController {
	constructor(gameId, currentUser, isHost, useWebGL = true, settings = {}, contextHandlers = {}) {
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = isHost;
		this._useWebGL = useWebGL;
		this._settings = {
			...settings,
			isAIMode: settings.aiDifficulty ? true : settings.isAIMode || false
		};
		this._contextHandlers = contextHandlers;
		this._initialized = false;
		this._isAIMode = this._settings.isAIMode;
		this._aiController = null;
		this._handlers = { ...contextHandlers };
		this._stateResetInProgress = false;
		this._gameStatus = 'waiting';
		this._gameCompleteInProgress = false;
		this._resetInProgress = false;

		logger.info('Initializing game controller with settings:', this._settings);

		// Initialize settings manager first with validated settings
		const validatedSettings = GameRules.validateSettings(this._settings);
		this._settingsManager = new SettingsManager(validatedSettings);

		// Initialize core components
		this._physics = new PongPhysics(validatedSettings);
		this._gameEngine = new GameEngine();
		this._inputHandler = new InputHandler(isHost);

		// Initialize AI controller if in AI mode
		if (this._isAIMode) {
			logger.info('AI mode enabled, initializing AI controller...');
			this._initializeAI(this._settings.aiDifficulty || GameRules.DIFFICULTY_LEVELS.EASY)
				.catch(error => {
					logger.error('Failed to initialize AI:', error);
				});
		}

		// Subscribe to physics state changes with debounced game completion
		this._physics.subscribe({
			onStateChange: async (newState, oldState) => {
				// Update global store with game state
				if (newState.gameStatus !== oldState.gameStatus) {
					logger.debug('Game status changed:', {
						from: oldState.gameStatus,
						to: newState.gameStatus
					});
					store.dispatch({
						domain: 'game',
						type: actions.game.UPDATE_STATUS,
						payload: newState.gameStatus
					});
					this._gameStatus = newState.gameStatus;
				}

				// Update scores in store
				if (newState.scores && (
					newState.scores.left !== oldState.scores.left ||
					newState.scores.right !== oldState.scores.right
				)) {
					logger.debug('Scores updated:', newState.scores);
					store.dispatch({
						domain: 'game',
						type: actions.game.UPDATE_SCORE,
						payload: {
							player1: newState.scores.left,
							player2: newState.scores.right
						}
					});

					// Check for game completion based on score
					if (this._checkGameComplete(newState.scores)) {
						logger.debug('Game complete triggered from score threshold');
						await this._handleGameComplete(newState.scores);
					}
				}

				// Handle game completion from state change
				if (newState.gameStatus === 'finished' && oldState.gameStatus !== 'finished') {
					logger.debug('Game complete triggered from state change');
					await this._handleGameComplete(newState.scores);
				}
			}
		});

		// Initialize network manager with error handling
		try {
			// Create appropriate network manager based on mode
			this._networkManager = this._isAIMode ?
				new LocalNetworkManager(gameId, currentUser, isHost) :
				new PongNetworkManager(gameId, currentUser, isHost);

			if (!this._networkManager) {
				throw new Error('Failed to create network manager');
			}
		} catch (error) {
			logger.error('Failed to initialize network manager:', error);
			this._networkManager = null;
		}

		// Add settings change listener
		this._settingsManager.addListener((newSettings, oldSettings) => {
			this._physics.updateSettings(newSettings);
			if (this._isHost && this._networkManager) {
				this._networkManager.syncSettings(newSettings);
			}
		});

		// Initialize settings with JaiPasVu
		jaiPasVu.addObservedObject('gameSettings', {
			...validatedSettings,
			handleSettingChange: (setting, value) => {
				this.updateSettings({ [setting]: value });
			}
		});

		// Add debug logging for event binding
		logger.debug('Initializing PongGame event handlers');

		// Track event bindings
		this._boundEvents = new Set();
	}

	async _initializeAI(difficulty) {
		try {
			logger.info('Starting AI initialization with difficulty:', difficulty);

			// If AI is already initialized, return
			if (this._aiController) {
				logger.info('AI controller already initialized');
				return;
			}

			// Initialize AI controller
			this._aiController = await AIController.init(difficulty);
			logger.info('AI controller instance created');

			// Register AI handler component
			logger.info('Registering AI handler component');
			const aiHandler = {
				initialize: () => {
					logger.info('AI handler initialized');
					return true;
				},
				update: () => {
					if (!this._aiController) {
						logger.error('AI controller not available during update');
						return;
					}

					if (this._physics.getState().gameStatus === 'playing') {
						const gameState = this._physics.getState();
						logger.debug('AI update - Current game state:', {
							ball: {
								x: gameState.ball.x,
								y: gameState.ball.y,
								dx: gameState.ball.dx,
								dy: gameState.ball.dy
							},
							rightPaddle: {
								y: gameState.rightPaddle.y,
								height: gameState.rightPaddle.height
							}
						});

						const aiDecision = this._aiController.decision(gameState);
						logger.debug('AI decision:', aiDecision);

						const paddleSpeed = this._physics.getPaddleSpeed();
						logger.debug('Paddle speed:', paddleSpeed);

						// In AI mode, AI always controls the right paddle
						let dy = 0;
						if (aiDecision === 0) dy = -paddleSpeed;
						else if (aiDecision === 2) dy = paddleSpeed;
						logger.debug('Calculated dy:', dy);

						// Update paddle position directly
						const currentPaddle = gameState.rightPaddle;
						const canvas = document.getElementById('game');

						// Get deltaTime for consistent movement speed
						const now = Date.now();
						const deltaTime = (now - gameState.lastUpdateTime) / 1000;

						// Calculate new position using deltaTime
						const movement = dy * deltaTime;
						const newY = Math.max(0, Math.min(
							canvas.height - currentPaddle.height,
							currentPaddle.y + movement
						));
						logger.debug('New paddle Y position:', newY, 'deltaTime:', deltaTime, 'movement:', movement);

						this._physics.updateState({
							rightPaddle: {
								...currentPaddle,
								dy: dy,
								y: newY
							}
						});
					} else {
						logger.debug('AI update skipped - game status:', this._physics.getState().gameStatus);
					}
				},
				destroy: () => {
					logger.info('AI handler destroyed');
					this._aiController = null;
				}
			};

			// Unregister existing AI handler if it exists
			this._gameEngine.unregisterComponent('aiHandler');

			// Register new AI handler
			this._gameEngine.registerComponent('aiHandler', aiHandler);

			logger.info('AI controller initialized successfully');
		} catch (error) {
			logger.error('Failed to initialize AI controller:', error);
			this._aiController = null;
			throw error;
		}
	}

	async initialize() {
		try {
			// Initialize renderer
			const canvas = document.getElementById('game');
			if (!canvas) {
				throw new Error('Game canvas not found');
			}

			// Ensure canvas is properly sized
			if (canvas.width !== GameRules.CANVAS_WIDTH || canvas.height !== GameRules.CANVAS_HEIGHT) {
				canvas.width = GameRules.CANVAS_WIDTH;
				canvas.height = GameRules.CANVAS_HEIGHT;
			}

			// Initialize renderer without view reversal
			const renderer = this._useWebGL
				? new WebGLRenderer(canvas, this._contextHandlers)
				: new Canvas2DRenderer(canvas);

			if (!renderer.initialize()) {
				throw new Error('Failed to initialize renderer');
			}

			// Check if network manager exists
			if (!this._networkManager) {
				throw new Error('Network manager not initialized');
			}

			// Initialize network manager
			const networkConnected = await this._networkManager.connect();
			if (!networkConnected) {
				throw new Error('Failed to initialize network connection');
			}

			// Wait for AI initialization if in AI mode
			if (this._isAIMode && !this._aiController) {
				await this._initializeAI(this._settings.aiDifficulty || GameRules.DIFFICULTY_LEVELS.EASY);
			}

			// Register components with game engine
			this._gameEngine.registerComponent('state', this._physics); // TODO: Voir si fonctionne, sinon merge avec store
			this._gameEngine.registerComponent('renderer', renderer);
			this._gameEngine.registerComponent('network', this._networkManager);
			this._gameEngine.registerComponent('input', this._inputHandler);
			this._gameEngine.registerComponent('controller', this);

			// Set up network handlers
			await this._setupNetworkHandlers();

			// Set up input handlers
			this._setupInputHandlers();

			// Subscribe renderer to state changes
			this._physics.subscribe(renderer);

			// Add network game completion handler
			if (this._networkManager) {
				this._networkManager.on('gameComplete', (scores) => {
					logger.debug('Game complete triggered from network event');
					this._handleGameComplete(scores);
				});
			}

			this._initialized = true;
			return true;
		} catch (error) {
			logger.error('Failed to initialize game controller:', error);
			return false;
		}
	}

	destroy() {
		if (this._gameEngine) {
			this._gameEngine.stop();
		}
		if (this._networkManager) {
			this._networkManager.destroy();
		}
		this._initialized = false;
		this._gameEngine = null;
		this._networkManager = null;

		logger.debug('Destroying PongGame instance');
		// Clean up observers
		if (this._physics) {
			// Clear all observers
			this._physics._observers.clear();
		}
	}

	updateSettings(settings) {
		const validatedSettings = GameRules.validateSettings(settings);
		this._settingsManager.updateSettings(validatedSettings);
		this._physics.updateSettings(validatedSettings);
	}

	async setAIMode(enabled, difficulty = GameRules.DIFFICULTY_LEVELS.EASY) {
		logger.warn('setAIMode is deprecated. AI mode should be set through settings during initialization.');
		return true;
	}

	pause() {
		this._physics.updateState({ gameStatus: 'paused' });
		this._inputHandler.disable();
	}

	resume() {
		this._physics.updateState({ gameStatus: 'playing' });
		this._inputHandler.enable();
	}

	async _setupNetworkHandlers() {
		// Common network handlers for both host and guest
		this._networkManager.onGameMessage('paddleMove', (data) => {
			if (data.isHost !== this._isHost) {
				const paddle = data.isHost ? 'leftPaddle' : 'rightPaddle';
				const direction = data.direction === 'up' ? -1 : 1;
				const paddleSpeed = this._physics.getPaddleSpeed();

				this._physics.updateState({
					[paddle]: {
						...this._physics.getState()[paddle],
						dy: direction * paddleSpeed
					}
				});
			}
		});

		this._networkManager.onGameMessage('paddleStop', (data) => {
			if (data.isHost !== this._isHost) {
				const paddle = data.isHost ? 'leftPaddle' : 'rightPaddle';
				this._physics.updateState({
					[paddle]: {
						...this._physics.getState()[paddle],
						dy: 0
					}
				});
			}
		});
	}

	launchBall() {
		// Only host should launch the ball
		if (!this._isHost) return;

		const currentState = this._physics.getState();
		const ball = currentState.ball;

		// Only launch if ball is stationary and not resetting
		if (ball.dx === 0 && ball.dy === 0 && !ball.resetting) {
			const initialVelocity = this._physics.getInitialBallVelocity();
			this._physics.updateState({
				ball: {
					...ball,
					dx: initialVelocity.dx,
					dy: initialVelocity.dy
				}
			});
		}
	}

	_setupInputHandlers() {
		this._inputHandler.onInput('paddleMove', ({ direction }) => {
			const currentState = this._physics.getState();
			const baseDirection = direction === 'up' ? -1 : 1;
			const paddleSpeed = this._physics.getPaddleSpeed();
			const paddle = this._isHost ? 'leftPaddle' : 'rightPaddle';

			this._physics.updateState({
				[paddle]: {
					...currentState[paddle],
					dy: baseDirection * paddleSpeed
				}
			});

			this._networkManager.sendGameMessage({
				type: 'paddleMove',
				direction: direction,
				isHost: this._isHost
			});
		});

		this._inputHandler.onInput('paddleStop', () => {
			const paddle = this._isHost ? 'leftPaddle' : 'rightPaddle';
			this._physics.updateState({
				[paddle]: {
					...this._physics.getState()[paddle],
					dy: 0
				}
			});
			this._networkManager.sendGameMessage({
				type: 'paddleStop',
				isHost: this._isHost
			});
		});
	}

	async _handleGameComplete(scores) {
		if (this._gameStatus === 'finished' || this._gameCompleteInProgress) {
			logger.debug('Game already finished or completion in progress, ignoring duplicate call');
			return;
		}

		logger.info('Handling game complete with scores:', scores);
		this._gameCompleteInProgress = true;
		this._gameStatus = 'finished';

		try {
			// Stop the game engine
			this._gameEngine.stop();

			// Reset network state only if not already in progress
			if (!this._resetInProgress) {
				this._resetInProgress = true;
				try {
					await this._networkManager.resetRoomState();
				} catch (error) {
					logger.error('Failed to reset room state:', error);
				} finally {
					this._resetInProgress = false;
				}
			}

			// Update store with final scores
			store.dispatch({
				domain: 'game',
				type: actions.game.UPDATE_SCORES,
				payload: {
					scores: scores
				}
			});

			logger.info('Game complete handler finished successfully');
		} catch (error) {
			logger.error('Error in game complete handler:', error);
		} finally {
			this._gameCompleteInProgress = false;
		}
	}

	_startStateSync() {
		// Don't start sync in AI mode
		if (this._isAIMode) {
			return;
		}

		let lastLogTime = 0;
		const LOG_INTERVAL = 5000; // Log every 5 seconds instead of every sync

		this._syncInterval = setInterval(() => {
			if (this._physics.getState().gameStatus === 'playing') {
				const currentState = this._physics.getState();

				// Only log state periodically
				const now = Date.now();
				if (now - lastLogTime >= LOG_INTERVAL) {
					logger.debug('Game state sync - scores:', {
						left: currentState.scores.left,
						right: currentState.scores.right
					});
					lastLogTime = now;
				}

				this._networkManager.sendGameState(currentState);
			}
		}, 100); // Sync every 100ms
	}

	_handleAIPaddleMove(data) {
		if (this._isAIMode) {
			const paddle = this._isHost ? 'leftPaddle' : 'rightPaddle';
			this._physics.updateState({
				[paddle]: {
					...this._physics.getState()[paddle],
					dy: data.dy,
					y: data.y
				}
			});
		}
	}

	stop() {
		return new Promise((resolve) => {
			if (this._gameEngine) {
				this._gameEngine.stop();
			}
			// Give a small delay for any pending operations to complete
			setTimeout(resolve, 100);
		});
	}

	_bindEvents() {
		logger.debug('Binding game events');
		// No need to bind score events here as they're handled in the main state change subscription
	}

	_checkGameComplete(scores) {
		const isComplete = scores.left >= this._settingsManager.getSettings().maxScore || scores.right >= this._settingsManager.getSettings().maxScore;
		if (isComplete) {
			logger.debug('Game complete check - scores:', {
				left: scores.left,
				right: scores.right,
				maxScore: this._settingsManager.getSettings().maxScore,
				caller: new Error().stack
			});
		}
		return isComplete;
	}
}

// Host-specific game controller
class HostPongGameController extends BasePongGameController {
	constructor(gameId, currentUser, useWebGL = true, settings = {}, contextHandlers = {}) {
		super(gameId, currentUser, true, useWebGL, settings, contextHandlers);
		this._syncInterval = null;
		logger.info('Host controller initialized with settings:', this._settings);
	}

	async start() {
		try {
			logger.info('Starting host game...');
			if (!this._initialized) {
				logger.error('Game not initialized before start');
				return false;
			}

			// Ensure AI is initialized in AI mode
			if (this._isAIMode) {
				logger.info('Game is in AI mode');
				if (!this._aiController) {
					logger.info('Initializing AI controller...');
					await this._initializeAI(this._settings.aiDifficulty || GameRules.DIFFICULTY_LEVELS.EASY);
				}
				if (!this._aiController) {
					logger.error('AI controller not initialized in AI mode');
					return false;
				}
				logger.info('AI controller ready');
			}

			logger.info('Starting game engine');
			this._gameEngine.start();

			logger.info('Setting game status to playing');
			this._physics.updateState({ gameStatus: 'playing' });

			if (!this._isAIMode) {
				logger.info('Starting state sync');
				this._startStateSync();
			} else {
				logger.info('Skipping state sync in AI mode');
			}

			// Launch ball after a short delay
			setTimeout(() => {
				if (this._physics.getState().gameStatus === 'playing') {
					this.launchBall();
				}
			}, 1000);

			return true;
		} catch (error) {
			logger.error('Failed to start host game:', error);
			return false;
		}
	}

	_startStateSync() {
		this._syncInterval = setInterval(() => {
			if (this._physics.getState().gameStatus === 'playing') {
				const currentState = this._physics.getState();
				logger.debug('Host sending state:', currentState);
				this._networkManager.sendGameState(currentState);
			}
		}, 100); // Sync every 100ms
	}

	destroy() {
		if (this._syncInterval) {
			clearInterval(this._syncInterval);
		}
		super.destroy();
	}
}

// Guest-specific game controller
class GuestPongGameController extends BasePongGameController {
	constructor(gameId, currentUser, useWebGL = true, settings = {}, contextHandlers = {}) {
		super(gameId, currentUser, false, useWebGL, settings, contextHandlers);
	}

	async start() {
		if (!this._initialized) {
			throw new Error('Game controller not initialized');
		}

		try {
			// Wait for host connection using the new method name
			if (!this._gameFinished) {
				await this._networkManager.waitForHostConnection();
			}

			// Start the game engine and enable input for paddle only
			this._gameEngine.start();
			this._inputHandler.enable();
			this._setupStateSync();

			// Set game state to playing
			this._physics.updateState({ gameStatus: 'playing' });

			return true;
		} catch (error) {
			logger.error('Failed to start game:', error);
			this.destroy();
			return false;
		}
	}

	_setupStateSync() {
		this._networkManager.onGameMessage('gameState', (message) => {
			if (this._physics.getState().gameStatus === 'finished' || this._gameFinished) return;

			const canvas = this._gameEngine.getComponent('renderer').getCanvas();

			// Transform game state for guest view
			const newState = {
				...message.state,
				leftPaddle: message.state.rightPaddle,
				rightPaddle: message.state.leftPaddle,
				ball: {
					...message.state.ball,
					x: canvas.width - message.state.ball.x - message.state.ball.width,
					dx: -message.state.ball.dx
				}
			};

			this._physics.updateState(newState);
		});

		// Add handler for game_complete message
		this._networkManager.onGameMessage('game_complete', async (message) => {
			if (!this._gameFinished) {
				logger.info('Received game completion from host');
				await this._handleGameComplete(message.scores);
			}
		});
	}

	destroy() {
		this._gameFinished = true;
		if (this._networkManager) {
			this._networkManager.destroy();
			this._networkManager = null;
		}
		super.destroy();
	}
}

// Factory function to create the appropriate controller
export function createPongGameController(gameId, currentUser, isHost, useWebGL = true, settings = {}, contextHandlers = {}) {
	return isHost ?
		new HostPongGameController(gameId, currentUser, useWebGL, settings, contextHandlers) :
		new GuestPongGameController(gameId, currentUser, useWebGL, settings, contextHandlers);
} 
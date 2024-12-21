import { GameEngine } from './core/GameEngine';
import { GameState } from './core/GameState';
import { InputHandler } from './InputHandler.js';
import { WebGLRenderer } from './renderers/WebGLRenderer.js';
import { Canvas2DRenderer } from './renderers/CanvasRenderer.js';
import { AIController } from './AIController.js';
import logger from '../utils/logger.js';
import { SettingsManager } from './core/SettingsManager.js';
import { GameRules } from './core/GameRules.js';
import dynamicRender from '../utils/dynamic_render.js';
import { PongNetworkManager } from './PongNetworkManager.js';

// Base game controller with common functionality
class BasePongGameController {
	constructor(gameId, currentUser, isHost, useWebGL = true, settings = {}, contextHandlers = {}) {
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = isHost;
		this._useWebGL = useWebGL;
		this._settings = settings;
		this._contextHandlers = contextHandlers;
		this._initialized = false;
		this._isAIMode = false;
		this._aiController = null;

		// Initialize settings manager first with validated settings
		const validatedSettings = GameRules.validateSettings(settings);
		this._settingsManager = new SettingsManager(validatedSettings);

		// Initialize core components
		this._gameState = new GameState(validatedSettings);
		this._gameEngine = new GameEngine();
		this._inputHandler = new InputHandler(isHost);

		// Initialize network manager with error handling
		try {
			this._networkManager = new PongNetworkManager(gameId, currentUser, isHost);
			if (!this._networkManager) {
				throw new Error('Failed to create network manager');
			}
		} catch (error) {
			logger.error('Failed to initialize network manager:', error);
			this._networkManager = null;
		}

		// Initialize input handler
		this._inputHandler.initialize();

		// Add settings change listener
		this._settingsManager.addListener((newSettings, oldSettings) => {
			this._gameState.updateSettings(newSettings);
			if (this._isHost && this._networkManager) {
				this._networkManager.syncSettings(newSettings);
			}
		});

		// Initialize settings with DynamicRender
		dynamicRender.addObservedObject('gameSettings', {
			...validatedSettings,
			handleSettingChange: (setting, value) => {
				this.updateSettings({ [setting]: value });
			}
		});
	}

	async initialize() {
		try {
			// Initialize renderer
			const canvas = document.getElementById('game');
			if (!canvas) {
				throw new Error('Game canvas not found');
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

			// Register components with game engine
			this._gameEngine.registerComponent('state', this._gameState);
			this._gameEngine.registerComponent('renderer', renderer);
			this._gameEngine.registerComponent('network', this._networkManager);
			this._gameEngine.registerComponent('input', this._inputHandler);
			this._gameEngine.registerComponent('controller', this);

			// Set up network handlers
			await this._setupNetworkHandlers();

			// Set up input handlers
			this._setupInputHandlers();

			// Subscribe renderer to state changes
			this._gameState.subscribe(renderer);

			// Subscribe self to state changes for game completion
			this._gameState.subscribe({
				onStateChange: (newState, oldState) => {
					if (newState.gameStatus === 'finished' && oldState.gameStatus !== 'finished') {
						this._handleGameComplete(newState.scores);
					}
				}
			});

			this._initialized = true;
			return true;
		} catch (error) {
			logger.error('Failed to initialize game controller:', error);
			return false;
		}
	}

	destroy() {
		if (this._networkManager) {
			this._networkManager.destroy();
		}
		if (this._gameEngine) {
			this._gameEngine.destroy();
		}
		if (this._inputHandler) {
			this._inputHandler.destroy();
		}
		this._initialized = false;
	}

	updateSettings(settings) {
		const validatedSettings = GameRules.validateSettings(settings);
		this._settingsManager.updateSettings(validatedSettings);
		this._gameState.updateSettings(validatedSettings);
	}

	async setAIMode(enabled, difficulty = GameRules.DIFFICULTY_LEVELS.EASY) {
		this._isAIMode = enabled;

		try {
			if (enabled) {
				// Initialize AI controller
				this._aiController = await AIController.init(difficulty);

				// Create new network manager for AI mode
				const aiNetworkManager = new PongNetworkManager(this._gameId, this._currentUser, this._isHost);
				aiNetworkManager.setAIMode(true);

				// Clean up existing network manager and switch to AI mode
				if (this._networkManager) {
					this._networkManager.destroy();
					this._gameEngine.unregisterComponent('network');
				}

				this._networkManager = aiNetworkManager;
				this._gameEngine.registerComponent('network', this._networkManager);

				// Register AI handler component
				this._gameEngine.registerComponent('aiHandler', {
					initialize: () => {
						logger.info('AI handler initialized');
						return true;
					},
					update: () => {
						if (this._gameState.getState().gameStatus === 'playing') {
							const gameState = this._gameState.getState();
							const aiDecision = this._aiController.decision(gameState);

							const paddleSpeed = this._gameState.getPaddleSpeed();
							let dy = 0;
							if (aiDecision === 0) dy = -paddleSpeed;
							else if (aiDecision === 2) dy = paddleSpeed;

							this._handleAIPaddleMove({
								dy: dy,
								y: gameState.rightPaddle.y + dy
							});
						}
					},
					destroy: () => {
						logger.info('AI handler destroyed');
					}
				});

				// Update game state for AI mode
				this._gameState.updateState({ gameStatus: 'ready', isAIMode: true });
			} else {
				// Clean up AI components
				if (this._aiController) {
					this._gameEngine.unregisterComponent('aiHandler');
					this._aiController = null;
				}

				// Create new network manager for multiplayer mode
				const networkManager = new PongNetworkManager(this._gameId, this._currentUser, this._isHost);

				// Clean up existing network manager and switch to multiplayer
				if (this._networkManager) {
					this._networkManager.destroy();
					this._gameEngine.unregisterComponent('network');
				}

				this._networkManager = networkManager;
				const networkConnected = await this._networkManager.connect();
				if (!networkConnected) {
					throw new Error('Failed to initialize network connection');
				}

				this._gameEngine.registerComponent('network', this._networkManager);
				await this._setupNetworkHandlers();

				// Update game state for network mode
				this._gameState.updateState({ gameStatus: 'ready', isAIMode: false });
			}

			return true;
		} catch (error) {
			logger.error('Failed to switch game mode:', error);
			this._isAIMode = !enabled;
			throw error;
		}
	}

	pause() {
		this._gameState.updateState({ gameStatus: 'paused' });
		this._inputHandler.disable();
	}

	resume() {
		this._gameState.updateState({ gameStatus: 'playing' });
		this._inputHandler.enable();
	}

	async _setupNetworkHandlers() {
		// Common network handlers for both host and guest
		this._networkManager.onGameMessage('paddleMove', (data) => {
			if (data.isHost !== this._isHost) {
				const paddle = data.isHost ? 'leftPaddle' : 'rightPaddle';
				const direction = data.direction === 'up' ? -1 : 1;
				const paddleSpeed = this._gameState.getPaddleSpeed();

				this._gameState.updateState({
					[paddle]: {
						...this._gameState.getState()[paddle],
						dy: direction * paddleSpeed
					}
				});
			}
		});

		this._networkManager.onGameMessage('paddleStop', (data) => {
			if (data.isHost !== this._isHost) {
				const paddle = data.isHost ? 'leftPaddle' : 'rightPaddle';
				this._gameState.updateState({
					[paddle]: {
						...this._gameState.getState()[paddle],
						dy: 0
					}
				});
			}
		});
	}

	launchBall() {
		// Only host should launch the ball
		if (!this._isHost) return;

		const currentState = this._gameState.getState();
		const ball = currentState.ball;

		// Only launch if ball is stationary and not resetting
		if (ball.dx === 0 && ball.dy === 0 && !ball.resetting) {
			const initialVelocity = this._gameState.getInitialBallVelocity();
			this._gameState.updateState({
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
			const currentState = this._gameState.getState();
			const baseDirection = direction === 'up' ? -1 : 1;
			const paddleSpeed = this._gameState.getPaddleSpeed();
			const paddle = this._isHost ? 'leftPaddle' : 'rightPaddle';

			this._gameState.updateState({
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
			this._gameState.updateState({
				[paddle]: {
					...this._gameState.getState()[paddle],
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
		logger.info('Game completed with scores:', scores);

		// Set game finished flag first to prevent reconnection attempts
		this._gameFinished = true;

		// Stop game engine and disable input
		this._gameEngine.stop();
		this._inputHandler.disable();

		// Update game state to finished
		this._gameState.updateState({ gameStatus: 'finished' });

		// Send final scores and wait a moment for it to be delivered
		if (this._networkManager && this._networkManager.isConnected()) {
			try {
				this._networkManager.sendGameMessage({
					type: 'game_complete',
					scores: scores
				});

				// Give time for the final message to be sent
				await new Promise(resolve => setTimeout(resolve, 500));
			} catch (error) {
				logger.error('Error sending game completion messages:', error);
			}
		}

		// Clean up network manager first
		if (this._networkManager) {
			this._networkManager.destroy();
			this._networkManager = null;
		}

		// Clear sync interval if it exists
		if (this._syncInterval) {
			clearInterval(this._syncInterval);
			this._syncInterval = null;
		}

		// Notify context handlers
		if (this._contextHandlers?.onGameComplete) {
			this._contextHandlers.onGameComplete(scores);
		}
	}

	async start() {
		if (!this._initialized) {
			throw new Error('Game controller not initialized');
		}

		if (!this._networkManager) {
			throw new Error('Network manager not initialized');
		}

		try {
			// Wait for guest connection using the new method name
			const connected = await this._networkManager.waitForGuestConnection();

			if (!connected) {
				throw new Error('Failed to establish connection with guest');
			}

			// Start the game engine and enable input
			this._gameEngine.start();
			this._inputHandler.enable();
			this._startStateSync();

			// Set game state to playing
			this._gameState.updateState({ gameStatus: 'playing' });

			// Launch the ball after a short delay
			logger.info('Host will launch ball in 1 second');
			setTimeout(() => {
				if (this._networkManager.isConnected()) {
					this.launchBall();
				} else {
					logger.error('Cannot launch ball - connection lost');
					this.destroy();
				}
			}, 1000);

			return true;
		} catch (error) {
			logger.error('Failed to start game:', error);
			this.destroy();
			return false;
		}
	}

	_startStateSync() {
		this._syncInterval = setInterval(() => {
			if (this._gameState.getState().gameStatus === 'playing') {
				const currentState = this._gameState.getState();
				this._networkManager.sendGameState(currentState);
			}
		}, 100); // Sync every 100ms
	}
}

// Host-specific game controller
class HostPongGameController extends BasePongGameController {
	constructor(gameId, currentUser, useWebGL = true, settings = {}, contextHandlers = {}) {
		super(gameId, currentUser, true, useWebGL, settings, contextHandlers);
		this._syncInterval = null;
	}

	async start() {
		if (!this._initialized) {
			throw new Error('Game controller not initialized');
		}

		if (!this._networkManager) {
			throw new Error('Network manager not initialized');
		}

		try {
			// Wait for guest connection using the new method name
			const connected = await this._networkManager.waitForGuestConnection();

			if (!connected) {
				throw new Error('Failed to establish connection with guest');
			}

			// Start the game engine and enable input
			this._gameEngine.start();
			this._inputHandler.enable();
			this._startStateSync();

			// Set game state to playing
			this._gameState.updateState({ gameStatus: 'playing' });

			// Launch the ball after a short delay
			logger.info('Host will launch ball in 1 second');
			setTimeout(() => {
				if (this._networkManager.isConnected()) {
					this.launchBall();
				} else {
					logger.error('Cannot launch ball - connection lost');
					this.destroy();
				}
			}, 1000);

			return true;
		} catch (error) {
			logger.error('Failed to start game:', error);
			this.destroy();
			return false;
		}
	}

	_startStateSync() {
		this._syncInterval = setInterval(() => {
			if (this._gameState.getState().gameStatus === 'playing') {
				const currentState = this._gameState.getState();
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
			this._gameState.updateState({ gameStatus: 'playing' });

			return true;
		} catch (error) {
			logger.error('Failed to start game:', error);
			this.destroy();
			return false;
		}
	}

	_setupStateSync() {
		this._networkManager.onGameMessage('gameState', (message) => {
			if (this._gameState.getState().gameStatus === 'finished' || this._gameFinished) return;

			const canvas = this._gameEngine.getComponent('renderer').getCanvas();
			// Transform the received state for guest view
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

			this._gameState.updateState(newState);
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
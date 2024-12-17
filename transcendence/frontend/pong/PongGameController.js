import { GameEngine } from './core/GameEngine';
import { GameState } from './core/GameState';
import { WebGLRenderer } from './renderers/WebGLRenderer';
import { Canvas2DRenderer } from './renderers/CanvasRenderer';
import { NetworkManager } from './NetworkManager.js';
import { InputHandler } from './InputHandler.js';
import logger from '../utils/logger.js';
import { AIController } from './AIController.js';
import { SettingsManager } from './core/SettingsManager.js';

export class PongGameController {
	constructor(gameId, currentUser, isHost, useWebGL = true, settings = {}) {
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = isHost;
		this._useWebGL = useWebGL;
		this._settings = settings;
		this._initialized = false;

		// Initialize settings manager first
		this._settingsManager = new SettingsManager(settings);

		// Initialize core components with settings from manager
		this._gameEngine = new GameEngine();
		this._gameState = new GameState(this._settingsManager.getSettings());
		this._inputHandler = new InputHandler(isHost);
		this._networkManager = new NetworkManager(gameId, currentUser, isHost);

		// Initialize input handler
		this._inputHandler.initialize();

		this._aiController = null;
		this._isAIMode = false;

		// Initialize input handlers
		this._setupInputHandlers();

		// Add settings change listener
		this._settingsManager.addListener((newSettings, oldSettings) => {
			// Update game state with new settings
			this._gameState.updateSettings(newSettings);

			// Send settings update to other player if in multiplayer
			if (this._networkManager.isConnected()) {
				this._networkManager.sendGameMessage({
					type: 'settings_update',
					settings: newSettings
				});
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

			// Set canvas size
			canvas.width = GameRules.CANVAS_WIDTH;
			canvas.height = GameRules.CANVAS_HEIGHT;

			const renderer = this._useWebGL ? new WebGLRenderer(canvas) : new Canvas2DRenderer(canvas);
			if (!renderer.initialize()) {
				throw new Error('Failed to initialize renderer');
			}

			// Register components with game engine
			this._gameEngine.registerComponent('state', this._gameState);
			this._gameEngine.registerComponent('renderer', renderer);
			this._gameEngine.registerComponent('network', this._networkManager);
			this._gameEngine.registerComponent('input', this._inputHandler);
			this._gameEngine.registerComponent('controller', this);

			// Set up network handlers
			await this._setupNetworkHandlers();

			// Subscribe renderer to state changes
			this._gameState.subscribe(renderer);

			this._initialized = true;
			logger.info('Game controller initialized successfully');

			return true;
		} catch (error) {
			logger.error('Failed to initialize game controller:', error);
			this.destroy();
			return false;
		}
	}

	updateSettings(settings) {
		this._settingsManager.updateSettings(settings);
	}

	async setAIMode(enabled, difficulty = 'medium') {
		this._isAIMode = enabled;

		if (enabled) {
			try {
				// Initialize AI controller properly with difficulty
				this._aiController = await AIController.init(difficulty);
			} catch (error) {
				logger.error('Failed to initialize AI controller:', error);
				this.destroy();
				throw new Error('Failed to start AI game: Could not initialize AI controller');
			}

			// Re-register the AI handler component
			this._gameEngine.registerComponent('aiHandler', {
				initialize: async () => {
					logger.warn("AI handler initialize");
				},
				update: () => {
					if (!this._aiController) return;

					const currentState = this._gameState.getState();
					const aiDecision = this._aiController.decision(currentState);
					const paddleSpeed = this._gameState.getPaddleSpeed();

					// Handle AI decision like a player input
					const paddle = 'rightPaddle';

					switch (aiDecision) {
						case 0: // Move up
							this._gameState.updateState({
								[paddle]: {
									...currentState[paddle],
									dy: -1 * paddleSpeed
								}
							});
							break;
						case 2: // Move down
							this._gameState.updateState({
								[paddle]: {
									...currentState[paddle],
									dy: 1 * paddleSpeed
								}
							});
							break;
						default: // Stop
							this._gameState.updateState({
								[paddle]: {
									...currentState[paddle],
									dy: 0
								}
							});
					}
				}
			});

			// Disable network features in AI mode
			this._networkManager.destroy();
		} else {
			// Register a dummy aiHandler when AI mode is disabled
			this._gameEngine.registerComponent('aiHandler', {
				initialize: () => { },
				update: () => { }
			});
		}

		// Disable input for AI-controlled paddle
		if (!this._isHost) {
			this._inputHandler.disable();
		}
	}

	start() {
		if (!this._initialized) {
			throw new Error('Game controller not initialized');
		}

		try {
			logger.debug('Starting game engine...');
			this._gameEngine.start();

			this._inputHandler.enable();
			logger.debug('Input handler enabled');

			this._gameState.updateState({ gameStatus: 'playing' });
			logger.debug('Game state updated to playing');

			// Launch the ball when the game starts
			this.launchBall();

			logger.info('Game started successfully');
			return true;
		} catch (error) {
			logger.error('Failed to start game:', error);
			return false;
		}
	}

	launchBall() {
		if (this._isHost) {
			const currentState = this._gameState.getState();
			const ball = currentState.ball;

			if (ball.dx === 0 && ball.dy === 0 && !ball.resetting) {
				// Get initial velocity based on configured ball speed
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
		// Connect to network
		const connected = await this._networkManager.connect();
		if (!connected) {
			throw new Error('Failed to establish network connection');
		}

		// Handle paddle movements from remote player
		this._networkManager.onGameMessage('paddleMove', (data) => {
			if (data.isHost !== this._isHost) {
				const paddle = data.isHost ? 'leftPaddle' : 'rightPaddle';
				const baseDirection = data.direction === 'up' ? -1 : 1;

				logger.debug('Received remote paddle move:', {
					paddle,
					dy: baseDirection,
					from: data.isHost ? 'host' : 'guest'
				});

				this._gameState.updateState({
					[paddle]: {
						...this._gameState.getState()[paddle],
						dy: baseDirection
					}
				});
			}
		});

		// Add initial sync handler
		this._networkManager.onGameMessage('initialSync', (data) => {
			if (!this._isHost) {
				logger.info('Received initial game state from host');
				this._gameState.updateState(data.state);
			}
		});

		// Add periodic state sync for host
		if (this._isHost) {
			setInterval(() => {
				if (this._networkManager.isConnected()) {
					this._networkManager.sendGameMessage({
						type: 'stateSync',
						timestamp: Date.now(),
						state: this._gameState.getState()
					});
				}
			}, 100); // Sync every 100ms
		}

		// Handle state sync messages
		this._networkManager.onGameMessage('stateSync', (data) => {
			if (!this._isHost) {
				this._gameState.updateState(data.state);
			}
		});

		// Handle paddle stops from remote player
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

	destroy() {
		if (this._gameEngine)
			this._gameEngine.destroy();
		if (this._inputHandler)
			this._inputHandler.destroy();
		if (this._networkManager)
			this._networkManager.destroy();
		if (this._settingsManager)
			this._settingsManager = null;
		this._initialized = false;
		logger.info('Game controller destroyed');
	}

	_setupInputHandlers() {
		// Register input handlers
		this._inputHandler.onInput('paddleMove', ({ direction, isHost }) => {
			if (isHost === this._isHost) {
				const currentState = this._gameState.getState();
				const baseDirection = direction === 'up' ? -1 : 1;
				const paddle = this._isHost ? 'leftPaddle' : 'rightPaddle';
				const paddleSpeed = this._gameState.getPaddleSpeed();

				logger.debug('Updating paddle state:', {
					paddle,
					direction: baseDirection,
					speed: paddleSpeed,
					currentState: currentState[paddle],
				});

				this._gameState.updateState({
					[paddle]: {
						...currentState[paddle],
						dy: baseDirection * paddleSpeed
					}
				});

				// Log the state after update
				logger.debug('New game state:', this._gameState.getState());

				this._networkManager.sendGameMessage({
					type: 'paddleMove',
					direction: direction,
					isHost: this._isHost
				});
			}
		});

		this._inputHandler.onInput('paddleStop', ({ isHost }) => {
			if (isHost === this._isHost) {
				this._gameState.updateState({
					[this._isHost ? 'leftPaddle' : 'rightPaddle']: {
						...this._gameState.getState()[this._isHost ? 'leftPaddle' : 'rightPaddle'],
						dy: 0
					}
				});
				this._networkManager.sendGameMessage({
					type: 'paddleStop',
					isHost: this._isHost
				});
			}
		});

		// Add AI input handling
		if (this._isAIMode && this._isHost) {
			this._gameEngine.registerComponent('aiHandler', {
				initialize: async () => {
					logger.warn("AI handler initialize");
				},
				update: () => {
					if (!this._aiController) return;

					const currentState = this._gameState.getState();
					const aiDecision = this._aiController.decision(currentState);
					const paddleSpeed = this._gameState.getPaddleSpeed();

					// Handle AI decision like a player input
					const paddle = 'rightPaddle';

					switch (aiDecision) {
						case 0: // Move up
							this._gameState.updateState({
								[paddle]: {
									...currentState[paddle],
									dy: -1 * paddleSpeed
								}
							});
							break;
						case 2: // Move down
							this._gameState.updateState({
								[paddle]: {
									...currentState[paddle],
									dy: 1 * paddleSpeed
								}
							});
							break;
						default: // Stop
							this._gameState.updateState({
								[paddle]: {
									...currentState[paddle],
									dy: 0
								}
							});
					}
				}
			});
		} else {
			// Register a dummy aiHandler to avoid errors in GameEngine
			this._gameEngine.registerComponent('aiHandler', {
				initialize: () => { },
				update: () => { }
			});
		}
	}
} 
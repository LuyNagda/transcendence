import { GameEngine } from './core/GameEngine';
import { GameState } from './core/GameState';
import { WebGLRenderer } from './renderers/WebGLRenderer';
import { Canvas2DRenderer } from './renderers/CanvasRenderer';
import { NetworkManager } from './NetworkManager.js';
import { InputHandler } from './InputHandler.js';
import logger from '../utils/logger.js';
import { AIController } from './AIController.js';
import { SettingsManager } from './core/SettingsManager.js';
import dynamicRender from '../utils/dynamic_render.js';
import { GameRules } from './core/GameRules.js';

export class PongGameController {
	constructor(gameId, currentUser, isHost, useWebGL = true, settings = {}, contextHandlers = {}) {
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = isHost;
		this._useWebGL = useWebGL;
		this._settings = settings;
		this._contextHandlers = contextHandlers;
		this._initialized = false;

		// Initialize settings manager first with validated settings
		const validatedSettings = GameRules.validateSettings(settings);
		this._settingsManager = new SettingsManager(validatedSettings);

		// Initialize core components with settings from manager
		this._gameEngine = new GameEngine();
		this._gameState = new GameState(validatedSettings);
		this._inputHandler = new InputHandler(isHost);
		this._networkManager = new NetworkManager(gameId, currentUser, isHost);

		// Initialize input handler
		this._inputHandler.initialize();

		this._aiController = null;
		this._isAIMode = false;

		// Initialize input handlers
		this._setupInputHandlers();

		// Register the default AI handler
		this._registerAIHandler();

		// Add settings change listener
		this._settingsManager.addListener((newSettings, oldSettings) => {
			// Update game state with new settings
			this._gameState.updateSettings(newSettings);

			// If we're the host, sync settings with other players
			if (this._isHost && this._networkManager && this._networkManager.isConnected()) {
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

	_registerAIHandler() {
		// Register a dummy aiHandler by default
		this._gameEngine.registerComponent('aiHandler', {
			initialize: async () => {
				logger.warn("AI handler initialize");
				return true;
			},
			update: () => {
				if (!this._isAIMode || !this._aiController) return;

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
			},
			destroy: () => {
				if (this._aiController) {
					this._aiController = null;
				}
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

			// Initialize renderer without view reversal
			const renderer = this._useWebGL
				? new WebGLRenderer(canvas, this._contextHandlers)
				: new Canvas2DRenderer(canvas);

			if (!renderer.initialize()) {
				throw new Error('Failed to initialize renderer');
			}

			// Initialize network manager first
			this._networkManager = new NetworkManager(this._gameId, this._currentUser, this._isHost);
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

			// Set up network handlers only after network manager is initialized
			await this._setupNetworkHandlers();

			// Subscribe renderer to state changes
			this._gameState.subscribe(renderer);

			// Verify renderer subscription
			logger.debug('Current observers:', {
				observerCount: this._gameState._observers.size,
				hasRenderer: this._gameState._observers.has(renderer)
			});

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
		// Validate and update multiple settings at once
		const validatedSettings = GameRules.validateSettings(settings);
		this._settingsManager.updateSettings(validatedSettings);
		this._gameState.updateSettings(validatedSettings);

		// Sync with other player if we're the host
		if (this._isHost && this._networkManager && this._networkManager.isConnected()) {
			this._networkManager.syncSettings(validatedSettings);
		}
	}

	async setAIMode(enabled, difficulty = GameRules.DIFFICULTY_LEVELS.EASY) {
		this._isAIMode = enabled;

		if (enabled) {
			try {
				// Initialize AI controller properly with difficulty
				this._aiController = await AIController.init(difficulty);
				// Disable network features in AI mode
				this._networkManager.destroy();
			} catch (error) {
				logger.error('Failed to initialize AI controller:', error);
				this.destroy();
				throw new Error('Failed to start AI game: Could not initialize AI controller');
			}
		} else {
			this._aiController = null;
		}

		// Disable input for AI-controlled paddle
		if (!this._isHost) {
			this._inputHandler.disable();
		}
	}

	async start() {
		if (!this._initialized) {
			throw new Error('Game controller not initialized');
		}

		try {
			logger.info('Starting game...');
			logger.debug('Initial network status:', this._networkManager.getConnectionStatus());

			// Only attempt to establish WebRTC connection if not already connected
			if (!this._networkManager.isConnected()) {
				// Wait for WebRTC connection to be established with retries
				logger.info('Waiting for WebRTC connection...');
				let connected = false;
				let retryCount = 0;
				const maxRetries = 3;

				while (!connected && retryCount < maxRetries) {
					if (retryCount > 0) {
						logger.info(`Retry attempt ${retryCount} of ${maxRetries}`);
						// Wait before retrying
						await new Promise(resolve => setTimeout(resolve, 2000));
					}

					connected = await this._networkManager.waitForConnection(10000);
					if (!connected) {
						retryCount++;
						logger.warn(`Connection attempt ${retryCount} failed`);
					}
				}

				if (!connected) {
					logger.error('Failed to establish WebRTC connection after all retries');
					return false;
				}

				logger.info('WebRTC connection established and handshake completed');
				logger.debug('Final network status:', this._networkManager.getConnectionStatus());
			} else {
				logger.info('WebRTC connection already established');
			}

			// Set game status to playing
			this._gameState.updateState({ gameStatus: 'playing' });

			// Start the game engine and enable input
			this._gameEngine.start();
			this._inputHandler.enable();

			// Launch the ball after a short delay
			if (this._isHost) {
				logger.info('Host will launch ball in 1 second');
				setTimeout(() => {
					this.launchBall();
				}, 1000);
			}

			logger.info('Game started successfully');
			return true;
		} catch (error) {
			logger.error('Failed to start game:', error);
			this.destroy();
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
		if (!this._networkManager) {
			throw new Error('NetworkManager not initialized');
		}

		// Add initial sync handler
		this._networkManager.onGameMessage('initialSync', (data) => {
			if (!this._isHost) {
				logger.info('Received initial game state from host');
				logger.debug('Initial state:', data.state);
				this._gameState.updateState(data.state);
			}
		});

		// Add periodic state sync for host
		if (this._isHost) {
			logger.info('Setting up periodic state sync as host');
			const syncInterval = setInterval(() => {
				if (!this._networkManager) {
					logger.warn('NetworkManager no longer available, clearing sync interval');
					clearInterval(syncInterval);
					return;
				}

				if (this._networkManager.isConnected()) {
					const state = this._gameState.getState();
					logger.debug('Sending state sync:', {
						timestamp: Date.now(),
						ballPosition: { x: state.ball.x, y: state.ball.y },
						scores: state.scores
					});

					this._networkManager.sendGameMessage({
						type: 'stateSync',
						timestamp: Date.now(),
						state: state
					});
				}
			}, 100); // Sync every 100ms

			// Store interval ID for cleanup
			this._syncInterval = syncInterval;
		}

		// Handle state sync messages
		this._networkManager.onGameMessage('stateSync', (data) => {
			if (!this._isHost) {
				logger.debug('Processing state sync:', {
					before: {
						ball: data.state.ball,
						leftPaddle: data.state.leftPaddle,
						rightPaddle: data.state.rightPaddle
					}
				});

				// For the guest, we need to mirror the state
				const newState = {
					...data.state,
					leftPaddle: data.state.rightPaddle,
					rightPaddle: data.state.leftPaddle,
					ball: {
						...data.state.ball,
						x: this._gameEngine.getComponent('renderer').getCanvas().width - data.state.ball.x - data.state.ball.width,
						dx: -data.state.ball.dx
					}
				};

				logger.debug('After transformation:', {
					ball: newState.ball,
					leftPaddle: newState.leftPaddle,
					rightPaddle: newState.rightPaddle
				});

				this._gameState.updateState(newState);
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
		// Add a guard to prevent recursive destruction
		if (this._isDestroying) return;
		this._isDestroying = true;

		// Clear sync interval if it exists
		if (this._syncInterval) {
			clearInterval(this._syncInterval);
			this._syncInterval = null;
		}

		if (this._gameEngine) {
			this._gameEngine.destroy();
			this._gameEngine = null;
		}
		if (this._inputHandler) {
			this._inputHandler.destroy();
			this._inputHandler = null;
		}
		if (this._networkManager) {
			this._networkManager.destroy();
			this._networkManager = null;
		}
		if (this._settingsManager) {
			this._settingsManager = null;
		}
		this._initialized = false;
		this._isDestroying = false;
		logger.info('Game controller destroyed');
	}

	_setupInputHandlers() {
		// Register input handlers
		this._inputHandler.onInput('paddleMove', ({ direction, isHost }) => {
			if (isHost === this._isHost) {
				const currentState = this._gameState.getState();
				const baseDirection = direction === 'up' ? -1 : 1;
				// Always use leftPaddle for both players' local input
				const paddle = 'leftPaddle';
				const paddleSpeed = this._gameState.getPaddleSpeed();

				// For guest, we'll mirror the input to the right paddle in the actual game state
				const actualPaddle = this._isHost ? 'leftPaddle' : 'rightPaddle';

				this._gameState.updateState({
					[actualPaddle]: {
						...currentState[actualPaddle],
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
				// For guest, we'll mirror the stop to the right paddle in the actual game state
				const actualPaddle = this._isHost ? 'leftPaddle' : 'rightPaddle';

				this._gameState.updateState({
					[actualPaddle]: {
						...this._gameState.getState()[actualPaddle],
						dy: 0
					}
				});
				this._networkManager.sendGameMessage({
					type: 'paddleStop',
					isHost: this._isHost
				});
			}
		});
	}

	_setupSettingsListeners() {
		const form = document.getElementById('settings-form');
		if (!form) return;

		form.querySelectorAll('input[type="range"], select').forEach(input => {
			input.addEventListener('change', (e) => {
				const setting = e.target.id;
				const value = e.target.type === 'range' ? parseInt(e.target.value) : e.target.value;

				// Update the DynamicRender object
				const gameSettings = dynamicRender.observedObjects.get('gameSettings');
				if (gameSettings) {
					gameSettings[setting] = value;
				}
			});
		});
	}
} 
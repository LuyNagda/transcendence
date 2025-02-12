import logger from '../logger.js';
import { store, actions } from '../state/store.js';

import { GameEngine } from './core/GameEngine';
import { PongPhysics } from './core/PongPhysics';
import { SettingsManager } from './core/SettingsManager.js';
import { GameRules } from './core/GameRules.js';
import { InputHandler } from './core/InputHandler.js';

import { WebGLRenderer } from './renderers/WebGLRenderer.js';
import { Canvas2DRenderer } from './renderers/CanvasRenderer.js';
import { AIController } from './AIController.js';
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
		this._isAIMode = store.getState('room').mode === 'AI';
		this._aiController = null;
		this._stateResetInProgress = false;
		this._gameStatus = 'waiting';
		this._gameCompleteInProgress = false;
		this._resetInProgress = false;
		this._networkManager = null;
		this._gameFinished = false;

		logger.info('Initializing game controller with settings:', this._settings);

		// Initialize settings manager first with validated settings
		const validatedSettings = GameRules.validateSettings(this._settings);
		this._settingsManager = new SettingsManager(validatedSettings);

		// Initialize core components
		this._physics = new PongPhysics(validatedSettings);
		this._gameEngine = new GameEngine();

		const gameMode = this._isAIMode ? 'ai' : (this._gameId ? 'multiplayer' : 'local');
		logger.info('Setting game mode to:', gameMode, 'isAIMode:', this._isAIMode);
		this._inputHandler = new InputHandler(isHost, gameMode);

		// Initialize AI controller if in AI mode
		if (this._isAIMode) {
			logger.info('AI mode enabled, initializing AI controller...');
			this._initializeAI(this._settings.aiDifficulty || GameRules.DIFFICULTY_LEVELS.EASY)
				.catch(error => {
					logger.error('Failed to initialize AI:', error);
				});
		}

		// Subscribe to physics state changes
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

					// Clear ball launch interval if game is finished
					if (newState.gameStatus === 'finished' && this._ballLaunchInterval) {
						logger.info('Game finished, clearing ball launch interval');
						clearInterval(this._ballLaunchInterval);
						this._ballLaunchInterval = null;
					}
				}

				// Update scores in store
				if (newState.scores && (
					newState.scores.left !== oldState.scores.left ||
					newState.scores.right !== oldState.scores.right
				)) {
					logger.debug('Scores updated:', newState.scores);

					// Format scores consistently
					const formattedScores = {
						player1: newState.scores.left || 0,
						player2: newState.scores.right || 0
					};

					// Update store
					store.dispatch({
						domain: 'game',
						type: actions.game.UPDATE_SCORE,
						payload: formattedScores
					});

					// Send score update to server in both modes if host
					if (this._isHost) {
						if (this._networkManager) {
							await this._networkManager.sendScoreUpdate(formattedScores);
						} else {
							// In AI mode, create temporary network manager for score update
							logger.info('Creating temporary network manager to send AI mode score update');
							const tempNetworkManager = new PongNetworkManager(this._gameId, this._currentUser, true, true);
							try {
								await tempNetworkManager.connect();
								await tempNetworkManager.sendScoreUpdate(formattedScores);
							} catch (error) {
								logger.error('Failed to send AI mode score update:', error);
							} finally {
								tempNetworkManager.destroy();
							}
						}
					}

					// Check for game completion based on score
					if (!this._gameFinished && this._checkGameComplete(newState.scores)) {
						logger.debug('Game complete triggered from score threshold');
						await this._handleGameComplete(formattedScores);
					}
				}

				// Handle game completion from state change
				if (!this._gameFinished && newState.gameStatus === 'finished' && oldState.gameStatus !== 'finished') {
					logger.debug('Game complete triggered from state change');
					await this._handleGameComplete(newState.scores);
				}

				// Sync game state if host
				if (this._isHost && this._networkManager && !this._isAIMode && !this._gameFinished) {
					this._networkManager.sendGameState(newState);
				}
			}
		});
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
			const canvas = document.getElementById('game');
			if (!canvas)
				throw new Error('Game canvas not found');

			// Ensure canvas is properly sized
			if (canvas.width !== GameRules.CANVAS_WIDTH || canvas.height !== GameRules.CANVAS_HEIGHT) {
				canvas.width = GameRules.CANVAS_WIDTH;
				canvas.height = GameRules.CANVAS_HEIGHT;
			}

			// Initialize renderer without view reversal
			const renderer = this._useWebGL
				? new WebGLRenderer(canvas, this._contextHandlers)
				: new Canvas2DRenderer(canvas);

			if (!renderer.initialize())
				throw new Error('Failed to initialize renderer');

			// Wait for AI initialization if in AI mode
			if (this._isAIMode && !this._aiController)
				await this._initializeAI(this._settings.aiDifficulty || GameRules.DIFFICULTY_LEVELS.EASY);

			// Register components with game engine
			this._gameEngine.registerComponent('state', this._physics);
			this._gameEngine.registerComponent('renderer', renderer);
			this._gameEngine.registerComponent('input', this._inputHandler);
			this._gameEngine.registerComponent('controller', this);

			// Subscribe renderer to state changes
			this._physics.subscribe(renderer);

			this._initialized = true;
			logger.info('Game initialized successfully');
			return true;
		} catch (error) {
			logger.error('Failed to initialize game controller:', error);
			return false;
		}
	}

	destroy() {
		if (this._gameEngine)
			this._gameEngine.stop();
		if (this._networkManager)
			this._networkManager.destroy();
		this._initialized = false;
		this._gameEngine = null;
		this._networkManager = null;

		logger.debug('Destroying PongGame instance');
		// Clean up observers
		if (this._physics)
			this._physics._observers.clear();
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
		if (!this._networkManager) return;

		// Handle paddle movements (WebRTC)
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

		// Handle game state updates (WebSocket)
		this._networkManager.onGameMessage('game_state', (message) => {
			try {
				if (!message.state) {
					logger.error('Invalid game state received:', message);
					return;
				}

				// Only update game status and scores from WebSocket
				const updates = {};
				if (message.state.status)
					updates.gameStatus = message.state.status;
				if (message.state.scores)
					updates.scores = message.state.scores;

				// Only update if we have changes
				if (Object.keys(updates).length > 0)
					this._physics.updateState(updates);

			} catch (error) {
				logger.error('Error handling game state update:', error);
			}
		});

		// Handle real-time game state updates (WebRTC)
		this._networkManager.onGameMessage('gameState', (message) => {
			try {
				if (!message.state || this._physics.getState().gameStatus === 'finished')
					return;

				// Update ball and paddle positions from WebRTC
				const currentState = this._physics.getState();
				const updates = {};

				// Only include valid position updates
				if (message.state.ball && typeof message.state.ball.x === 'number')
					updates.ball = message.state.ball;
				if (message.state.leftPaddle && typeof message.state.leftPaddle.y === 'number')
					updates.leftPaddle = message.state.leftPaddle;
				if (message.state.rightPaddle && typeof message.state.rightPaddle.y === 'number')
					updates.rightPaddle = message.state.rightPaddle;

				// Only update if we have valid position changes
				if (Object.keys(updates).length > 0) {
					this._physics.updateState({
						...updates,
						gameStatus: currentState.gameStatus,
						scores: currentState.scores
					});
				}

			} catch (error) {
				logger.error('Error handling real-time game state update:', error);
			}
		});

		// Handle settings updates (WebSocket)
		this._networkManager.onGameMessage('settings_update', (data) => {
			if (!this._isHost) {
				this._settingsManager.updateSettings(data.settings);
			}
		});

		// Handle game completion (WebSocket)
		this._networkManager.onGameMessage('game_complete', async (message) => {
			if (!this._gameCompleteInProgress) {
				logger.info('Received game completion from peer');
				await this._handleGameComplete(message.scores);
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
			logger.info('Launching ball...');
			const initialVelocity = this._physics.getInitialBallVelocity();

			// Ensure the ball is in the center before launch
			const canvas = document.getElementById('game');
			this._physics.updateState({
				ball: {
					...ball,
					x: canvas.width / 2,
					y: canvas.height / 2,
					dx: initialVelocity.dx,
					dy: initialVelocity.dy,
					resetting: false
				},
				gameStatus: 'playing'
			});
			logger.info('Ball launched with velocity:', initialVelocity);
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

			if (this._networkManager) {
				this._networkManager.sendGameMessage({
					type: 'paddleMove',
					direction: direction,
					isHost: this._isHost
				});
			}
		});

		this._inputHandler.onInput('paddleStop', () => {
			const paddle = this._isHost ? 'leftPaddle' : 'rightPaddle';
			this._physics.updateState({
				[paddle]: {
					...this._physics.getState()[paddle],
					dy: 0
				}
			});

			if (this._networkManager) {
				this._networkManager.sendGameMessage({
					type: 'paddleStop',
					isHost: this._isHost
				});
			}
		});
	}

	async _handleGameComplete(scores) {
		if (this._gameFinished) {
			logger.debug('Game already finished, ignoring duplicate completion call');
			return;
		}

		logger.info('Handling game complete with scores:', scores);
		this._gameFinished = true;

		try {
			// Stop the game engine
			this._gameEngine.stop();

			// Clear ball launch interval if it exists
			if (this._ballLaunchInterval) {
				logger.info('Clearing ball launch interval during game completion');
				clearInterval(this._ballLaunchInterval);
				this._ballLaunchInterval = null;
			}

			// Format scores consistently
			const formattedScores = {
				player1: scores.left || scores.player1 || 0,
				player2: scores.right || scores.player2 || 0
			};

			// Send final score update first
			if (this._isHost) {
				if (this._networkManager) {
					await this._networkManager.sendScoreUpdate(formattedScores);
				} else {
					// In AI mode, create temporary network manager for score update
					logger.info('Creating temporary network manager to send AI game completion');
					const tempNetworkManager = new PongNetworkManager(this._gameId, this._currentUser, true, true);
					try {
						await tempNetworkManager.connect();
						await tempNetworkManager.sendScoreUpdate(formattedScores);
						await tempNetworkManager.sendGameComplete(formattedScores);
					} catch (error) {
						logger.error('Failed to send AI mode game completion:', error);
					} finally {
						tempNetworkManager.destroy();
					}
				}
			}

			// Send game completion notification if host (both for multiplayer and AI modes)
			if (this._isHost && this._networkManager)
				await this._networkManager.sendGameComplete(formattedScores);

			// Update store with final scores and game status
			store.dispatch({
				domain: 'game',
				type: actions.game.UPDATE_SCORE,
				payload: formattedScores
			});

			store.dispatch({
				domain: 'game',
				type: actions.game.UPDATE_STATUS,
				payload: 'finished'
			});

			// Update room state to LOBBY
			store.dispatch({
				domain: 'room',
				type: actions.room.UPDATE_ROOM,
				payload: {
					state: 'LOBBY',
					currentGameId: 0
				}
			});

			logger.info('Game complete handler finished successfully');
		} catch (error) {
			logger.error('Error in game complete handler:', error);
		}
	}

	_startStateSync() {
		if (this._isAIMode || !this._networkManager)
			return;

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
		}, 50); // Sync every 50ms
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
			if (this._gameEngine)
				this._gameEngine.stop();
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
		this._ballLaunchInterval = null;
		this._lastGuestPaddleUpdate = null;
		logger.info('Host controller initialized with settings:', this._settings);
	}

	async start() {
		try {
			// Initialize base components but skip network manager
			const initialized = await this.initialize();
			if (!initialized) {
				logger.error('Failed to initialize base components');
				return false;
			}

			this._setupInputHandlers();

			// Only initialize network manager for multiplayer games
			if (!this._isAIMode) {
				// Only initialize network manager if not already initialized
				if (!this._networkManager) {
					logger.info('Initializing network manager in host start...');
					this._networkManager = new PongNetworkManager(this._gameId, this._currentUser, true);
					const connected = await this._networkManager.connect();
					if (!connected) {
						logger.error('Failed to connect network manager');
						return false;
					}
					this._setupNetworkHandlers();
				}

				try {
					await this._networkManager.waitForGuestConnection();
				} catch (error) {
					logger.error('Failed to establish connection with guest:', error);
					return false;
				}

				// Handle guest paddle movement
				this._networkManager.onGameMessage('paddleMove', ({ direction, isHost }) => {
					if (isHost) return; // Ignore host messages

					const currentState = this._physics.getState();
					const baseDirection = direction === 'up' ? -1 : 1;
					const paddleSpeed = this._physics.getPaddleSpeed();

					this._physics.updateState({
						rightPaddle: {
							...currentState.rightPaddle,
							dy: baseDirection * paddleSpeed
						}
					});
					this._lastGuestPaddleUpdate = Date.now();
				});

				this._networkManager.onGameMessage('paddleStop', ({ isHost }) => {
					if (isHost) return; // Ignore host messages

					this._physics.updateState({
						rightPaddle: {
							...this._physics.getState().rightPaddle,
							dy: 0
						}
					});
					this._lastGuestPaddleUpdate = Date.now();
				});
			}

			this._gameEngine.start();
			if (!this._isAIMode)
				this._startStateSync();

			this._physics.updateState({ gameStatus: 'playing' });

			// Schedule initial ball launch after a short delay
			setTimeout(() => {
				if (this._physics.getState().gameStatus === 'playing') {
					this.launchBall();

					// Set up periodic ball launch check
					if (this._ballLaunchInterval)
						clearInterval(this._ballLaunchInterval);
					this._ballLaunchInterval = setInterval(() => {
						const state = this._physics.getState();
						if (state.gameStatus === 'playing' &&
							state.ball.dx === 0 &&
							state.ball.dy === 0 &&
							!state.ball.resetting) {
							this.launchBall();
						}
					}, 2000); // Check every 2 seconds
				}
			}, 1000); // Initial launch after 1 second

			logger.info('Host game controller started successfully');
			return true;
		} catch (error) {
			logger.error('Failed to start host game controller:', error);
			return false;
		}
	}

	launchBall() {
		// Only host should launch the ball
		if (!this._isHost) return;

		const currentState = this._physics.getState();
		const ball = currentState.ball;

		// Only launch if ball is stationary and not resetting
		if (ball.dx === 0 && ball.dy === 0 && !ball.resetting) {
			logger.info('Launching ball...');
			const initialVelocity = this._physics.getInitialBallVelocity();

			// Ensure the ball is in the center before launch
			const canvas = document.getElementById('game');
			this._physics.updateState({
				ball: {
					...ball,
					x: canvas.width / 2,
					y: canvas.height / 2,
					dx: initialVelocity.dx,
					dy: initialVelocity.dy,
					resetting: false
				},
				gameStatus: 'playing'
			});
			logger.info('Ball launched with velocity:', initialVelocity);
		}
	}

	_startStateSync() {
		// Send game state updates to guest
		this._gameEngine.registerComponent('stateSync', {
			update: () => {
				if (this._physics.getState().gameStatus === 'playing' && !this._gameFinished) {
					const state = this._physics.getState();
					const now = Date.now();

					// Create a complete state object, preserving guest paddle state
					const completeState = {
						...state,
						ball: { ...state.ball },
						leftPaddle: { ...state.leftPaddle },
						rightPaddle: { ...state.rightPaddle }
					};

					// Only update guest paddle if we haven't received a recent update
					if (this._lastGuestPaddleUpdate && now - this._lastGuestPaddleUpdate < 100) {
						// Keep the last known guest paddle state
						const currentRightPaddle = state.rightPaddle;
						completeState.rightPaddle = {
							...currentRightPaddle,
							dy: currentRightPaddle.dy || 0  // Ensure dy is defined
						};
					}

					this._networkManager.sendGameState(completeState);
				}
			}
		});
	}

	destroy() {
		if (this._syncInterval) {
			clearInterval(this._syncInterval);
			this._syncInterval = null;
		}
		if (this._ballLaunchInterval) {
			clearInterval(this._ballLaunchInterval);
			this._ballLaunchInterval = null;
		}
		super.destroy();
	}
}

// Guest-specific game controller
class GuestPongGameController extends BasePongGameController {
	constructor(gameId, currentUser, useWebGL = true, settings = {}, contextHandlers = {}) {
		super(gameId, currentUser, false, useWebGL, settings, contextHandlers);
		this._lastLocalPaddleUpdate = null;
	}

	async start() {
		try {
			// Initialize base components
			const initialized = await this.initialize();
			if (!initialized) {
				logger.error('Failed to initialize base components');
				return false;
			}

			this._setupInputHandlers();
			this._setupNetworkHandlers();

			// Initialize network manager
			if (!this._networkManager) {
				logger.info('Initializing network manager in guest start...');
				this._networkManager = new PongNetworkManager(this._gameId, this._currentUser, false);
				const connected = await this._networkManager.connect();
				if (!connected) {
					logger.error('Failed to connect network manager');
					return false;
				}
			}

			try {
				await this._networkManager.waitForHostConnection();
			} catch (error) {
				logger.error('Failed to establish connection with host:', error);
				return false;
			}

			// Handle real-time game state updates (WebRTC)
			this._networkManager.onGameMessage('gameState', (message) => {
				try {
					if (!message.state || this._physics.getState().gameStatus === 'finished') {
						return;
					}

					// Transform the received state to mirror the game
					const transformedState = this._transformReceivedState(message.state);
					const currentState = this._physics.getState();
					const updates = {};

					// Only include valid position updates
					if (transformedState.ball && typeof transformedState.ball.x === 'number')
						updates.ball = transformedState.ball;
					if (transformedState.leftPaddle && typeof transformedState.leftPaddle.y === 'number')
						updates.leftPaddle = transformedState.leftPaddle;
					if (transformedState.rightPaddle && typeof transformedState.rightPaddle.y === 'number')
						updates.rightPaddle = transformedState.rightPaddle;

					// Apply updates if any
					if (Object.keys(updates).length > 0)
						this._physics.updateState(updates);
				} catch (error) {
					logger.error('Error handling game state update:', error);
				}
			});

			// Start game engine
			this._gameEngine.start();
			logger.info('Guest game controller started successfully');
			return true;
		} catch (error) {
			logger.error('Failed to start guest game controller:', error);
			return false;
		}
	}

	_transformReceivedState(state) {
		const canvas = document.getElementById('game');
		if (!canvas || !state) return null;

		try {
			const transformedState = { ...state };

			// Transform ball position and velocity if they exist
			if (state.ball && typeof state.ball.x === 'number') {
				transformedState.ball = {
					...state.ball,
					x: canvas.width - state.ball.x - (state.ball.width || 10),
					dx: -state.ball.dx
				};
			}

			// Swap paddles if they exist
			if (state.leftPaddle && typeof state.leftPaddle.x === 'number') {
				transformedState.rightPaddle = {
					...state.leftPaddle,
					x: canvas.width - state.leftPaddle.x - (state.leftPaddle.width || 10)
				};
			}
			if (state.rightPaddle && typeof state.rightPaddle.x === 'number') {
				transformedState.leftPaddle = {
					...state.rightPaddle,
					x: canvas.width - state.rightPaddle.x - (state.rightPaddle.width || 10)
				};
			}

			// Transform scores if they exist
			if (state.scores) {
				transformedState.scores = {
					left: Number(state.scores.right) || 0,
					right: Number(state.scores.left) || 0
				};
			}

			return transformedState;
		} catch (error) {
			logger.error('Error transforming received state:', error);
			return null;
		}
	}

	_setupInputHandlers() {
		// Override paddle movement to track local updates
		this._inputHandler.onInput('paddleMove', ({ direction }) => {
			const currentState = this._physics.getState();
			const baseDirection = direction === 'up' ? -1 : 1;
			const paddleSpeed = this._physics.getPaddleSpeed();

			// For guest, update leftPaddle since the view is mirrored
			this._physics.updateState({
				leftPaddle: {
					...currentState.leftPaddle,
					dy: baseDirection * paddleSpeed
				}
			});
			this._lastLocalPaddleUpdate = Date.now();

			if (this._networkManager) {
				this._networkManager.sendGameMessage({
					type: 'paddleMove',
					direction: direction,
					isHost: false
				});
			}
		});

		this._inputHandler.onInput('paddleStop', () => {
			// For guest, update leftPaddle since the view is mirrored
			this._physics.updateState({
				leftPaddle: {
					...this._physics.getState().leftPaddle,
					dy: 0
				}
			});
			this._lastLocalPaddleUpdate = Date.now();

			if (this._networkManager) {
				this._networkManager.sendGameMessage({
					type: 'paddleStop',
					isHost: false
				});
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
export function createPongGameController({ gameId, currentUser, isHost, useWebGL = true, settings = {}, contextHandlers = {} }) {
	return isHost ?
		new HostPongGameController(gameId, currentUser, useWebGL, settings, contextHandlers) :
		new GuestPongGameController(gameId, currentUser, useWebGL, settings, contextHandlers);
} 
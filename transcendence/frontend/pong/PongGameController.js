import { GameEngine } from './core/GameEngine';
import { GameState } from './core/GameState';
import { WebGLRenderer } from './renderers/WebGLRenderer';
import { Canvas2DRenderer } from './renderers/CanvasRenderer';
import { NetworkManager } from './NetworkManager.js';
import { InputHandler } from './InputHandler.js';
import logger from '../utils/logger.js';

const PADDLE_SPEED = 2; // Changed to match the network handler speed

export class PongGameController {
	constructor(gameId, currentUser, isHost, useWebGL = true) {
		this._gameId = gameId;
		this._currentUser = currentUser;
		this._isHost = isHost;
		this._useWebGL = useWebGL;
		this._initialized = false;

		// Initialize core components
		this._gameEngine = new GameEngine();
		this._gameState = new GameState();
		this._inputHandler = new InputHandler(isHost);
		this._networkManager = new NetworkManager(gameId, currentUser, isHost);

		// Initialize input handler
		this._inputHandler.initialize();

		// Register input handlers
		this._inputHandler.onInput('paddleMove', ({ direction, isHost }) => {
			if (isHost === this._isHost) {
				const speed = direction === 'up' ? -PADDLE_SPEED : PADDLE_SPEED;
				const paddle = this._isHost ? 'leftPaddle' : 'rightPaddle';
				const currentState = this._gameState.getState();

				logger.debug('Updating paddle state:', {
					paddle,
					speed,
					currentState: currentState[paddle],
				});

				this._gameState.updateState({
					[paddle]: {
						...currentState[paddle],
						dy: speed
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
	}

	async initialize() {
		try {
			// Initialize renderer
			const canvas = document.getElementById('game');
			if (!canvas) {
				throw new Error('Game canvas not found');
			}

			// Set canvas size
			canvas.width = 858;
			canvas.height = 525;

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

	launchBall() {
		if (this._isHost) {
			const currentState = this._gameState.getState();
			const ball = currentState.ball;

			if (ball.dx === 0 && ball.dy === 0 && !ball.resetting) {
				this._gameState.updateState({
					ball: {
						...ball,
						dx: 2 * (Math.random() > 0.5 ? 1 : -1),
						dy: 2 * (Math.random() * 2 - 1) // Random value between -2 and 2
					}
				});
			}
		}
	}

	start() {
		if (!this._initialized) {
			throw new Error('Game controller not initialized');
		}

		try {
			logger.debug('Starting game engine...');
			this._gameEngine.start();
			logger.debug('Game engine started');

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
				const dy = data.direction === 'up' ? -PADDLE_SPEED : PADDLE_SPEED;
				const currentState = this._gameState.getState();

				logger.debug('Received remote paddle move:', {
					paddle,
					dy,
					currentState: currentState[paddle]
				});

				this._gameState.updateState({
					[paddle]: {
						...currentState[paddle],
						dy
					}
				});
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

		// Handle state synchronization
		this._networkManager.onGameMessage('stateSync', (data) => {
			if (data.isHost && !this._isHost) {
				this._gameState.updateState(data.state);
			}
		});
	}

	destroy() {
		if (this._gameEngine) {
			this._gameEngine.destroy();
		}

		// Clean up all components
		if (this._inputHandler) {
			this._inputHandler.destroy();
		}
		if (this._networkManager) {
			this._networkManager.destroy();
		}

		this._initialized = false;
		logger.info('Game controller destroyed');
	}
} 
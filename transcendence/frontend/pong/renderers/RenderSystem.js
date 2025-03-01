import logger from '../../logger.js';
import { WebGLRenderer } from './WebGLRenderer.js';
import { Canvas2DRenderer } from './CanvasRenderer.js';
import { store } from '../../state/store.js';

export class RenderSystem {
	/**
	 * Creates a new RenderSystem instance
	 * @param {EventEmitter} eventEmitter - The event emitter for communication
	 * @param {HTMLCanvasElement} canvas - The canvas element for rendering
	 * @param {boolean} useWebGL - Whether to use WebGL for rendering
	 * @param {boolean} isHost - Whether this client is the host
	 * @param {boolean} isLocalGame - Whether this is a local game against AI
	 */
	constructor(eventEmitter, canvas, useWebGL = true, isHost = true, isLocalGame = false) {
		this.eventEmitter = eventEmitter;
		this.canvas = canvas;
		this.useWebGL = useWebGL;
		this.renderer = null;
		this.physicsState = null;
		this.gameMetadata = null;
		this.animationFrameId = null;
		this.lastRenderTime = 0;
		this.isMirrored = !isHost && !isLocalGame;

		logger.info('RenderSystem initialized with perspective:', {
			isMirrored: this.isMirrored,
			isHost: isHost,
			isLocalGame: isLocalGame
		});

		// Bind methods
		this.render = this.render.bind(this);
		this.onPhysicsUpdated = this.onPhysicsUpdated.bind(this);
	}

	/**
	 * Initialize the render system
	 * @returns {boolean} - Whether initialization was successful
	 */
	initialize() {
		logger.info('Initializing render system');

		try {
			this.renderer = this.useWebGL
				? new WebGLRenderer(this.canvas)
				: new Canvas2DRenderer(this.canvas);

			const initialized = this.renderer.initialize();
			if (!initialized) {
				logger.error('Failed to initialize renderer');
				return false;
			}

			this.eventEmitter.on('physicsUpdated', this.onPhysicsUpdated);
			store.subscribe('game', this.updateGameMetadata.bind(this));
			this.startRenderLoop();
			return true;
		} catch (error) {
			logger.error('Error initializing render system:', error);
			return false;
		}
	}

	/**
	 * Start the rendering loop
	 */
	startRenderLoop() {
		if (this.animationFrameId) return;
		this.lastRenderTime = performance.now();
		this.animationFrameId = requestAnimationFrame(this.render);
		logger.info('Render loop started');
	}

	/**
	 * Stop the rendering loop
	 */
	stopRenderLoop() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
			logger.info('Render loop stopped');
		}
	}

	/**
	 * Handle physics state updates
	 * @param {Object} state - The updated physics state
	 */
	onPhysicsUpdated(state) {
		this.physicsState = state;
	}

	/**
	 * Update game metadata from store
	 * @param {Object} state - The game state from the store
	 */
	updateGameMetadata(state) {
		logger.debug('RenderSystem updating game metadata:', state ?
			{
				scores: state.scores ? `${state.scores.left}-${state.scores.right}` : 'missing',
				status: state.status || 'missing'
			} : 'null state');

		this.gameMetadata = {
			scores: state.scores,
			status: state.status,
			settings: state.settings
		};

		if (state.status === 'finished' && this.animationFrameId) {
			logger.info('Stopping render loop because game is finished');
			setTimeout(() => {
				this.stopRenderLoop();
			}, 1000);
		} else if (state.status === 'error' && this.animationFrameId) {
			logger.warn('Stopping render loop because of game error');
			this.stopRenderLoop();
		}
	}

	/**
	 * Transform the game state based on perspective
	 * For guest players, mirror the game horizontally so they see themselves
	 * as playing on the left side even though they control the right paddle
	 * @private
	 * @param {Object} state - The original game state
	 * @param {Object} metadata - Game metadata
	 * @returns {Object} - Transformed state and metadata for rendering
	 */
	_transformStateForPerspective(state, metadata) {
		// If perspective should not be flipped, return original state
		if (!this.isMirrored || !state) {
			return { state, metadata };
		}

		const canvasWidth = this.canvas.width;

		// Create deep copies of state and metadata to avoid modifying originals
		const transformedState = JSON.parse(JSON.stringify(state));
		const transformedMetadata = metadata ? JSON.parse(JSON.stringify(metadata)) : null;

		if (transformedState.ball) {
			transformedState.ball.x = canvasWidth - transformedState.ball.x;
			if (typeof transformedState.ball.dx === 'number')
				transformedState.ball.dx = -transformedState.ball.dx;
		}

		// Swap left and right paddles
		const tempPaddle = transformedState.leftPaddle;
		transformedState.leftPaddle = transformedState.rightPaddle;
		transformedState.rightPaddle = tempPaddle;

		if (transformedState.leftPaddle)
			transformedState.leftPaddle.x = canvasWidth - transformedState.leftPaddle.x - transformedState.leftPaddle.width;

		if (transformedState.rightPaddle)
			transformedState.rightPaddle.x = canvasWidth - transformedState.rightPaddle.x - transformedState.rightPaddle.width;

		if (transformedMetadata && transformedMetadata.scores) {
			const tempScore = transformedMetadata.scores.left;
			transformedMetadata.scores.left = transformedMetadata.scores.right;
			transformedMetadata.scores.right = tempScore;
		}

		return { state: transformedState, metadata: transformedMetadata };
	}

	/**
	 * Render the current state
	 * @param {number} timestamp - The current timestamp
	 */
	render(timestamp) {
		const deltaTime = (timestamp - this.lastRenderTime) / 1000;
		this.lastRenderTime = timestamp;

		if (Math.random() < 0.01) { // Log approximately 1% of frames
			logger.debug('RenderSystem render called:', {
				hasRenderer: !!this.renderer,
				hasPhysicsState: !!this.physicsState,
				hasGameMetadata: !!this.gameMetadata,
				deltaTime: deltaTime.toFixed(3),
				isMirrored: this.isMirrored
			});
		}

		if (this.renderer && this.physicsState) {
			const { state: renderState, metadata: renderMetadata } =
				this._transformStateForPerspective(this.physicsState, this.gameMetadata);

			this.renderer.render(renderState, renderMetadata, deltaTime);
		}

		if (this.gameMetadata && this.gameMetadata.status === 'finished') {
			logger.info('Not scheduling next render frame - game is finished');
			this.animationFrameId = null;
			return;
		}

		// Schedule next frame
		this.animationFrameId = requestAnimationFrame(this.render);
	}

	/**
	 * Switch renderer type
	 * @param {boolean} useWebGL - Whether to use WebGL
	 */
	switchRenderer(useWebGL) {
		this.useWebGL = useWebGL;

		// Clean up current renderer
		if (this.renderer) {
			this.renderer.destroy();
		}

		try {
			this.renderer = this.useWebGL
				? new WebGLRenderer(this.canvas)
				: new Canvas2DRenderer(this.canvas);

			const initialized = this.renderer.initialize();

			if (!initialized && this.useWebGL) {
				logger.warn('WebGL renderer initialization failed, falling back to Canvas2D');
				this.useWebGL = false;
				this.renderer = new Canvas2DRenderer(this.canvas);
				this.renderer.initialize();
			}

			logger.info(`Using ${this.useWebGL ? 'WebGL' : 'Canvas2D'} renderer`);
		} catch (error) {
			logger.error('Error switching renderer:', error);

			if (this.useWebGL) {
				logger.warn('Falling back to Canvas2D renderer after error');
				this.useWebGL = false;
				this.renderer = new Canvas2DRenderer(this.canvas);
				this.renderer.initialize();
			}
		}
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		logger.info('Destroying render system');
		this.stopRenderLoop();
		this.eventEmitter.off('physicsUpdated', this.onPhysicsUpdated);
		if (this.renderer) {
			this.renderer.destroy();
			this.renderer = null;
		}
	}
} 
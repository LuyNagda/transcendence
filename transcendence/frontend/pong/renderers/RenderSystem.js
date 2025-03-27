import logger from '../../logger.js';
import { Canvas2DRenderer } from './CanvasRenderer.js';
import { store } from '../../state/store.js';

export class RenderSystem {
	/**
	 * Creates a new RenderSystem instance
	 * @param {EventEmitter} eventEmitter - The event emitter for communication
	 * @param {HTMLCanvasElement} canvas - The canvas element for rendering
	 * @param {boolean} isHost - Whether this client is the host
	 * @param {boolean} isLocalGame - Whether this is a local game against AI
	 */
	constructor(eventEmitter, canvas, isHost = true, isLocalGame = false) {
		this.eventEmitter = eventEmitter;
		this.canvas = canvas;
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
			this.renderer = new Canvas2DRenderer(this.canvas);

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
			transformedState.leftPaddle.x = canvasWidth - transformedState.leftPaddle.x;

		if (transformedState.rightPaddle)
			transformedState.rightPaddle.x = canvasWidth - transformedState.rightPaddle.x;

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
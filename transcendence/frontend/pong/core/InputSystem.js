import logger from '../../logger.js';
import { AIController } from '../AIController.js';

export class InputSystem {
	/**
	 * Creates a new InputSystem instance
	 * @param {EventEmitter} eventEmitter - The event emitter for communication
	 */
	constructor(eventEmitter) {
		this.eventEmitter = eventEmitter;
		this.inputProviders = new Map();
		this.enabled = true;
	}

	/**
	 * Initialize the input system
	 * @returns {boolean} - Whether initialization was successful
	 */
	initialize() {
		logger.info('Initializing input system');
		return true;
	}

	/**
	 * Register an input provider for a player
	 * @param {string} player - The player ('left' or 'right')
	 * @param {Object} inputProvider - The input provider instance
	 */
	registerInput(player, inputProvider) {
		logger.info(`Registering ${inputProvider.constructor.name} for ${player} player`);

		// Clean up existing provider if any
		if (this.inputProviders.has(player)) {
			this.inputProviders.get(player).cleanup();
		}

		this.inputProviders.set(player, inputProvider);

		// Initialize the provider with callback
		inputProvider.initialize(input => {
			if (!this.enabled) return;

			this.eventEmitter.emit('playerInput', {
				player,
				input
			});
		});
	}

	/**
	 * Enable input processing
	 */
	enable() {
		this.enabled = true;
	}

	/**
	 * Disable input processing
	 */
	disable() {
		this.enabled = false;
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		logger.info('Destroying input system');

		for (const provider of this.inputProviders.values()) {
			provider.cleanup();
		}

		this.inputProviders.clear();
	}
}

/**
 * KeyboardInput
 * 
 * Input provider for keyboard controls.
 */
export class KeyboardInput {
	/**
	 * Creates a new KeyboardInput instance
	 * @param {Object} options - Configuration options
	 * @param {Object} options.keyMap - Key mapping configuration
	 */
	constructor(options = {}) {
		this.callback = null;
		this.keyStates = { up: false, down: false };
		this.keyMap = options.keyMap || {
			up: 'w',
			down: 's'
		};
		this.keyDownHandler = null;
		this.keyUpHandler = null;
	}

	/**
	 * Initialize the keyboard input
	 * @param {Function} callback - Callback function for input events
	 */
	initialize(callback) {
		this.callback = callback;

		// Set up event listeners
		this.keyDownHandler = this.handleKeyDown.bind(this);
		this.keyUpHandler = this.handleKeyUp.bind(this);

		window.addEventListener('keydown', this.keyDownHandler);
		window.addEventListener('keyup', this.keyUpHandler);

		logger.info('Keyboard input initialized');
	}

	/**
	 * Handle key down events
	 * @param {KeyboardEvent} event - The keyboard event
	 */
	handleKeyDown(event) {
		this.updateKeyState(event.key, true);
	}

	/**
	 * Handle key up events
	 * @param {KeyboardEvent} event - The keyboard event
	 */
	handleKeyUp(event) {
		this.updateKeyState(event.key, false);
	}

	/**
	 * Update key state and send input if changed
	 * @param {string} key - The key that was pressed/released
	 * @param {boolean} isPressed - Whether the key is pressed
	 */
	updateKeyState(key, isPressed) {
		// Update key state based on pressed keys
		let stateChanged = false;

		if (key === this.keyMap.up && this.keyStates.up !== isPressed) {
			this.keyStates.up = isPressed;
			stateChanged = true;
		} else if (key === this.keyMap.down && this.keyStates.down !== isPressed) {
			this.keyStates.down = isPressed;
			stateChanged = true;
		}

		// Only send update if state changed
		if (stateChanged && this.callback) {
			// Calculate movement direction and intensity
			let direction = 0;
			if (this.keyStates.up) direction -= 1;
			if (this.keyStates.down) direction += 1;

			this.callback({
				direction,
				intensity: 1.0
			});
		}
	}

	/**
	 * Clean up resources
	 */
	cleanup() {
		window.removeEventListener('keydown', this.keyDownHandler);
		window.removeEventListener('keyup', this.keyUpHandler);

		this.keyDownHandler = null;
		this.keyUpHandler = null;
		this.callback = null;

		logger.info('Keyboard input cleaned up');
	}
}

/**
 * KeyboardInputGuest
 * 
 * Input provider for keyboard controls for a guest in 1vs1 local
 */
export class KeyboardInputGuest {
	/**
	 * Creates a new KeyboardInputGuest instance
	 * @param {Object} options - Configuration options
	 * @param {Object} options.keyMap - Key mapping configuration
	 */
	constructor(options = {}) {
		this.callback = null;
		this.keyStates = { up: false, down: false };
		this.keyMap = options.keyMap || {
			up: 'ArrowUp',
			down: 'ArrowDown'
		};
		this.keyDownHandler = null;
		this.keyUpHandler = null;
	}

	/**
	 * Initialize the keyboard input
	 * @param {Function} callback - Callback function for input events
	 */
	initialize(callback) {
		this.callback = callback;

		// Set up event listeners
		this.keyDownHandler = this.handleKeyDown.bind(this);
		this.keyUpHandler = this.handleKeyUp.bind(this);

		window.addEventListener('keydown', this.keyDownHandler);
		window.addEventListener('keyup', this.keyUpHandler);

		logger.info('Keyboard input Guest initialized');
	}

	/**
	 * Handle key down events
	 * @param {KeyboardEvent} event - The keyboard event
	 */
	handleKeyDown(event) {
		this.updateKeyState(event.key, true);
	}

	/**
	 * Handle key up events
	 * @param {KeyboardEvent} event - The keyboard event
	 */
	handleKeyUp(event) {
		this.updateKeyState(event.key, false);
	}

	/**
	 * Update key state and send input if changed
	 * @param {string} key - The key that was pressed/released
	 * @param {boolean} isPressed - Whether the key is pressed
	 */
	updateKeyState(key, isPressed) {
		// Update key state based on pressed keys
		let stateChanged = false;

		if (key === this.keyMap.up && this.keyStates.up !== isPressed) {
			this.keyStates.up = isPressed;
			stateChanged = true;
		} else if (key === this.keyMap.down && this.keyStates.down !== isPressed) {
			this.keyStates.down = isPressed;
			stateChanged = true;
		}
		
		// Only send update if state changed
		if (stateChanged && this.callback) {
			let direction = 0;
			if (this.keyStates.up) direction -= 1;
			if (this.keyStates.down) direction += 1;

			this.callback({
			direction,
			intensity: 1.0
			});
		}
	}

	/**
	 * Clean up resources
	 */
	cleanup() {
		window.removeEventListener('keydown', this.keyDownHandler);
		window.removeEventListener('keyup', this.keyUpHandler);

		this.keyDownHandler = null;
		this.keyUpHandler = null;
		this.callback = null;

		logger.info('Keyboard input Guest cleaned up');
	}
}
  
/**
 * NetworkInput
 * 
 * Input provider for network-based controls.
 */
export class NetworkInput {
	/**
	 * Creates a new NetworkInput instance
	 * @param {Object} networkSystem - The network system
	 */
	constructor(networkSystem) {
		this.networkSystem = networkSystem;
		this.callback = null;
		this.messageHandler = null;
	}

	/**
	 * Initialize the network input
	 * @param {Function} callback - Callback function for input events
	 */
	initialize(callback) {
		this.callback = callback;

		// Listen for remote input events
		this.messageHandler = this.handleRemoteInput.bind(this);
		this.networkSystem.on('remoteInput', this.messageHandler);

		logger.info('Network input initialized');
	}

	/**
	 * Handle remote input events
	 * @param {Object} input - The input data
	 */
	handleRemoteInput(input) {
		if (this.callback) {
			this.callback(input);
		}
	}

	/**
	 * Clean up resources
	 */
	cleanup() {
		if (this.networkSystem && this.messageHandler) {
			this.networkSystem.off('remoteInput', this.messageHandler);
		}

		this.messageHandler = null;
		this.callback = null;

		logger.info('Network input cleaned up');
	}
}

/**
 * AIInput
 * 
 * Input provider for AI-controlled paddles.
 */
export class AIInput {
	/**
	 * Creates a new AIInput instance
	 * @param {EventEmitter} eventEmitter - The event emitter for communication
	 * @param {string} difficulty - AI difficulty level
	 */
	constructor(eventEmitter, difficulty = 'medium') {
		this.eventEmitter = eventEmitter;
		this.difficulty = difficulty;
		this.callback = null;
		this.physicsHandler = null;
		this.lastPrediction = { direction: 0, intensity: 0 };
		this.aiController = null;
	}

	/**
	 * Initialize the AI input
	 * @param {Function} callback - Callback function for input events
	 */
	async initialize(callback) {
		this.callback = callback;

		// Load AI model using AIController
		try {
			logger.info(`Loading AI model with difficulty: ${this.difficulty}`);

			// Initialize the AIController with the specified difficulty
			this.aiController = await AIController.init(this.difficulty);

			// Register for physics updates to make decisions
			this.physicsHandler = this.makePrediction.bind(this);
			this.eventEmitter.on('physicsUpdated', this.physicsHandler);

			logger.info('AI input initialized with neural network controller');
		} catch (error) {
			logger.error('Failed to initialize AI input:', error);
		}
	}

	/**
	 * Make a prediction based on the current physics state
	 * @param {Object} physicsState - The current physics state
	 */
	makePrediction(physicsState) {
		if (!this.aiController || !this.callback) return;

		try {
			// Use AIController's neural network to make a decision
			const aiDecision = this.aiController.decision(physicsState);

			// Map the decision to paddle movement:
			// 0 = move up (-1)
			// 1 = stay still (0)
			// 2 = move down (1)
			let direction = 0;
			let intensity = 1.0;

			if (aiDecision === 0) {
				direction = -1; // Move up
			} else if (aiDecision === 2) {
				direction = 1;  // Move down
			}

			// Only send update if prediction changes
			if (direction !== this.lastPrediction.direction) {
				this.lastPrediction = { direction, intensity };
				this.callback(this.lastPrediction);
			}
		} catch (error) {
			logger.error('Error in AI decision making:', error);
			// Fall back to simple prediction on error
			this.makeSimplePrediction(physicsState);
		}
	}

	/**
	 * Simple prediction fallback if neural network fails
	 * @param {Object} physicsState - The current physics state
	 */
	makeSimplePrediction(physicsState) {
		const ball = physicsState.ball;
		const paddle = physicsState.rightPaddle; // Assuming AI controls right paddle

		// Calculate paddle center
		const paddleCenter = paddle.y;

		// Only move if the ball is moving towards the AI paddle
		if (ball.dx > 0) {
			// Determine direction to move based on ball position
			let direction = 0;

			if (ball.y < paddleCenter - 10) {
				direction = -1; // Move up
			} else if (ball.y > paddleCenter + 10) {
				direction = 1; // Move down
			}

			// Only send update if prediction changes
			if (direction !== this.lastPrediction.direction) {
				this.lastPrediction = { direction, intensity: 1.0 };
				this.callback(this.lastPrediction);
			}
		} else if (this.lastPrediction.direction !== 0) {
			// Stop paddle when ball is moving away
			this.lastPrediction = { direction: 0, intensity: 0 };
			this.callback(this.lastPrediction);
		}
	}

	/**
	 * Clean up resources
	 */
	cleanup() {
		if (this.eventEmitter && this.physicsHandler) {
			this.eventEmitter.off('physicsUpdated', this.physicsHandler);
		}

		this.physicsHandler = null;
		this.callback = null;
		this.aiController = null;

		logger.info('AI input cleaned up');
	}
} 
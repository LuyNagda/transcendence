import logger from '../../logger.js';
import { GameRules } from './GameRules.js';
import { SettingsManager } from './SettingsManager.js';

/**
 * @typedef {Object} GameSettings
 * @property {number} ballSpeed - Ball speed (1-10)
 * @property {number} paddleSize - Paddle size (1-10)
 * @property {number} paddleSpeed - Paddle movement speed (1-10)
 * @property {number} maxScore - Points needed to win
 * @property {string} aiDifficulty - AI difficulty level
 * @property {number} relaunchTime - Ball relaunch delay in ms
 */

export class PongPhysics {
	constructor(settings = {}) {
		this._observers = new Set();
		this._settingsManager = new SettingsManager(settings);
		this._state = this._getInitialState();
	}

	getSettings() {
		return this._settingsManager.getSettings();
	}

	_getInitialState() {
		const canvas = document.getElementById('game');
		const paddleHeight = this._settingsManager.getPaddleHeight();

		return {
			leftPaddle: {
				x: 50,
				y: canvas.height / 2 - (paddleHeight / 2),
				width: GameRules.BASE_PADDLE_WIDTH,
				height: paddleHeight,
				dy: 0
			},
			rightPaddle: {
				x: canvas.width - 60,
				y: canvas.height / 2 - (paddleHeight / 2),
				width: GameRules.BASE_PADDLE_WIDTH,
				height: paddleHeight,
				dy: 0
			},
			ball: {
				x: canvas.width / 2,
				y: canvas.height / 2,
				width: GameRules.BALL_WIDTH,
				height: GameRules.BALL_HEIGHT,
				dx: 0,
				dy: 0,
				resetting: false
			},
			scores: {
				left: 0,
				right: 0
			},
			gameStatus: 'waiting',
			lastUpdateTime: Date.now()
		};
	}

	updateSettings(settings) {
		this._settingsManager.updateSettings(settings);
		logger.debug('GameState updated with settings:', settings);

		// Update paddle heights and positions based on new settings
		const paddlePositions = this._settingsManager.getInitialPaddlePositions();
		const paddleHeight = this._settingsManager.getPaddleHeight();
		const newState = { ...this._state };

		// Update paddles
		newState.leftPaddle.height = paddleHeight;
		newState.rightPaddle.height = paddleHeight;
		newState.leftPaddle.y = paddlePositions.left.y;
		newState.rightPaddle.y = paddlePositions.right.y;

		this.updateState(newState);
	}

	getInitialBallVelocity() {
		const ballSpeed = this._settingsManager.getBallSpeed();
		// Start with a slight upward or downward angle
		const randomAngle = (Math.random() * Math.PI / 4) - (Math.PI / 8); // Random angle between -22.5 and 22.5 degrees
		return {
			dx: ballSpeed * Math.cos(randomAngle),
			dy: ballSpeed * Math.sin(randomAngle)
		};
	}

	getPaddleSpeed() {
		return this._settingsManager.getPaddleSpeed();
	}

	subscribe(observer) {
		this._observers.add(observer);
	}

	unsubscribe(observer) {
		this._observers.delete(observer);
	}

	getState() {
		return { ...this._state };
	}

	getTransformedState() {
		const state = this.getState();
		const canvas = document.getElementById('game');

		// Transform paddle positions
		const leftPaddle = { ...state.rightPaddle };
		const rightPaddle = { ...state.leftPaddle };
		leftPaddle.x = canvas.width - leftPaddle.x - leftPaddle.width;
		rightPaddle.x = canvas.width - rightPaddle.x - rightPaddle.width;

		// Transform ball position
		const ball = { ...state.ball };
		ball.x = canvas.width - ball.x - ball.width;
		ball.dx = -ball.dx;

		return {
			...state,
			leftPaddle,
			rightPaddle,
			ball,
			scores: {
				left: state.scores.right,
				right: state.scores.left
			}
		};
	}

	updateState(partialState) {
		if (!partialState) return;

		// Direct assignment for better performance
		Object.assign(this._state, partialState);

		// Special handling for nested objects
		if (partialState.ball) {
			Object.assign(this._state.ball, partialState.ball);
		}
		if (partialState.scores) {
			Object.assign(this._state.scores, partialState.scores);
		}

		this._state.lastUpdateTime = Date.now();
		this._notifyObservers(this._state);
	}

	_notifyObservers(state) {
		for (const observer of this._observers) {
			if (observer.onStateChange) {
				observer.onStateChange(state, state);
			}
		}
	}

	resetBall() {
		const ballPosition = this._settingsManager.getInitialBallPosition();
		this._state.ball.x = ballPosition.x;
		this._state.ball.y = ballPosition.y;
		this._state.ball.dx = 0;
		this._state.ball.dy = 0;
		this._state.ball.resetting = false;
		this._notifyObservers(this._state);
	}

	updateScore(side) {
		this._state.scores[side] += 1;

		// Check for game end using GameRules winningScore
		if (this._state.scores[side] >= this._settingsManager.getSettings().maxScore) {
			logger.info('Game finished - Final scores:', this._state.scores);
			this._state.gameStatus = 'finished';

			// Notify observers about game completion
			for (const observer of this._observers) {
				if (observer.onStateChange) {
					observer.onStateChange(this._state, this._state);
				}
				if (observer.onGameComplete) {
					observer.onGameComplete(this._state.scores);
				}
			}
		} else {
			this._notifyObservers(this._state);
		}
	}

	resetGame() {
		this._state.scores.left = 0;
		this._state.scores.right = 0;
		this._state.gameStatus = 'waiting';
		this._notifyObservers(this._state);
		this.resetBall();
	}

	update() {
		const now = Date.now();
		const deltaTime = (now - this._state.lastUpdateTime) / 1000;

		// Don't update if game is not in playing state
		if (this._state.gameStatus !== 'playing') {
			return;
		}

		// Handle ball movement and collisions
		const ballUpdate = this._handleBallCollisions(deltaTime);
		if (ballUpdate) {
			if (ballUpdate.type === 'goal') {
				this.updateScore(ballUpdate.scoringSide);
				// Only continue with ball updates if game is still playing
				if (this._state.gameStatus === 'playing') {
					this.updateState({ ball: ballUpdate.ball });
					// Schedule ball relaunch
					setTimeout(() => {
						if (this._state.gameStatus === 'playing') {
							const velocity = this.getInitialBallVelocity();
							this.updateState({
								ball: { ...this._state.ball, ...velocity, resetting: false }
							});
						}
					}, this._settingsManager.getRelaunchTime());
				}
			} else {
				this.updateState({ ball: ballUpdate.ball });
			}
		}

		// Only update paddles if game is still playing
		if (this._state.gameStatus === 'playing') {
			// Update paddles
			const paddleUpdates = this._updatePaddles(deltaTime);

			// Check paddle collisions
			if (!this._state.ball.resetting) {
				const ball = { ...this._state.ball };
				if (this._handlePaddleCollisions(ball, paddleUpdates.leftPaddle, true) ||
					this._handlePaddleCollisions(ball, paddleUpdates.rightPaddle, false)) {
					this.updateState({ ball });
				}
			}

			// Update state
			this.updateState({
				...paddleUpdates,
				lastUpdateTime: now
			});
		}
	}

	_handleBallCollisions(deltaTime) {
		const ball = { ...this._state.ball };
		if (ball.resetting) return null;

		const canvasHeight = this._settingsManager.getCanvasHeight();
		const canvasWidth = this._settingsManager.getCanvasWidth();

		// Wall collisions
		if (ball.y <= 0 || ball.y + ball.height >= canvasHeight) {
			ball.dy *= -1;
			ball.y = ball.y <= 0 ? 0 : canvasHeight - ball.height;
		}

		// Goal detection
		if (ball.x <= 0 || ball.x >= canvasWidth) {
			const scoringSide = ball.x <= 0 ? 'right' : 'left';
			const ballPosition = this._settingsManager.getInitialBallPosition();
			return {
				type: 'goal',
				scoringSide,
				ball: {
					x: ballPosition.x,
					y: ballPosition.y,
					width: GameRules.BALL_WIDTH,
					height: GameRules.BALL_HEIGHT,
					dx: 0,
					dy: 0,
					resetting: true
				}
			};
		}

		// Update position using configured ball speed and deltaTime
		const ballSpeed = this._settingsManager.getBallSpeed();
		ball.x += ball.dx * ballSpeed * deltaTime;
		ball.y += ball.dy * ballSpeed * deltaTime;

		return { type: 'move', ball };
	}

	_handlePaddleCollisions(ball, paddle, isLeftPaddle) {
		if (this._detectPaddleCollision(ball, paddle)) {
			ball.dx = isLeftPaddle ? Math.abs(ball.dx) : -Math.abs(ball.dx);
			ball.x = isLeftPaddle ?
				paddle.x + paddle.width :
				paddle.x - ball.width;

			this._updateBallAngle(ball, paddle);
			return true;
		}
		return false;
	}

	_detectPaddleCollision(ball, paddle) {
		return ball.x <= paddle.x + paddle.width &&
			ball.x + ball.width >= paddle.x &&
			ball.y + ball.height >= paddle.y &&
			ball.y <= paddle.y + paddle.height;
	}

	_updateBallAngle(ball, paddle) {
		const relativeIntersectY = (paddle.y + (paddle.height / 2)) - (ball.y + (ball.height / 2));
		const normalizedRelativeIntersectionY = relativeIntersectY / (paddle.height / 2);
		const bounceAngle = normalizedRelativeIntersectionY * (5 * Math.PI / 12);
		const ballSpeed = this._settingsManager.getBallSpeed();
		ball.dy = ballSpeed * -Math.sin(bounceAngle);
		ball.dx = (ball.dx > 0 ? 1 : -1) * ballSpeed * Math.cos(bounceAngle);
	}

	_updatePaddles(deltaTime) {
		const leftPaddle = this._state.leftPaddle;
		const rightPaddle = this._state.rightPaddle;
		const canvasHeight = this._settingsManager.getCanvasHeight();
		const paddleSpeed = this.getPaddleSpeed();

		// Update positions
		leftPaddle.y += leftPaddle.dy * paddleSpeed * deltaTime;
		rightPaddle.y += rightPaddle.dy * paddleSpeed * deltaTime;

		// Clamp paddles to screen bounds
		leftPaddle.y = Math.max(0, Math.min(canvasHeight - leftPaddle.height, leftPaddle.y));
		rightPaddle.y = Math.max(0, Math.min(canvasHeight - rightPaddle.height, rightPaddle.y));

		return { leftPaddle, rightPaddle };
	}

	_validateStateUpdate(partialState) {
		// Only validate critical game state transitions
		if (partialState.gameStatus &&
			!['waiting', 'playing', 'finished', 'paused'].includes(partialState.gameStatus)) {
			return false;
		}
		return true;
	}
} 
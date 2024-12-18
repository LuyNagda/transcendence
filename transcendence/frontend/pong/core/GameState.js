import logger from '../../utils/logger.js';
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

export class GameState {
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
		return this._settingsManager.getInitialBallVelocity();
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

	updateState(partialState) {
		if (!this._validateStateUpdate(partialState)) {
			logger.error('Invalid state update rejected');
			return;
		}
		const oldState = { ...this._state };
		this._state = {
			...this._state,
			...partialState,
			lastUpdateTime: Date.now()
		};

		// Notify observers of state change
		this._notifyObservers(oldState);
	}

	_notifyObservers(oldState) {
		for (const observer of this._observers) {
			observer.onStateChange(this._state, oldState);
		}
	}

	resetBall() {
		const ballPosition = this._settingsManager.getInitialBallPosition();
		const ballState = {
			ball: {
				...this._state.ball,
				x: ballPosition.x,
				y: ballPosition.y,
				dx: 0,
				dy: 0,
				resetting: false
			}
		};
		this.updateState(ballState);
	}

	updateScore(side) {
		const scores = { ...this._state.scores };
		scores[side] += 1;
		this.updateState({ scores });

		// Check for game end using GameRules winningScore
		if (scores[side] >= this._settingsManager.getSettings().maxScore) {
			this.updateState({ gameStatus: 'finished' });
		}
	}

	resetGame() {
		this.updateState({
			scores: { left: 0, right: 0 },
			gameStatus: 'waiting'
		});
		this.resetBall();
	}

	update() {
		const now = Date.now();
		const deltaTime = (now - this._state.lastUpdateTime) / 1000;

		if (this._state.gameStatus !== 'playing') return;

		// Handle ball movement and collisions
		const ballUpdate = this._handleBallCollisions(deltaTime);
		if (ballUpdate) {
			if (ballUpdate.type === 'goal') {
				this.updateScore(ballUpdate.scoringSide);
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
					}, this._settingsManager.getSettings().relaunchTime);
				}
			} else {
				this.updateState({ ball: ballUpdate.ball });
			}
		}

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
		const leftPaddle = { ...this._state.leftPaddle };
		const rightPaddle = { ...this._state.rightPaddle };
		const canvasHeight = this._settingsManager.getCanvasHeight();

		// Apply paddle speed from settings
		const paddleSpeed = this.getPaddleSpeed();
		leftPaddle.y += leftPaddle.dy * paddleSpeed * deltaTime;
		rightPaddle.y += rightPaddle.dy * paddleSpeed * deltaTime;

		// Clamp paddles to screen bounds
		leftPaddle.y = Math.max(0, Math.min(canvasHeight - leftPaddle.height, leftPaddle.y));
		rightPaddle.y = Math.max(0, Math.min(canvasHeight - rightPaddle.height, rightPaddle.y));

		return { leftPaddle, rightPaddle };
	}

	_validateStateUpdate(partialState) {
		// Implement state validation logic here
		return true;
	}
} 
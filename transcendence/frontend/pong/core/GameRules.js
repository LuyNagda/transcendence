export class GameRules {
	static DEFAULT_SETTINGS = {
		ballSpeed: 5,          // Scale 1-10
		paddleSize: 5,         // Scale 1-10
		paddleSpeed: 5,        // Scale 1-10
		maxScore: 11,
		aiDifficulty: 'medium',
		relaunchTime: 2000     // In ms
	};

	// Game constants
	static BASE_BALL_SPEED = 15;
	static BASE_PADDLE_SPEED = 12;
	static BASE_PADDLE_HEIGHT = 50;
	static CANVAS_WIDTH = 858;
	static CANVAS_HEIGHT = 525;

	constructor(gameState, settings = {}) {
		this._gameState = gameState;
		this._settings = {
			ballSpeed: settings.ballSpeed || GameRules.DEFAULT_SETTINGS.ballSpeed,
			paddleSize: settings.paddleSize || GameRules.DEFAULT_SETTINGS.paddleSize,
			paddleSpeed: settings.paddleSpeed || GameRules.DEFAULT_SETTINGS.paddleSpeed,
			maxScore: settings.maxScore || GameRules.DEFAULT_SETTINGS.maxScore,
			relaunchTime: settings.relaunchTime || GameRules.DEFAULT_SETTINGS.relaunchTime
		};
	}

	updateSettings(settings) {
		this._settings = {
			...this._settings,
			ballSpeed: settings.ballSpeed !== undefined ? settings.ballSpeed : this._settings.ballSpeed,
			paddleSize: settings.paddleSize !== undefined ? settings.paddleSize : this._settings.paddleSize,
			paddleSpeed: settings.paddleSpeed !== undefined ? settings.paddleSpeed : this._settings.paddleSpeed,
			maxScore: settings.maxScore !== undefined ? settings.maxScore : this._settings.maxScore,
			relaunchTime: settings.relaunchTime !== undefined ? settings.relaunchTime : this._settings.relaunchTime
		};
	}

	get ballSpeed() {
		return GameRules.BASE_BALL_SPEED * (this._settings.ballSpeed / 5);
	}

	get paddleSpeed() {
		const scaleFactor = 0.4 + (this._settings.paddleSpeed / 5);
		return GameRules.BASE_PADDLE_SPEED * scaleFactor;
	}

	get paddleHeight() {
		return GameRules.BASE_PADDLE_HEIGHT * (this._settings.paddleSize / 5);
	}

	get winningScore() {
		return this._settings.maxScore;
	}

	get relaunchTime() {
		return this._settings.relaunchTime;
	}

	handleBallCollisions(deltaTime) {
		const ball = { ...this._gameState.getState().ball };
		if (ball.resetting) return null;

		// Wall collisions
		if (ball.y <= 0 || ball.y + ball.height >= GameRules.CANVAS_HEIGHT) {
			ball.dy *= -1;
			ball.y = ball.y <= 0 ? 0 : GameRules.CANVAS_HEIGHT - ball.height;
		}

		// Goal detection
		if (ball.x <= 0 || ball.x >= GameRules.CANVAS_WIDTH) {
			const scoringSide = ball.x <= 0 ? 'right' : 'left';
			return { type: 'goal', scoringSide, ball: this._getResetBall() };
		}

		// Update position using configured ball speed and deltaTime
		ball.x += ball.dx * this.ballSpeed * deltaTime;
		ball.y += ball.dy * this.ballSpeed * deltaTime;

		return { type: 'move', ball };
	}

	handlePaddleCollisions(ball, paddle, isLeftPaddle) {
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
		ball.dy = this.ballSpeed * -Math.sin(bounceAngle);
		ball.dx = (ball.dx > 0 ? 1 : -1) * this.ballSpeed * Math.cos(bounceAngle);
	}

	_getResetBall() {
		return {
			x: GameRules.CANVAS_WIDTH / 2,
			y: GameRules.CANVAS_HEIGHT / 2,
			width: 5,
			height: 5,
			dx: 0,
			dy: 0,
			resetting: true
		};
	}

	getInitialBallVelocity() {
		const angle = (Math.random() * 2 - 1) * Math.PI / 4; // Random angle between -45 and 45 degrees
		return {
			dx: this.ballSpeed * (Math.random() > 0.5 ? 1 : -1) * Math.cos(angle),
			dy: this.ballSpeed * Math.sin(angle)
		};
	}

	isGameOver(scores) {
		return scores.left >= GameRules.WINNING_SCORE ||
			scores.right >= GameRules.WINNING_SCORE;
	}
} 
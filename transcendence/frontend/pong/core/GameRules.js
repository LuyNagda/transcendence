export class GameRules {
	static WINNING_SCORE = 11;
	static BALL_SPEED = 107;
	static PADDLE_SPEED = 212;
	static INITIAL_BALL_SPEED = 2;
	static CANVAS_WIDTH = 858;
	static CANVAS_HEIGHT = 525;

	constructor(gameState) {
		this._gameState = gameState;
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

		// Update position
		ball.x += ball.dx * deltaTime * GameRules.BALL_SPEED;
		ball.y += ball.dy * deltaTime * GameRules.BALL_SPEED;

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
		ball.dy = GameRules.INITIAL_BALL_SPEED * -Math.sin(bounceAngle);
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
		return {
			dx: GameRules.INITIAL_BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
			dy: GameRules.INITIAL_BALL_SPEED * (Math.random() * 2 - 1)
		};
	}

	isGameOver(scores) {
		return scores.left >= GameRules.WINNING_SCORE ||
			scores.right >= GameRules.WINNING_SCORE;
	}
} 
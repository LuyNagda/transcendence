import logger from '../../logger.js';
import { RendererInterface } from './RendererInterface';

export class Canvas2DRenderer extends RendererInterface {
	constructor(canvas) {
		super(canvas);
		this._context = null;
	}

	initialize() {
		this._context = this._canvas.getContext('2d');
		return true;
	}

	render(gameState, gameMetadata, deltaTime) {
		if (Math.random() < 0.01) { // Log approximately 1% of frames
			logger.debug('Canvas2DRenderer render called:', {
				hasGameState: !!gameState,
				ball: gameState?.ball ? { x: gameState.ball.x, y: gameState.ball.y, radius: gameState.ball.radius } : 'missing',
				leftPaddle: gameState?.leftPaddle ? 'present' : 'missing',
				rightPaddle: gameState?.rightPaddle ? 'present' : 'missing',
				hasGameMetadata: !!gameMetadata,
				scores: gameMetadata?.scores ? `${gameMetadata.scores.left}-${gameMetadata.scores.right}` : 'missing',
				deltaTime: deltaTime
			});
		}

		// Clear the canvas
		this._context.fillStyle = '#000';
		this._context.fillRect(0, 0, this._canvas.width, this._canvas.height);

		if (!gameState) return;

		// Set default fill style for game objects
		this._context.fillStyle = '#fff';
		this._drawPaddle(gameState.leftPaddle);
		this._drawPaddle(gameState.rightPaddle);
		this._drawBall(gameState.ball);

		const scores = (gameMetadata && gameMetadata.scores) || gameState.scores;
		this._drawScore(scores);
		this._drawCenterLine();
	}

	_drawPaddle(paddle) {
		if (!paddle) {
			logger.error('Cannot draw paddle: paddle object is null or undefined');
			return;
		}

		if (typeof paddle.x !== 'number' || typeof paddle.y !== 'number' ||
			typeof paddle.width !== 'number' || typeof paddle.height !== 'number') {
			logger.warn('Paddle has invalid properties:', {
				x: paddle.x,
				y: paddle.y,
				width: paddle.width,
				height: paddle.height,
				type_x: typeof paddle.x,
				type_y: typeof paddle.y,
				type_width: typeof paddle.width,
				type_height: typeof paddle.height
			});
		}

		this._context.fillRect(
			typeof paddle.x === 'number' ? (paddle.x - gameState.paddle.width) : 10,
			typeof paddle.y === 'number' ? (paddle.y - gameState.paddle.height) : 10,
			typeof paddle.width === 'number' ? paddle.width : 10,
			typeof paddle.height === 'number' ? paddle.height : 50
		);
	}

	_drawBall(ball) {
		if (!ball) {
			logger.error('Cannot draw ball: ball object is null or undefined');
			return;
		}

		if (typeof ball.x !== 'number' || typeof ball.y !== 'number' || typeof ball.radius !== 'number') {
			logger.warn('Ball has invalid properties:', {
				x: ball.x,
				y: ball.y,
				radius: ball.radius,
				type_x: typeof ball.x,
				type_y: typeof ball.y,
				type_radius: typeof ball.radius
			});
		}

		this._context.beginPath();
		this._context.arc(
			typeof ball.x === 'number' ? ball.x : this._canvas.width / 2,
			typeof ball.y === 'number' ? ball.y : this._canvas.height / 2,
			typeof ball.radius === 'number' ? ball.radius : 5,
			0,
			Math.PI * 2
		);
		this._context.fill();
	}

	_drawScore(scores) {
		this._context.font = '40px PongScore';
		this._context.textAlign = 'center';

		this._context.fillText(
			scores.left,
			this._canvas.width / 4,
			50
		);

		this._context.fillText(
			scores.right,
			(3 * this._canvas.width) / 4,
			50
		);
	}

	_drawCenterLine() {
		for (let i = 0; i < this._canvas.height; i += 10) {
			this._context.fillRect(
				this._canvas.width / 2 - 1,
				i,
				2,
				5
			);
		}
	}

	resize(width, height) {
		this._canvas.width = width;
		this._canvas.height = height;
	}

	destroy() {
		if (this._context) {
			this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
			this._context = null;
		}
		this._canvas = null;
	}
}
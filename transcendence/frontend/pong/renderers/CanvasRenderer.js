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

	render(gameState) {
		// Clear the canvas
		this._context.fillStyle = '#000';
		this._context.fillRect(0, 0, this._canvas.width, this._canvas.height);

		// Set default fill style for game objects
		this._context.fillStyle = '#fff';

		// Draw game elements
		this._drawPaddle(gameState.leftPaddle);
		this._drawPaddle(gameState.rightPaddle);
		this._drawBall(gameState.ball);
		this._drawScore(gameState.scores);
		this._drawCenterLine();
	}

	_drawPaddle(paddle) {
		this._context.fillRect(
			paddle.x,
			paddle.y,
			paddle.width,
			paddle.height
		);
	}

	_drawBall(ball) {
		this._context.fillRect(
			ball.x,
			ball.y,
			ball.width,
			ball.height
		);
	}

	_drawScore(scores) {
		this._context.font = '40px PongScore';
		this._context.textAlign = 'center';

		// Left score
		this._context.fillText(
			scores.left,
			this._canvas.width / 4,
			50
		);

		// Right score
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
		// Clear the canvas on destroy
		this._context.clearRect(0, 0, this._canvas.width, this._canvas.height);
		this._context = null;
	}
}
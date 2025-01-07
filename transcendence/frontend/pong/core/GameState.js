import { GameRules } from './GameRules';

export class GameState {
	constructor() {
		this._state = {
			leftPaddle: {
				x: GameRules.LEFT_PADDLE_X,
				y: GameRules.CANVAS_HEIGHT / 2,
				width: GameRules.PADDLE_WIDTH,
				height: GameRules.PADDLE_HEIGHT,
				dy: 0
			},
			rightPaddle: {
				x: GameRules.CANVAS_WIDTH - GameRules.LEFT_PADDLE_X - GameRules.PADDLE_WIDTH,
				y: GameRules.CANVAS_HEIGHT / 2,
				width: GameRules.PADDLE_WIDTH,
				height: GameRules.PADDLE_HEIGHT,
				dy: 0
			},
			ball: {
				x: GameRules.CANVAS_WIDTH / 2,
				y: GameRules.CANVAS_HEIGHT / 2,
				width: 5,
				height: 5,
				dx: 0,
				dy: 0,
				resetting: false
			},
			scores: {
				left: 0,
				right: 0
			},
			gameStatus: 'waiting', // waiting, playing, paused, finished
			lastUpdateTime: Date.now()
		};
		this._observers = new Set();
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
		const ballState = {
			ball: {
				...this._state.ball,
				x: 429,
				y: 262,
				dx: 2,
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

		// Check for game end
		if (scores[side] >= 11) {
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

		const gameRules = new GameRules(this);

		// Handle ball movement and collisions
		const ballUpdate = gameRules.handleBallCollisions(deltaTime);
		if (ballUpdate) {
			if (ballUpdate.type === 'goal') {
				this.updateScore(ballUpdate.scoringSide);
				if (this._state.gameStatus === 'playing') {
					this.updateState({ ball: ballUpdate.ball });
					// Schedule ball relaunch
					setTimeout(() => {
						if (this._state.gameStatus === 'playing') {
							const velocity = gameRules.getInitialBallVelocity();
							this.updateState({
								ball: { ...this._state.ball, ...velocity, resetting: false }
							});
						}
					}, 1000);
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
			if (gameRules.handlePaddleCollisions(ball, paddleUpdates.leftPaddle, true) ||
				gameRules.handlePaddleCollisions(ball, paddleUpdates.rightPaddle, false)) {
				this.updateState({ ball });
			}
		}

		// Update state
		this.updateState({
			...paddleUpdates,
			lastUpdateTime: now
		});
	}

	_updatePaddles(deltaTime) {
		const leftPaddle = { ...this._state.leftPaddle };
		const rightPaddle = { ...this._state.rightPaddle };

		leftPaddle.y += leftPaddle.dy * deltaTime * GameRules.PADDLE_SPEED;
		rightPaddle.y += rightPaddle.dy * deltaTime * GameRules.PADDLE_SPEED;

		// Clamp paddles to screen bounds
		leftPaddle.y = Math.max(0, Math.min(GameRules.CANVAS_HEIGHT - leftPaddle.height, leftPaddle.y));
		rightPaddle.y = Math.max(0, Math.min(GameRules.CANVAS_HEIGHT - rightPaddle.height, rightPaddle.y));

		return { leftPaddle, rightPaddle };
	}
} 
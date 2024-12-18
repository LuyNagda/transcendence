import logger from '../../utils/logger';

export class GameEngine {
	constructor() {
		this._gameState = null;
		this._gameLoop = null;
		this._components = new Map();
		this._isRunning = false;
		this._isDestroying = false;
	}

	registerComponent(name, component) {
		this._components.set(name, component);
	}

	getComponent(name) {
		return this._components.get(name);
	}

	start() {
		if (this._isRunning) return;
		this._isRunning = true;
		this._components.get('aiHandler').initialize();
		this._gameLoop = requestAnimationFrame(this._update.bind(this));
	}

	stop() {
		if (!this._isRunning) return;
		this._isRunning = false;
		if (this._gameLoop) {
			cancelAnimationFrame(this._gameLoop);
			this._gameLoop = null;
		}
	}

	_update() {
		if (!this._isRunning) return;

		// Get game state component
		const gameState = this._components.get('state');
		if (gameState && gameState.update) {
			gameState.update();
		}

		// Update all other components
		for (const component of this._components.values()) {
			if (component !== gameState && component.update) {
				component.update();
			}
		}

		// Launch ball if needed
		if (this._components.get('controller')) {
			this._components.get('controller').launchBall();
		}

		// Update AI
		if (this._components.get('aiHandler'))
			this._components.get('aiHandler').update();

		// Update renderer
		const renderer = this._components.get('renderer');
		if (renderer) {
			renderer.render(gameState.getState());
		}

		// Schedule next frame
		this._gameLoop = requestAnimationFrame(this._update.bind(this));
	}

	destroy() {
		this.stop();
		if (this._isDestroying) return;
		this._isDestroying = true;

		for (const [name, component] of this._components.entries()) {
			if (component && component.destroy && name !== 'controller') {
				component.destroy();
			}
		}
		this._components.clear();
		this._isDestroying = false;
	}
} 
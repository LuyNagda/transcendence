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

	unregisterComponent(name) {
		if (this._components.has(name)) {
			this._components.delete(name);
			return true;
		}
		return false;
	}

	getComponent(name) {
		return this._components.get(name);
	}

	start() {
		if (this._isRunning) return;
		this._isRunning = true;
		const aiHandler = this._components.get('aiHandler');
		if (aiHandler) {
			aiHandler.initialize();
		}
		this._gameLoop = requestAnimationFrame(this._update.bind(this));
	}

	stop() {
		if (this._animationFrameId) {
			cancelAnimationFrame(this._animationFrameId);
			this._animationFrameId = null;
		}
		this._isRunning = false;
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

		// Launch ball if needed and if we have a controller
		const controller = this._components.get('controller');
		if (controller && controller.launchBall && typeof controller.launchBall === 'function') {
			controller.launchBall();
		}

		// Update AI
		if (this._components.get('aiHandler'))
			this._components.get('aiHandler').update();

		// Update renderer with current state
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

	update() {
		const state = this._components.get('state');
		if (!state) return;

		const currentState = state.getState();
		if (currentState.gameStatus === 'finished') {
			this.stop();
			return;
		}

		// Update all components
		for (const [name, component] of this._components.entries()) {
			if (component && component.update && name !== 'controller') {
				component.update();
			}
		}
	}
} 
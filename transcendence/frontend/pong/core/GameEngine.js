import logger from '../../logger';

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
		logger.debug(`[Game Engine] Component registered: ${name}`);
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

		logger.info('[Game Engine] Initializing game engine components...');
		for (const [name, component] of this._components.entries()) {
			if (component && component.initialize) {
				logger.debug(`[Game Engine] Initializing component: ${name}`);
				component.initialize();
			}
		}

		logger.info('[Game Engine] Starting game loop');
		this._gameLoop = requestAnimationFrame(this._update.bind(this));
	}

	stop() {
		logger.info('[Game Engine] Stopping game engine');
		if (this._animationFrameId) {
			cancelAnimationFrame(this._animationFrameId);
			this._animationFrameId = null;
		}
		this._isRunning = false;
	}

	_update() {
		if (!this._isRunning) {
			logger.debug('[Game Engine] Game engine not running, skipping update');
			return;
		}

		// Get game state component
		const gameState = this._components.get('state');
		if (!gameState) {
			logger.warn('[Game Engine] No game state component found, stopping engine');
			this.stop();
			return;
		}

		// Check game status first
		const currentState = gameState.getState();
		if (currentState.gameStatus === 'finished') {
			logger.info('[Game Engine] Game finished, stopping engine');
			this.stop();
			return;
		}

		// Update game state
		if (gameState.update) {
			gameState.update();
		}

		// Update AI first if it exists
		const aiHandler = this._components.get('aiHandler');
		if (aiHandler && aiHandler.update) {
			logger.debug('[Game Engine] Updating AI handler');
			aiHandler.update();
		}

		// Update all other components except AI and state
		for (const [name, component] of this._components.entries()) {
			if (component !== gameState && component !== aiHandler && component.update) {
				component.update();
			}
		}

		// Launch ball if needed and if we have a controller
		const controller = this._components.get('controller');
		if (controller && controller.launchBall && typeof controller.launchBall === 'function') {
			controller.launchBall();
		}

		// Update renderer with current state
		const renderer = this._components.get('renderer');
		if (renderer)
			renderer.render(currentState);

		// Schedule next frame only if still running
		if (this._isRunning && currentState.gameStatus !== 'finished')
			this._animationFrameId = requestAnimationFrame(this._update.bind(this));
	}

	destroy() {
		logger.info('[Game Engine] Destroying game engine');
		this.stop();
		if (this._isDestroying) return;
		this._isDestroying = true;

		// Destroy all components in reverse order
		const componentNames = Array.from(this._components.keys()).reverse();
		for (const name of componentNames) {
			const component = this._components.get(name);
			if (component && component.destroy && name !== 'controller') {
				logger.info(`[Game Engine] Destroying component: ${name}`);
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
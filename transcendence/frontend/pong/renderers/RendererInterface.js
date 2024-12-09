export class RendererInterface {
	constructor(canvas) {
		if (new.target === RendererInterface) {
			throw new TypeError("Cannot construct RendererInterface instances directly");
		}
		this._canvas = canvas;
	}

	// Required methods that must be implemented by concrete renderers
	initialize() {
		throw new Error("Method 'initialize()' must be implemented");
	}

	render(gameState) {
		throw new Error("Method 'render()' must be implemented");
	}

	resize(width, height) {
		throw new Error("Method 'resize()' must be implemented");
	}

	destroy() {
		throw new Error("Method 'destroy()' must be implemented");
	}

	// Optional methods that can be overridden
	onStateChange(newState, oldState) {
		this.render(newState);
	}

	getCanvas() {
		return this._canvas;
	}
} 
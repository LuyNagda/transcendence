import logger from '../../logger.js';

export class WebGLDetector {
	static _isWebGLSupportCached = null;

	/**
	 * Detect if WebGL is supported in the current browser
	 * @returns {boolean} - Whether WebGL is supported
	 */
	static isWebGLSupported() {
		if (this._isWebGLSupportCached !== null)
			return this._isWebGLSupportCached;

		try {
			if (!window.WebGLRenderingContext) {
				logger.warn('WebGL not supported: WebGLRenderingContext is not available');
				this._isWebGLSupportCached = false;
				return false;
			}

			const canvas = document.createElement('canvas');

			const contextConfigs = [
				{ type: 'webgl2', options: { failIfMajorPerformanceCaveat: false } },
				{ type: 'webgl2' },
				{ type: 'webgl', options: { failIfMajorPerformanceCaveat: false } },
				{ type: 'webgl' }
			];

			for (const config of contextConfigs) {
				try {
					const gl = canvas.getContext(config.type, config.options);
					if (gl) {
						logger.info(`WebGL support detected: ${config.type}`);
						this._isWebGLSupportCached = true;
						return true;
					}
				} catch (e) {
					logger.debug(`Failed to get ${config.type} context:`, e);
				}
			}

			logger.warn('WebGL not supported: Failed to get any WebGL context');
			this._isWebGLSupportCached = false;
			return false;
		} catch (error) {
			logger.error('Error during WebGL support detection:', error);
			this._isWebGLSupportCached = false;
			return false;
		}
	}

	/**
	 * Check if REGL can be initialized
	 * @returns {boolean} - Whether REGL is supported
	 */
	static isREGLSupported() {
		if (!this.isWebGLSupported()) {
			return false;
		}

		try {
			const regl = require('regl');
			const canvas = document.createElement('canvas');
			const gl = canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false });

			if (!gl) {
				return false;
			}

			const testRegl = regl({ gl });

			testRegl.destroy();

			return true;
		} catch (error) {
			logger.warn('REGL not supported:', error);
			return false;
		}
	}

	/**
	 * Force refresh the cached WebGL support status
	 */
	static refreshSupport() {
		this._isWebGLSupportCached = null;
		return this.isWebGLSupported();
	}
} 
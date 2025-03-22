import logger from '../../logger.js';
import { RendererInterface } from './RendererInterface';
import { vec3 } from 'gl-matrix';

export class WebGLRenderer extends RendererInterface {
	constructor(canvas, contextHandlers = {}) {
		super(canvas);
		this._regl = null;
		this._quadCommand = null;
		this._spriteTexture = null;
		this._bufferCanvas = null;
		this._bufferContext = null;
		this._contextHandlers = contextHandlers;

		// Constants for WebGL rendering
		this._charW = 6;
		this._charH = 10;
		this._bufferCW = 858;
		this._bufferCH = 525;
		this._bufferW = this._bufferCW;
		this._bufferH = this._bufferCH;
		this._textureW = this._bufferW;
		this._textureH = this._bufferH;
		this._consolePad = 8;
		this._consoleW = this._bufferW + this._consolePad * 2;
		this._consoleH = this._bufferH + this._consolePad * 2;
	}

	initialize() {
		// Check for WebGL support
		if (!window.WebGLRenderingContext) {
			logger.error('WebGL is not supported in this browser');
			return false;
		}

		this._handleContextLost = (event) => {
			event.preventDefault();
			if (this._contextHandlers.onContextLost)
				this._contextHandlers.onContextLost(event);
			logger.warn('WebGL context lost');
		};

		this._handleContextRestored = (event) => {
			if (this._contextHandlers.onContextRestored)
				this._contextHandlers.onContextRestored(event);
			logger.info('WebGL context restored - reinitializing renderer');
			this._setupBufferCanvas();
			try {
				this._setupREGL();
				this._createSpriteTexture();
				this._createQuadCommand();
				this._startWebGLLoop();
			} catch (error) {
				logger.error('Failed to reinitialize WebGL after context restored:', error);
			}
		};

		this._canvas.addEventListener('webglcontextlost', this._handleContextLost);
		this._canvas.addEventListener('webglcontextrestored', this._handleContextRestored);

		try {
			const contextOptions = [
				{ contextType: 'webgl2', options: { failIfMajorPerformanceCaveat: false } },
				{ contextType: 'webgl', options: { failIfMajorPerformanceCaveat: false } },
			];

			let gl = null;
			for (const { contextType, options } of contextOptions) {
				try {
					gl = this._canvas.getContext(contextType, options);
					if (gl) {
						logger.info(`Created ${contextType} context successfully`);
						break;
					}
				} catch (e) {
					logger.warn(`Failed to get ${contextType} context:`, e);
				}
			}

			if (!gl) {
				logger.error('Could not create a WebGL context, rendering impossible');
				return false;
			}

			this._setupBufferCanvas();

			try {
				this._setupREGL();
			} catch (reglError) {
				logger.error('REGL initialization failed:', reglError);
				return false;
			}

			this._createSpriteTexture();
			this._createQuadCommand();
			this._startWebGLLoop();

			logger.info('WebGL renderer initialized successfully');
			return true;
		} catch (error) {
			logger.error('WebGL initialization failed:', error);
			return false;
		}
	}

	_setupBufferCanvas() {
		this._bufferCanvas = document.createElement('canvas');
		this._bufferCanvas.width = this._bufferW;
		this._bufferCanvas.height = this._bufferH;
		this._bufferContext = this._bufferCanvas.getContext('2d');

		// Initial clear
		this._bufferContext.fillStyle = '#000';
		this._bufferContext.fillRect(0, 0, this._bufferW, this._bufferH);
	}

	_setupREGL() {
		try {
			const regl = require('regl');

			const gl = this._canvas.getContext('webgl2', {
				antialias: true,
				alpha: false,
				failIfMajorPerformanceCaveat: false
			});

			if (!gl)
				throw new Error('Could not get WebGL context for REGL');

			try {
				this._regl = regl({
					gl: gl,
					optionalExtensions: ['oes_texture_float', 'oes_texture_half_float', 'webgl_color_buffer_float']
				});
				logger.info('REGL initialized successfully');
			} catch (reglError) {
				logger.error('REGL creation error:', reglError);
				throw reglError;
			}
		} catch (error) {
			logger.error('Failed to initialize REGL:', error);
			throw error;
		}
	}

	_createSpriteTexture() {
		this._spriteTexture = this._regl.texture({
			width: this._textureW,
			height: this._textureH,
			mag: 'linear'
		});
	}

	_createQuadCommand() {
		this._quadCommand = this._regl({
			vert: `
				precision mediump float;
				attribute vec3 position;
				varying vec2 uvPosition;
				void main() {
					uvPosition = position.xy * vec2(0.5, -0.5) + vec2(0.5);
					gl_Position = vec4(
						vec2(-1.0, 1.0) + (position.xy - vec2(-1.0, 1.0)) * 1.0,
						0.0,
						1.0
					);
				}
			`,
			frag: `
				precision mediump float;
				varying vec2 uvPosition;
				uniform sampler2D sprite;
				uniform float time;
				uniform vec3 bgColor;
				uniform vec3 fgColor;

				#define textureW ${this._textureW}.0
				#define textureH ${this._textureH}.0
				#define consoleW ${this._consoleW}.0
				#define consoleH ${this._consoleH}.0
				#define consolePadUVW ${this._consolePad / this._consoleW}
				#define consolePadUVH ${this._consolePad / this._consoleH}
				#define charUVW ${this._charW / this._consoleW}
				#define charUVH ${this._charH / this._consoleH}

				void main() {
					vec2 consoleWH = vec2(consoleW, consoleH);

					float glitchLine = mod(0.8 + time * 0.07, 1.0);
					float glitchFlutter = mod(time * 40.0, 1.0);
					float glitchAmount = 0.005 + glitchFlutter * 0.002;
					float glitchDistance = 0.01 + glitchFlutter * 0.05;

					vec2 center = uvPosition - vec2(0.5);
					float factor = dot(center, center) * 0.2;
					vec2 distortedUVPosition = uvPosition + center * (1.0 - factor) * factor;

					vec2 fromEdge = vec2(0.5, 0.5) - abs(distortedUVPosition - vec2(0.5, 0.5));

					if (fromEdge.x > 0.0 && fromEdge.y > 0.0) {
						vec2 fromEdgePixel = min(0.2 * consoleWH * fromEdge, vec2(1.0, 1.0));

						vec2 inTexel = mod(distortedUVPosition * consoleWH * 0.5, vec2(1.0));

						float distToGlitch = glitchLine - (distortedUVPosition.y - inTexel.y / consoleH);
						float glitchOffsetLinear = step(0.0, distToGlitch) * max(0.0, glitchDistance - distToGlitch) / glitchDistance;
						float glitchOffset = glitchOffsetLinear * glitchOffsetLinear;

						vec2 inTexelOffset = inTexel - 0.5;
						float scanlineAmount = inTexelOffset.y * inTexelOffset.y / 0.25;
						float intensity = 8.0 - scanlineAmount * 5.0 + glitchOffset * 2.0;
						vec2 uvAdjustment = inTexelOffset * vec2(0.0, .5 / consoleH);

						distortedUVPosition.x -= glitchOffset * glitchAmount + 0.005 * (glitchFlutter * glitchFlutter * glitchFlutter);

						vec4 sourcePixel = texture2D(
							sprite,
							(distortedUVPosition - uvAdjustment) * consoleWH / vec2(textureW, textureH)
						);

						vec3 pixelRGB = sourcePixel.rgb * sourcePixel.a;

						// Convert to grayscale
						float gray = dot(pixelRGB, vec3(0.299, 0.587, 0.114));

						float screenFade = 1.0 - dot(center, center) * 1.8;
						float edgeFade = fromEdgePixel.x * fromEdgePixel.y;
						gl_FragColor = vec4(edgeFade * screenFade * mix(
							bgColor,
							vec3(gray),
							intensity * gray + glitchOffset * 1.5
						) * (1.0 - 0.2 * scanlineAmount), 1.0);
					} else {
						gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
					}
				}
			`,
			attributes: {
				position: [
					[-1, -1, 0],
					[1, -1, 0],
					[-1, 1, 0],
					[1, 1, 0]
				]
			},
			uniforms: {
				time: this._regl.context('time'),
				sprite: this._spriteTexture,
				bgColor: this._hex2vector('#000'),
				fgColor: this._hex2vector('#fff')
			},
			primitive: 'triangle strip',
			count: 4,
			depth: { enable: false },
			blend: {
				enable: true,
				func: {
					src: 'src alpha',
					dst: 'one minus src alpha'
				}
			}
		});

		this._regl.clear({
			depth: 1,
			color: [0, 0, 0, 1]
		});
	}

	_hex2vector(hex) {
		const bigint = parseInt(hex.slice(1), 16);
		const r = (bigint >> 16) & 255;
		const g = (bigint >> 8) & 255;
		const b = bigint & 255;
		return vec3.fromValues(r / 255, g / 255, b / 255);
	}

	_startWebGLLoop() {
		let currentTime = performance.now();

		const rafBody = () => {
			const newTime = performance.now();
			currentTime = newTime;

			if (!this._regl) return;

			this._regl.poll();
			this._spriteTexture.subimage(this._bufferContext, 0, 0);
			this._quadCommand({
				bgColor: this._hex2vector('#000'),
				fgColor: this._hex2vector('#fff')
			});

			requestAnimationFrame(rafBody);
		};

		rafBody();
	}

	render(gameState, gameMetadata, deltaTime) {
		// Clear buffer
		this._bufferContext.fillStyle = '#000';
		this._bufferContext.fillRect(0, 0, this._bufferW, this._bufferH);

		if (!gameState) return;

		// Calculate scale factors
		const scaleX = this._bufferW / 858;
		const scaleY = this._bufferH / 525;

		// Set drawing style
		this._bufferContext.fillStyle = '#fff';
		this._bufferContext.globalAlpha = 1.0;

		// Draw center line with scanline effect
		for (let i = 0; i < this._bufferH; i += 10) {
			const opacity = (i % 2) ? 0.6 : 1.0;
			this._bufferContext.globalAlpha = opacity;
			this._bufferContext.fillRect(
				(this._bufferW / 2) - 1,
				i,
				2,
				5
			);
		}

		// Draw game elements with bloom effect
		this._bufferContext.globalAlpha = 1.0;
		this._bufferContext.shadowColor = '#fff';
		this._bufferContext.shadowBlur = 5;

		// Draw paddles with glow
		this._drawWithBloom(() => {
			// Left paddle
			if (gameState.leftPaddle &&
				typeof gameState.leftPaddle.x === 'number' &&
				typeof gameState.leftPaddle.y === 'number' &&
				typeof gameState.leftPaddle.width === 'number' &&
				typeof gameState.leftPaddle.height === 'number') {
				this._bufferContext.fillRect(
					(gameState.leftPaddle.x - (gameState.leftPaddle.width / 2)) * scaleX,
					(gameState.leftPaddle.y - (gameState.leftPaddle.height / 2)) * scaleY,
					gameState.leftPaddle.width * scaleX,
					gameState.leftPaddle.height * scaleY
				);
			} else if (gameState.leftPaddle) {
				logger.warn('Left paddle has invalid properties');
			}

			// Right paddle
			if (gameState.rightPaddle &&
				typeof gameState.rightPaddle.x === 'number' &&
				typeof gameState.rightPaddle.y === 'number' &&
				typeof gameState.rightPaddle.width === 'number' &&
				typeof gameState.rightPaddle.height === 'number') {
				this._bufferContext.fillRect(
					(gameState.rightPaddle.x - (gameState.rightPaddle.width / 2)) * scaleX,
					(gameState.rightPaddle.y - (gameState.rightPaddle.height / 2)) * scaleY,
					gameState.rightPaddle.width * scaleX,
					gameState.rightPaddle.height * scaleY
				);
			} else if (gameState.rightPaddle) {
				logger.warn('Right paddle has invalid properties');
			}
		});

		// Draw ball with stronger glow
		this._bufferContext.shadowBlur = 8;
		this._drawWithBloom(() => {
			if (!gameState.ball) {
				logger.warn('Cannot draw ball: ball object is null or undefined');
				return;
			}

			// Validate ball properties
			if (typeof gameState.ball.x !== 'number' || typeof gameState.ball.y !== 'number' || typeof gameState.ball.radius !== 'number') {
				logger.warn('Ball has invalid properties:', {
					x: gameState.ball.x,
					y: gameState.ball.y,
					radius: gameState.ball.radius,
					type_x: typeof gameState.ball.x,
					type_y: typeof gameState.ball.y,
					type_radius: typeof gameState.ball.radius
				});
				// Use default values if properties are invalid
				const x = typeof gameState.ball.x === 'number' ? gameState.ball.x : this._bufferW / (2 * scaleX);
				const y = typeof gameState.ball.y === 'number' ? gameState.ball.y : this._bufferH / (2 * scaleY);
				const radius = typeof gameState.ball.radius === 'number' ? gameState.ball.radius : 5;

				// Draw with default values
				this._bufferContext.beginPath();
				this._bufferContext.arc(
					x * scaleX,
					y * scaleY,
					radius * Math.min(scaleX, scaleY),
					0,
					Math.PI * 2
				);
				this._bufferContext.fill();
				return;
			}

			// Draw ball as circle
			this._bufferContext.beginPath();
			this._bufferContext.arc(
				gameState.ball.x * scaleX,
				gameState.ball.y * scaleY,
				gameState.ball.radius * Math.min(scaleX, scaleY),
				0,
				Math.PI * 2
			);
			this._bufferContext.fill();
		});

		// Reset context properties
		this._bufferContext.shadowBlur = 0;
		this._bufferContext.globalAlpha = 1.0;

		// Draw scores
		this._bufferContext.font = '40px PongScore';
		this._bufferContext.textAlign = 'center';

		this._drawWithBloom(() => {
			const scores = (gameMetadata && gameMetadata.scores) || gameState.scores;
			if (scores && typeof scores.left !== 'undefined' && typeof scores.right !== 'undefined') {
				this._bufferContext.fillText(
					scores.left,
					this._bufferW / 4,
					50
				);

				this._bufferContext.fillText(
					scores.right,
					(3 * this._bufferW) / 4,
					50
				);
			} else {
				logger.debug('Scores not available for rendering');
			}
		});

		// Update WebGL texture
		this._spriteTexture.subimage(this._bufferCanvas);
	}

	_drawWithBloom(drawFn) {
		// Draw the shape multiple times with slight offsets for bloom effect
		const offsets = [
			[0, 0],
			[-1, 0], [1, 0], [0, -1], [0, 1]
		];

		this._bufferContext.globalAlpha = 0.3;
		offsets.forEach(([x, y]) => {
			this._bufferContext.save();
			this._bufferContext.translate(x, y);
			drawFn();
			this._bufferContext.restore();
		});

		// Draw the main shape
		this._bufferContext.globalAlpha = 1.0;
		drawFn();
	}

	resize(width, height) {
		this._canvas.width = width;
		this._canvas.height = height;
		this._bufferCanvas.width = width;
		this._bufferCanvas.height = height;
	}

	destroy() {
		if (this._regl) {
			this._regl.destroy();
			this._regl = null;
		}

		if (this._canvas) {
			this._canvas.removeEventListener('webglcontextlost', this._handleContextLost);
			this._canvas.removeEventListener('webglcontextrestored', this._handleContextRestored);
		}

		this._quadCommand = null;
		this._spriteTexture = null;
		this._bufferCanvas = null;
		this._bufferContext = null;
	}
} 
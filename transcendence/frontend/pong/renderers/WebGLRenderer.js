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
		// Bind context handlers with proper fallbacks
		const handleContextLost = (event) => {
			event.preventDefault();
			if (this._contextHandlers.onContextLost) {
				this._contextHandlers.onContextLost(event);
			}
		};

		const handleContextRestored = (event) => {
			if (this._contextHandlers.onContextRestored) {
				this._contextHandlers.onContextRestored(event);
			}
		};

		this._canvas.addEventListener('webglcontextlost', handleContextLost);
		this._canvas.addEventListener('webglcontextrestored', handleContextRestored);

		try {
			this._setupBufferCanvas();
			this._setupREGL();
			this._createSpriteTexture();
			this._createQuadCommand();
			this._startWebGLLoop();
			return true;
		} catch (error) {
			console.error('WebGL initialization failed:', error);
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
		const regl = require('regl');
		this._regl = regl({
			canvas: this._canvas,
			attributes: {
				antialias: true,
				alpha: false,
				preserveDrawingBuffer: true
			}
		});
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

	render(gameState) {
		// Clear buffer
		this._bufferContext.fillStyle = '#000';
		this._bufferContext.fillRect(0, 0, this._bufferW, this._bufferH);

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
			this._bufferContext.fillRect(
				gameState.leftPaddle.x * scaleX,
				gameState.leftPaddle.y * scaleY,
				gameState.leftPaddle.width * scaleX,
				gameState.leftPaddle.height * scaleY
			);

			// Right paddle
			this._bufferContext.fillRect(
				gameState.rightPaddle.x * scaleX,
				gameState.rightPaddle.y * scaleY,
				gameState.rightPaddle.width * scaleX,
				gameState.rightPaddle.height * scaleY
			);
		});

		// Draw ball with stronger glow
		this._bufferContext.shadowBlur = 8;
		this._drawWithBloom(() => {
			this._bufferContext.fillRect(
				gameState.ball.x * scaleX,
				gameState.ball.y * scaleY,
				gameState.ball.width * scaleX,
				gameState.ball.height * scaleY
			);
		});

		// Reset context properties
		this._bufferContext.shadowBlur = 0;
		this._bufferContext.globalAlpha = 1.0;

		// Draw scores
		this._bufferContext.font = '40px PongScore';
		this._bufferContext.textAlign = 'center';

		this._drawWithBloom(() => {
			this._bufferContext.fillText(
				gameState.scores.left,
				this._bufferW / 4,
				50
			);

			this._bufferContext.fillText(
				gameState.scores.right,
				(3 * this._bufferW) / 4,
				50
			);
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
		this._quadCommand = null;
		this._spriteTexture = null;
		this._bufferCanvas = null;
		this._bufferContext = null;
	}
} 
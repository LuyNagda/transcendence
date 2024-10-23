let regl, quadCommand, spriteTexture;
let bufferCanvas, bufferContext;

const charW = 6;
const charH = 10;
const bufferCW = 80;
const bufferCH = 24;
const bufferW = bufferCW * charW;
const bufferH = bufferCH * charH;
const textureW = 512;
const textureH = 256;

const consolePad = 8; // in texels
const consoleW = bufferW + consolePad * 2;
const consoleH = bufferH + consolePad * 2;

function hex2vector(hex) {
	const bigint = parseInt(hex.slice(1), 16);
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;
	return vec3.fromValues(r / 255, g / 255, b / 255);
}

function initializeWebGL() {
	setupCanvas();
	setupREGL();
	createSpriteTexture();
	createQuadCommand();
	startWebGLLoop();
}

function setupCanvas() {
	bufferCanvas = document.createElement("canvas");
	bufferCanvas.width = bufferW;
	bufferCanvas.height = bufferH;
	bufferContext = bufferCanvas.getContext("2d");

	bufferContext.fillStyle = "#000";
	bufferContext.fillRect(0, 0, bufferW, bufferH);
}

function setupREGL() {
	regl = createREGL({
		canvas: document.getElementById("game"),
		attributes: {
			antialias: true,
			alpha: false,
			preserveDrawingBuffer: true,
		},
	});
}

function createSpriteTexture() {
	spriteTexture = regl.texture({
		width: textureW,
		height: textureH,
		mag: "linear",
	});
}

function createQuadCommand() {
	const termFgColor = hex2vector("#fff"); // White foreground
	const termBgColor = hex2vector("#000"); // Black background

	quadCommand = regl({
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

            #define textureW ${textureW}.0
            #define textureH ${textureH}.0
            #define consoleW ${consoleW}.0
            #define consoleH ${consoleH}.0
            #define consolePadUVW ${consolePad / consoleW}
            #define consolePadUVH ${consolePad / consoleH}
            #define charUVW ${charW / consoleW}
            #define charUVH ${charH / consoleH}

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
                    ) * (1.0 - 0.2 * scanlineAmount), 0.2);
                } else {
                    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                }
            }
        `,

		attributes: {
			position: regl.buffer([
				[-1, -1, 0],
				[1, -1, 0],
				[-1, 1, 0],
				[1, 1, 0],
			]),
		},

		uniforms: {
			time: regl.context("time"),
			camera: regl.prop("camera"),
			sprite: spriteTexture,
			bgColor: regl.prop("bgColor"),
			fgColor: regl.prop("fgColor"),
		},

		primitive: "triangle strip",
		count: 4,

		depth: {
			enable: false,
		},

		blend: {
			enable: true,
			func: {
				src: "src alpha",
				dst: "one minus src alpha",
			},
		},
	});

	regl.clear({
		depth: 1,
		color: [0, 0, 0, 1],
	});
}

function startWebGLLoop() {
	// let currentTime = performance.now();

	function rafBody() {
		const newTime = performance.now();
		// const delta = Math.min(0.05, (newTime - currentTime) / 1000);
		currentTime = newTime;

		regl.poll();
		spriteTexture.subimage(bufferContext, consolePad, consolePad);
		quadCommand({
			bgColor: hex2vector("#000"),
			fgColor: hex2vector("#fff"),
		});

		requestAnimationFrame(rafBody);
	}

	rafBody();
}

function updateWebGLTexture(canvas) {
	spriteTexture.subimage(canvas, consolePad, consolePad);
}

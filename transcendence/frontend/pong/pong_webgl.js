import { vec3 } from 'gl-matrix';

export default class WebGLConsole {
    constructor() {
        this.regl = null;
        this.quadCommand = null;
        this.spriteTexture = null;
        this.bufferCanvas = null;
        this.bufferContext = null;

        this.charW = 6;
        this.charH = 10;
        this.bufferCW = 80;
        this.bufferCH = 24;
        this.bufferW = this.bufferCW * this.charW;
        this.bufferH = this.bufferCH * this.charH;
        this.textureW = 512;
        this.textureH = 256;

        this.consolePad = 8; // in texels
        this.consoleW = this.bufferW + this.consolePad * 2;
        this.consoleH = this.bufferH + this.consolePad * 2;
    }

    hex2vector(hex) {
        const bigint = parseInt(hex.slice(1), 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return vec3.fromValues(r / 255, g / 255, b / 255);
    }

    initializeWebGL() {
        this.setupCanvas();
        this.setupREGL();
        this.createSpriteTexture();
        this.createQuadCommand();
        this.startWebGLLoop();
    }

    setupCanvas() {
        this.bufferCanvas = document.createElement("canvas");
        this.bufferCanvas.width = this.bufferW;
        this.bufferCanvas.height = this.bufferH;
        this.bufferContext = this.bufferCanvas.getContext("2d");

        this.bufferContext.fillStyle = "#000";
        this.bufferContext.fillRect(0, 0, this.bufferW, this.bufferH);
    }

    setupREGL() {
        this.regl = require('regl')({
            canvas: document.getElementById("game"),
            attributes: {
                antialias: true,
                alpha: false,
                preserveDrawingBuffer: true,
            },
        });
    }

    createSpriteTexture() {
        this.spriteTexture = this.regl.texture({
            width: this.textureW,
            height: this.textureH,
            mag: "linear",
        });
    }

    createQuadCommand() {
        const termFgColor = this.hex2vector("#fff"); // White foreground
        const termBgColor = this.hex2vector("#000"); // Black background

        this.quadCommand = this.regl({
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

                #define textureW ${this.textureW}.0
                #define textureH ${this.textureH}.0
                #define consoleW ${this.consoleW}.0
                #define consoleH ${this.consoleH}.0
                #define consolePadUVW ${this.consolePad / this.consoleW}
                #define consolePadUVH ${this.consolePad / this.consoleH}
                #define charUVW ${this.charW / this.consoleW}
                #define charUVH ${this.charH / this.consoleH}

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
                position: this.regl.buffer([
                    [-1, -1, 0],
                    [1, -1, 0],
                    [-1, 1, 0],
                    [1, 1, 0],
                ]),
            },

            uniforms: {
                time: this.regl.context("time"),
                camera: this.regl.prop("camera"),
                sprite: this.spriteTexture,
                bgColor: this.regl.prop("bgColor"),
                fgColor: this.regl.prop("fgColor"),
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

        this.regl.clear({
            depth: 1,
            color: [0, 0, 0, 1],
        });
    }

    startWebGLLoop() {
        let currentTime = performance.now();

        const rafBody = () => {
            const newTime = performance.now();
            currentTime = newTime;

            this.regl.poll();
            this.spriteTexture.subimage(this.bufferContext, this.consolePad, this.consolePad);
            this.quadCommand({
                bgColor: this.hex2vector("#000"),
                fgColor: this.hex2vector("#fff"),
            });

            requestAnimationFrame(rafBody);
        };

        rafBody();
    }

    updateWebGLTexture(canvas) {
        this.spriteTexture.subimage(canvas, this.consolePad, this.consolePad);
    }
}

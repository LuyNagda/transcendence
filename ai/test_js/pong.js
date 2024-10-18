import { Neuron_Network } from '../ai.js';

const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Game settings
const WIDTH = 800;
const HEIGHT = 600;

// Paddle settings
const PADDLE_WIDTH = 15;
const PADDLE_HEIGHT = 90;
const PADDLE_SPEED = 6;

// Ball settings
const BALL_SIZE = 15;
const BALL_SPEED_X = 7;
const BALL_SPEED_Y = 7;

// Game objects
const ball = {
    x: WIDTH / 2,
    y: HEIGHT / 2,
    width: BALL_SIZE,
    height: BALL_SIZE,
    dx: BALL_SPEED_X,
    dy: BALL_SPEED_Y
};

const ai_ball = ball;

// Function to reset the ball with random direction
function resetBall() {
    ball.x = WIDTH / 2;
    ball.y = HEIGHT / 2;
    
    // Randomly choose left or right direction
    const direction1 = Math.random() < 0.5 ? -1 : 1;
    const direction2 = Math.random() < 0.5 ? -1 : 1;
    
    ball.dx = direction1 * ball.dx;
    ball.dy = direction2 * ball.dy;
    
    // Update ai_ball
    Object.assign(ai_ball, ball);
}

// AI setting
let ai_loaded;

try {
    const setupJson = JSON.stringify({
        "layer1": {
            "weights": [
                [-0.8730789607358392, 0.5824308739012745, 1.4386435945576093],
                [-0.2239885923499962, 0.3315438954533523, 1.3607337003901363],
                [-0.5934591295652615, -1.9951332952168253, 0.2504200628910535],
                [-1.1532241863386201, 0.22437054627430497, 0.8832272910500715],
                [0.8191879100269014, 0.23702494495879028, 0.7798145696425061]
            ]
        }
    });

    ai_loaded = new Neuron_Network(setupJson);
} catch (error) {
    console.error("Error in Neuron_Network initialization:", error);
    ai_loaded = null;
}

const leftPaddle = {
    x: 0,
    y: HEIGHT / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    dy: PADDLE_SPEED
};

const rightPaddle = {
    x: WIDTH - PADDLE_WIDTH,
    y: HEIGHT / 2 - PADDLE_HEIGHT / 2,
    width: PADDLE_WIDTH,
    height: PADDLE_HEIGHT,
    dy: PADDLE_SPEED
};

// Key states
const keys = {
    w: false,
    s: false,
};

// Event listeners for key presses
document.addEventListener('keydown', (e) => {
    if (e.key in keys) {
        keys[e.key] = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key in keys) {
        keys[e.key] = false;
    }
});

function movePaddles() {
    if (keys.w && leftPaddle.y > 0) {
        leftPaddle.y -= leftPaddle.dy;
    }
    if (keys.s && leftPaddle.y < HEIGHT - leftPaddle.height) {
        leftPaddle.y += leftPaddle.dy;
    }
    
    switch(ai_loaded.decision(rightPaddle, ai_ball, HEIGHT)) {
        case 0:
            if (rightPaddle.y > 0)
                rightPaddle.y -= rightPaddle.dy;
        case 1:
            break;
        case 2:
            if (rightPaddle.y < HEIGHT - rightPaddle.height)
                rightPaddle.y += rightPaddle.dy;
    }
}

function updateAiBall() {
    ai_ball.x = ball.x;
    ai_ball.y = ball.y
    ai_ball.dx = ball.dx
    ai_ball.dy = ball.dy
}

function moveBall() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Top and bottom collision
    if (ball.y + ball.height > HEIGHT || ball.y < 0) {
        ball.dy = -ball.dy;
    }

    // Paddle collision
    if (
        (ball.x < leftPaddle.x + leftPaddle.width && ball.y + ball.height > leftPaddle.y && ball.y < leftPaddle.y + leftPaddle.height) ||
        (ball.x + ball.width > rightPaddle.x && ball.y + ball.height > rightPaddle.y && ball.y < rightPaddle.y + rightPaddle.height)
    ) {
        ball.dx = -ball.dx;
    }

    // Reset ball if it goes out of bounds
    if (ball.x < 0 || ball.x + ball.width > WIDTH) {
        resetBall();
    }

    updateAiBall();
}

function draw() {
    // Clear canvas
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Draw ball
    ctx.fillStyle = 'black';
    ctx.fillRect(ball.x, ball.y, ball.width, ball.height);

    // Draw paddles
    ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height);
    ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height);
}

function gameLoop() {
    movePaddles();
    moveBall();
    draw();
    requestAnimationFrame(gameLoop);
}

resetBall();
gameLoop();
const canvas = document.getElementById('pong');
const context = canvas.getContext('2d');

const netWidth = 4;
const netHeight = canvas.height;

// Draw the net
function drawNet() {
    context.fillStyle = 'white';
    context.fillRect((canvas.width - netWidth) / 2, 0, netWidth, netHeight);
}

// Create paddles
const paddleWidth = 10;
const paddleHeight = 100;
const paddleSpeed = 8;

const leftPaddle = {
    x: 10,
    y: (canvas.height - paddleHeight) / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0
};

const rightPaddle = {
    x: canvas.width - paddleWidth - 10,
    y: (canvas.height - paddleHeight) / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0
};

// Create ball
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 10,
    speed: 4,
    dx: 4,
    dy: 4
};

// Draw paddles and ball
function drawPaddle(paddle) {
    context.fillStyle = 'green';
    context.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
}

function drawBall() {
    context.fillStyle = 'red';
    context.beginPath();
    context.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    context.fill();
}

// Move paddles
function movePaddles() {
    leftPaddle.y += leftPaddle.dy;
    rightPaddle.y += rightPaddle.dy;

    // Prevent paddles from going out of bounds
    if (leftPaddle.y < 0) leftPaddle.y = 0;
    if (leftPaddle.y + leftPaddle.height > canvas.height) leftPaddle.y = canvas.height - leftPaddle.height;
    if (rightPaddle.y < 0) rightPaddle.y = 0;
    if (rightPaddle.y + rightPaddle.height > canvas.height) rightPaddle.y = canvas.height - rightPaddle.height;
}

// Move ball
function moveBall() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Ball collision with top and bottom walls
    if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
        ball.dy *= -1;
    }

    // Ball collision with paddles
    if (ball.x - ball.radius < leftPaddle.x + leftPaddle.width && 
        ball.y > leftPaddle.y && ball.y < leftPaddle.y + leftPaddle.height &&
		ball.dx < 0) {
        ball.dx *= -1;
    }
    
    if (ball.x + ball.radius > rightPaddle.x && 
        ball.y > rightPaddle.y && ball.y < rightPaddle.y + rightPaddle.height &&
		ball.dx > 0) {
        ball.dx *= -1;
    }

    // Ball out of bounds
    if (ball.x + ball.radius < 0 || ball.x - ball.radius > canvas.width) {
        // Reset ball position
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
        ball.dx *= -1;
    }
}

// Update game objects
function update() {
    movePaddles();
    moveBall();
}

// Render game objects
function render() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawNet();
    drawPaddle(leftPaddle);
    drawPaddle(rightPaddle);
    drawBall();
}

// Game loop
function gameLoop() {
    update();
	if (true)
		aiOpponent(ball);
    render();
    requestAnimationFrame(gameLoop);
}

// Control paddles by AI
function aiOpponent() {
	if (rightPaddle.y + rightPaddle.height / 2 < ball.y)
		rightPaddle.dy = paddleSpeed;
	else if (rightPaddle.y + rightPaddle.height / 2> ball.y)
		rightPaddle.dy = -paddleSpeed;
	else
		;
}


// Control paddles with keyboard
document.addEventListener('keydown', function(e) {
    switch(e.key) {
        case 'w':
            leftPaddle.dy = -paddleSpeed;
            break;
        case 's':
            leftPaddle.dy = paddleSpeed;
            break;
    }
});

document.addEventListener('keyup', function(e) {
    switch(e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
            rightPaddle.dy = 0;
            break;
        case 'w':
        case 's':
            leftPaddle.dy = 0;
            break;
    }
});

// Start the game
gameLoop();

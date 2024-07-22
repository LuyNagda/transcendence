const canvas = document.getElementById('pong');
const context = canvas.getContext('2d');
const startButton = document.getElementById('startButton');

const netWidth = 4;
const netHeight = canvas.height;
let gameRunning = false;

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
    speed: 1,
    dx: 4,
    dy: 4
};

var ballAcceleration = 1.1;

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
    ball.x += ball.dx * ball.speed;
    ball.y += ball.dy * ball.speed;

    // Ball collision with top and bottom walls
    if (ball.y + ball.radius > canvas.height || ball.y - ball.radius < 0) {
        ball.dy *= -1;
    }

    // Ball collision with paddles
    // if (ball.x - ball.radius < leftPaddle.x + leftPaddle.width && 
    //     ball.y > leftPaddle.y && ball.y < leftPaddle.y + leftPaddle.height &&
	// 	ball.dx < 0) {
    //     ball.dx *= -1;
	// 	ball.speed *= ballAcceleration;
    // }
    if (ball.x < leftPaddle.x && ball.dx < 0) {
        ball.dx *= -1;
		ball.speed *= ballAcceleration;
    }
    
    if (ball.x + ball.radius > rightPaddle.x && 
        ball.y > rightPaddle.y && ball.y < rightPaddle.y + rightPaddle.height &&
		ball.dx > 0) {
        ball.dx *= -1;
		ball.speed *= ballAcceleration; 
    }

    // Ball out of bounds
    if (ball.x + ball.radius < 0 || ball.x - ball.radius > canvas.width) {
        // Reset ball position
        ball.x = canvas.width / 2;
        ball.y = canvas.height / 2;
        ball.dx *= -1;
		ball.speed = 1;
    }
}

// Update game objects
function update() {
	if (!gameRunning)
		return ;
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
	if ( gameRunning )
		aiOpponent();
    render();
    requestAnimationFrame(gameLoop);
}

const aiBall = {
    x: ball.x,
    y: ball.y,
    radius: ball.radius,
    speed: ball.speed,
    dx: ball.dx,
    dy: ball.dy
};

var intervalId = window.setInterval(function(){
    aiBall.x = ball.x;
    aiBall.y = ball.y;
    aiBall.radius = ball.radius;
    aiBall.speed = ball.speed;
    aiBall.dx = ball.dx;
    aiBall.dy = ball.dy;
}, 1000);

// Control paddles by AI
function aiOpponent() {
    // if (aiBall.x < canvas.width / 2 || aiBall.dx <= 0) {
    //     rightPaddle.dy = 0;
    //     return ;
    // }

    var ballXPrediction = aiBall.x + aiBall.dx;
    var ballYPrediction = aiBall.y + aiBall.dy;

    if (rightPaddle.y + rightPaddle.height / 2 < ballYPrediction) {
        rightPaddle.dy = paddleSpeed;
    }
    else if (rightPaddle.y + rightPaddle.height / 2 > ballYPrediction) {
        rightPaddle.dy = -paddleSpeed;
    }
    else
        rightPaddle.dy = 0;
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

// Start game button
startButton.addEventListener('click', function() {
    gameRunning = true;
    document.getElementById("notpong").style.display = 'none';
    document.getElementById("pauseButton").style.display = 'block';
});

// Pause game button
pauseButton.addEventListener('click', function() {
    gameRunning = false;
    document.getElementById("notpong").style.display = 'block';
    document.getElementById("pauseButton").style.display = 'none';
});

// Start the game
gameLoop();

// var slider = document.getElementById("myRange");
// var output = document.getElementById("demo");
// var difficulty = 4;
// output.innerHTML = slider.value; // Display the default slider value

// Update the current slider value (each time you drag the slider handle)
// slider.oninput = function() {
//   output.innerHTML = this.value;
//   switch(value) {
//     case "0":
//         difficulty = -1;
//         break;
//     case "1":
//         difficulty = 0;
//         break;
//     case "2":
//         difficulty = 1;
//         break;
//     case "3":
//         difficulty = 2;
//         break;
//     case "4":
//         difficulty = 3;
//         break;
//     case "5":
//         difficulty = 4;
//         break;
//   }
// }

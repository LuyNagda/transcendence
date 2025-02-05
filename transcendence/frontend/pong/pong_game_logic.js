let leftPaddle, rightPaddle, ball;
let leftScore, rightScore;
let paddleSpeed, ballSpeed;
let bufferCanvas, bufferContext;

export function initializeGame() {
	setupCanvas();
	setupGameObjects();
	setupEventListeners();
	requestAnimationFrame(gameLoop);
}

function setupCanvas() {
	bufferCanvas = document.createElement("canvas");
	bufferCanvas.width = 858;
	bufferCanvas.height = 525;
	bufferContext = bufferCanvas.getContext("2d");
}

function setupGameObjects() {
	const grid = 5;
	const paddleHeight = grid * 6;
	const maxPaddleY = bufferCanvas.height - grid - paddleHeight;

	leftPaddle = {
		x: grid * 2,
		y: bufferCanvas.height / 2 - paddleHeight / 2,
		width: grid,
		height: paddleHeight,
		dy: 0,
	};

	rightPaddle = {
		x: bufferCanvas.width - grid * 3,
		y: bufferCanvas.height / 2 - paddleHeight / 2,
		width: grid,
		height: paddleHeight,
		dy: 0,
	};

	ball = {
		x: bufferCanvas.width / 2,
		y: bufferCanvas.height / 2,
		width: grid,
		height: grid,
		resetting: false,
		dx: ballSpeed,
		dy: 0,
	};

	leftScore = 0;
	rightScore = 0;
	paddleSpeed = 2;
	ballSpeed = 2;
}

function setupEventListeners() {
	document.addEventListener("keydown", handleKeyDown);
	document.addEventListener("keyup", handleKeyUp);
}

function handleKeyDown(e) {
	if (e.which === 38) {
		rightPaddle.dy = -paddleSpeed;
	} else if (e.which === 40) {
		rightPaddle.dy = paddleSpeed;
	}

	if (e.which === 87) {
		leftPaddle.dy = -paddleSpeed;
	} else if (e.which === 83) {
		leftPaddle.dy = paddleSpeed;
	}
}

function handleKeyUp(e) {
	if (e.which === 38 || e.which === 40) {
		rightPaddle.dy = 0;
	}

	if (e.which === 83 || e.which === 87) {
		leftPaddle.dy = 0;
	}
}

function gameLoop() {
	updateGameState();
	drawGame();
	requestAnimationFrame(gameLoop);
}

function updateGameState() {
	const grid = 5;
	const maxPaddleY = bufferCanvas.height - grid - leftPaddle.height;

	leftPaddle.y += leftPaddle.dy;
	rightPaddle.y += rightPaddle.dy;

	if (leftPaddle.y < grid) {
		leftPaddle.y = grid;
	} else if (leftPaddle.y > maxPaddleY) {
		leftPaddle.y = maxPaddleY;
	}

	if (rightPaddle.y < grid) {
		rightPaddle.y = grid;
	} else if (rightPaddle.y > maxPaddleY) {
		rightPaddle.y = maxPaddleY;
	}

	ball.x += ball.dx;
	ball.y += ball.dy;

	if (ball.y < 0) {
		ball.y = 0;
		ball.dy *= -1;
	} else if (ball.y + grid > bufferCanvas.height) {
		ball.y = bufferCanvas.height - grid;
		ball.dy *= -1;
	}

	if ((ball.x < 0 || ball.x > bufferCanvas.width) && !ball.resetting) {
		ball.resetting = true;

		if (ball.x < 0) {
			rightScore++;
		} else {
			leftScore++;
		}

		setTimeout(() => {
			ball.resetting = false;
			ball.x = bufferCanvas.width / 2;
			ball.y = bufferCanvas.height / 2;
		}, 400);
	}

	if (collides(ball, leftPaddle)) {
		ball.dx = ballSpeed;
		ball.x = leftPaddle.x + leftPaddle.width;
		updateBallAngle(leftPaddle);
	} else if (collides(ball, rightPaddle)) {
		ball.dx = -ballSpeed;
		ball.x = rightPaddle.x - ball.width;
		updateBallAngle(rightPaddle);
	}
}

function drawGame() {
	bufferContext.clearRect(0, 0, bufferCanvas.width, bufferCanvas.height);

	bufferContext.fillStyle = "white";
	bufferContext.fillRect(
		leftPaddle.x,
		leftPaddle.y,
		leftPaddle.width,
		leftPaddle.height
	);
	bufferContext.fillRect(
		rightPaddle.x,
		rightPaddle.y,
		rightPaddle.width,
		rightPaddle.height
	);
	bufferContext.fillRect(ball.x, ball.y, ball.width, ball.height);

	for (let i = 0; i < bufferCanvas.height; i += ball.height * 2) {
		bufferContext.fillRect(bufferCanvas.width / 2 - 1, i, 2, ball.height);
	}

	bufferContext.font = "40px PongScore";
	bufferContext.fillText(leftScore, bufferCanvas.width / 4, 50);
	bufferContext.fillText(rightScore, (3 * bufferCanvas.width) / 4, 50);

	// Mettez à jour la texture WebGL
	if (typeof updateWebGLTexture === "function") {
		updateWebGLTexture(bufferCanvas);
	}
}

function collides(obj1, obj2) {
	return (
		obj1.x < obj2.x + obj2.width &&
		obj1.x + obj1.width > obj2.x &&
		obj1.y < obj2.y + obj2.height &&
		obj1.y + obj2.height > obj2.y
	);
}

function updateBallAngle(paddle) {
	const relativeIntersectY =
		paddle.y + paddle.height / 2 - (ball.y + ball.height / 2);
	const normalizedRelativeIntersectionY =
		relativeIntersectY / (paddle.height / 2);
	const bounceAngle = normalizedRelativeIntersectionY * ((5 * Math.PI) / 12);
	ball.dy = ballSpeed * -Math.sin(bounceAngle);
}

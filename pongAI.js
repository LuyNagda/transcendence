import {ball , paddleSpeed, rightPaddle} from "./pong.js";

const aiBall = {
    x: 0,
    y: 0,
    radius: 0,
    speed: 0,
    dx: 0,
    dy: 0
};

setTimeout(() => {
    const aiBall = {
        x: ball.x,
        y: ball.y,
        radius: ball.radius,
        speed: ball.speed,
        dx: ball.dx,
        dy: ball.dy
    };
}, 10);

var intervalId = window.setInterval(function() {
    aiBall.x = ball.x;
    aiBall.y = ball.y;
    aiBall.radius = ball.radius;
    aiBall.speed = ball.speed;
    aiBall.dx = ball.dx;
    aiBall.dy = ball.dy;
}, 1000);

// Control paddles by AI
export default function aiOpponent() {
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

import random, math
from . import gameconfig

class Ball:
    def __init__(self, center_x, center_y):
        self.center_x = center_x
        self.center_y = center_y
        self.dx = 0
        self.dy = 0
        self.size = gameconfig.BALL_SIZE
        self._center = (center_x, center_y)

    @property
    def center(self):
        return self._center

    @center.setter
    def center(self, value):
        self._center = value
        self.center_x = value[0]
        self.center_y = value[1]

    @property
    def top(self):
        return self.center_y - self.size / 2

    @top.setter
    def top(self, value):
        self.center_y = value + self.size / 2
        self._center = (self.center_x, self.center_y)

    @property
    def bottom(self):
        return self.center_y + self.size / 2

    @bottom.setter
    def bottom(self, value):
        self.center_y = value - self.size / 2
        self._center = (self.center_x, self.center_y)

    @property
    def left(self):
        return self.center_x - self.size / 2

    @left.setter
    def left(self, value):
        self.center_x = value + self.size / 2
        self._center = (self.center_x, self.center_y)

    @property
    def right(self):
        return self.center_x + self.size / 2

    @right.setter
    def right(self, value):
        self.center_x = value - self.size / 2
        self._center = (self.center_x, self.center_y)

class AI_ball:
    center_x: float
    center_y: float
    dx: float
    dy: float

    def __init__(self, ball):
        self.update(ball)

    def update(self, ball):
        self.center_x = ball.center_x
        self.center_y = ball.center_y
        self.dx = ball.dx
        self.dy = ball.dy

class Paddle:
    def __init__(self, center_x, center_y, width, height):
        self.center_x = center_x
        self.center_y = center_y
        self.width = width
        self.height = height

    @property
    def top(self):
        return self.center_y - self.height / 2

    @top.setter
    def top(self, value):
        self.center_y = value + self.height / 2

    @property
    def bottom(self):
        return self.center_y + self.height / 2

    @bottom.setter
    def bottom(self, value):
        self.center_y = value - self.height / 2

    @property
    def left(self):
        return self.center_x - self.width / 2

    @property
    def right(self):
        return self.center_x + self.width / 2

def reset_ball(ball):
    ball.center = (gameconfig.WIDTH // 2, gameconfig.HEIGHT // 2)
    
    # Random angle
    angle = random.uniform(-math.pi / 4, math.pi / 4)
    ball.dx = gameconfig.BALL_SPEED * math.cos(angle) * random.choice([-1, 1])
    ball.dy = gameconfig.BALL_SPEED * math.sin(angle)

    return ball

def collides(ball, paddle):
    return (ball.bottom >= paddle.top and ball.top <= paddle.bottom and
            ball.left <= paddle.right and ball.right >= paddle.left)

def update_ball_angle(ball, paddle):
    # Calculate the relative intersection (-1 at bottom, 0 at center, 1 at top)
    relativeIntersectY = (ball.center_y - paddle.center_y) / (paddle.height / 2)

    # Clamp the value to prevent extreme values
    relativeIntersectY = max(-1, min(1, relativeIntersectY))

    # Calculate the rebound's angle (max ±45 degrees)
    bounceAngle = relativeIntersectY * (math.pi / 4)

    # Update the ball's velocity
    ball.dx = gameconfig.BALL_SPEED * -math.cos(bounceAngle)
    ball.dy = gameconfig.BALL_SPEED * math.sin(bounceAngle)

    return ball

def train_normal(Ai_selected, Ai_nb, time_limit, max_score):
    # Initialize game objects
    rightPaddle = Paddle(
        center_x = gameconfig.WIDTH - 60,
        center_y = gameconfig.HEIGHT // 2,
        width = gameconfig.PADDLE_WIDTH,
        height = gameconfig.PADDLE_HEIGHT
    )

    # Normal game loop
    ball = Ball(
        center_x = gameconfig.WIDTH // 2,
        center_y = gameconfig.HEIGHT // 2,
    )
    ball = reset_ball(ball)

    # Update AI's target position
    ai_ball = AI_ball(ball)

    running = True
    left_score = 0
    game_tick = 0
    
    while running:
        # Limit the game time to 'time_limit' theoretical minutes
        if time_limit != 0 and game_tick > (time_limit * 60 * 60):
            running = False
            continue

        # Move the ball
        ball.center_x += ball.dx * gameconfig.DT
        ball.center_y += ball.dy * gameconfig.DT

        # Update the ai view
        if game_tick % 60 == 0:
            ai_ball.update(ball)

        # Move the right paddle
        match (Ai_selected.decision(rightPaddle.center_y, ai_ball, gameconfig.HEIGHT, gameconfig.WIDTH)):
            case 0:
                rightPaddle.center_y -= gameconfig.PADDLE_SPEED * gameconfig.DT
                if rightPaddle.top <= 0:
                    rightPaddle.top = 0
            case 1:
                pass
            case 2:
                rightPaddle.center_y += gameconfig.PADDLE_SPEED * gameconfig.DT
                if rightPaddle.bottom >= gameconfig.HEIGHT:
                    rightPaddle.bottom = gameconfig.HEIGHT

        # Ball collision with top and bottom
        if ball.top <= 0:
            ball.top = 5
            ball.dy *= -1
        elif ball.bottom >= gameconfig.HEIGHT:
            ball.bottom = gameconfig.HEIGHT - 5
            ball.dy *= -1

        # Ball collision with left wall
        if ball.left <= 50:
            ball.left = 51
            angle = random.uniform(-math.pi / 4, math.pi / 4)
            ball.dx = abs(gameconfig.BALL_SPEED * math.cos(angle))
            ball.dy = gameconfig.BALL_SPEED * math.sin(angle)

        # Ball collision with AI's paddles
        if collides(ball, rightPaddle):
            Ai_selected.ai_score += 1
            ball = update_ball_angle(ball, rightPaddle)
            ball.right = rightPaddle.left

        # Ball out of bounds
        if ball.right >= gameconfig.WIDTH:
            left_score += 1
            ball = reset_ball(ball)

        # End the game
        if left_score >= max_score:
            running = False

        game_tick += 1
    
    return Ai_selected.ai_score

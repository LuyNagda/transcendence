import random, math
from . import gameconfig

class Ball:
    def __init__(self, x, y):
        self.x = x
        self.y = y
        self.dx = 0
        self.dy = 0
        self.size = gameconfig.BALL_SIZE
        self._center = (x, y)
    
    @property
    def center(self):
        return self._center
    
    @center.setter
    def center(self, value):
        self._center = value
        self.x = value[0]
        self.y = value[1]
    
    @property 
    def top(self):
        return self.y - self.size/2
    
    @top.setter
    def top(self, value):
        self.y = value + self.size/2
        self._center = (self.x, self.y)
    
    @property
    def bottom(self):
        return self.y + self.size/2
    
    @bottom.setter
    def bottom(self, value):
        self.y = value - self.size/2
        self._center = (self.x, self.y)
    
    @property
    def left(self):
        return self.x - self.size/2
    
    @left.setter
    def left(self, value):
        self.x = value + self.size/2
        self._center = (self.x, self.y)
    
    @property
    def right(self):
        return self.x + self.size/2
    
    @right.setter
    def right(self, value):
        self.x = value - self.size/2
        self._center = (self.x, self.y)

class AI_ball:
    x: float
    y: float
    dx: float
    dy: float

    def __init__(self, ball):
            self.update(ball)

    def update(self, ball):
        self.x = ball.x
        self.y = ball.y
        self.dx = ball.dx
        self.dy = ball.dy

class Paddle:
    def __init__(self, x, y, width, height):
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    
    @property
    def top(self):
        return self.y - self.height / 2

    @top.setter
    def top(self, value):
        self.y = value + self.height / 2

    @property
    def bottom(self):
        return self.y + self.height / 2

    @bottom.setter
    def bottom(self, value):
        self.y = value - self.height / 2

    @property
    def left(self):
        return self.x - self.width / 2

    @property
    def right(self):
        return self.x + self.width / 2

def reset_ball(ball):
    ball.center = (gameconfig.WIDTH//2, gameconfig.HEIGHT//2)
    
    # Random angle
    angle = random.uniform(-math.pi / 4, math.pi / 4)
    ball.dx = gameconfig.BALL_SPEED * math.cos(angle) * random.choice([-1, 1])
    ball.dy = gameconfig.BALL_SPEED * math.sin(angle)

    return ball

def collides(ball, paddle):
    return (ball.bottom > paddle.top and ball.top < paddle.bottom and
            ball.left < paddle.right and ball.right > paddle.left)


def update_ball_angle(ball, paddle):
    # Calculate the relative intersection (-1 at bottom, 0 at center, 1 at top)
    relativeIntersectY = (ball.y - paddle.y) / (paddle.height / 2)

    # Clamp the value to prevent extreme values
    relativeIntersectY = max(-1, min(1, relativeIntersectY))

    # Calculate the rebound's angle (max ±45 degrees)
    bounceAngle = relativeIntersectY * (math.pi / 4)

    # Update the ball's velocity
    ball.dx = gameconfig.BALL_SPEED * -math.cos(bounceAngle)
    ball.dy = gameconfig.BALL_SPEED * math.sin(bounceAngle)

    return ball

def generate_random_number(low, high):
    return random.randint(low, high)

def train_normal(Ai_selected, Ai_nb, time_limit, max_score):
    # Initialize game objects
    rightPaddle = Paddle(
        x = gameconfig.WIDTH - 60 - gameconfig.PADDLE_WIDTH,
        y = gameconfig.HEIGHT//2 - gameconfig.PADDLE_HEIGHT//2,
        width = gameconfig.PADDLE_WIDTH,
        height = gameconfig.PADDLE_HEIGHT
    )

    # Normal game loop
    ball = Ball(
        x = gameconfig.WIDTH / 2,
        y = gameconfig.HEIGHT / 2,
    )
    ball = reset_ball(ball)

    # Update AI's target position
    ai_ball = AI_ball(ball)

    running = True
    left_score = 0
    wall_bounce = 9
    i = 0
    while running:
        # Limit the game time to 'time_limit' theoretical minutes
        if time_limit != 0 and i > (time_limit * 60 * 60):
            running = False
            continue
        i += 1

        # Move the ball
        ball.x += ball.dx
        ball.y += ball.dy

        # Update the ai view
        if i % 60 == 0:
            ai_ball.update(ball)

        # Move the right paddle
        match (Ai_selected.decision(rightPaddle.y, ai_ball, gameconfig.HEIGHT)):
            case 0:
                # Ai moves the paddle up
                if rightPaddle.top > 0:
                    rightPaddle.y -= gameconfig.PADDLE_SPEED
            case 1:
                # Ai stay still
                pass
            case 2:
                # Ai moves the paddle down
                if rightPaddle.bottom < gameconfig.HEIGHT:
                    rightPaddle.y += gameconfig.PADDLE_SPEED

        # Ball collision with top and bottom
        if ball.top <= 0:
            ball.top = 5
            ball.dy *= -1
            if abs(ball.dy) < 1:
                ball.dy = 1 if ball.dy > 0 else -1
        elif ball.bottom >= gameconfig.HEIGHT:
            ball.bottom = gameconfig.HEIGHT - 5
            ball.dy *= -1
            if abs(ball.dy) < 1:
                ball.dy = 1 if ball.dy > 0 else -1

        # Ball collision with left wall
        if ball.x <= 50:
            ball.left = 51
            if wall_bounce != 0:
                angle = random.uniform(-math.pi / 4, math.pi / 4)
                wall_bounce -= 1
            else:
                angle = 0
                wall_bounce = 9
            
            ball.dx = abs(gameconfig.BALL_SPEED * math.cos(angle))
            ball.dy = gameconfig.BALL_SPEED * math.sin(angle)

        # Check if the ball is on the right side and moving right
        if ball.x > gameconfig.WIDTH / 2 and ball.dx > 0:
            # Simulate step-wise movement to detect missed collisions
            steps = max(1, int(abs(ball.dx)))  # Ensure at least 1 step

            for _ in range(steps):
                ball.x += ball.dx / steps  # Move in smaller increments
                ball.y += ball.dy / steps  

                if collides(ball, rightPaddle):  # Check collision at each step
                    Ai_selected.ai_score += 1
                    ball = update_ball_angle(ball, rightPaddle)
                    ball.right = rightPaddle.left  # Ensure correct positioning after bounce
                    break  # Stop further movement after collision
        else:
            # Normal movement when ball is not on the right side or moving left
            ball.x += ball.dx
            ball.y += ball.dy

        # Ball out of bounds
        if ball.right >= gameconfig.WIDTH:
            left_score += 1
            ball = reset_ball(ball)

        # End the game
        if left_score >= max_score:
            running = False
    
    species_log = f"The AI {Ai_nb} score is {Ai_selected.ai_score:.1f}"
    return species_log

import random, math
from .game import AI_ball, HEIGHT, WIDTH, BALL_SPEED, PADDLE_WIDTH, PADDLE_HEIGHT, BALL_SIZE, PADDLE_SPEED, GRID, BLACK, WHITE
from .gameconfig import get_game_config

def ai_bonus_score(ball_y, rightPaddle, Ai_selected):
    dist = abs(ball_y - rightPaddle.top) / HEIGHT

    if dist < 0.05:
        Ai_selected.ai_score = (1 - dist) / 10 + Ai_selected.ai_score 

def reset_ball(ball):
    ball.center = (WIDTH//2, HEIGHT//2)

def collides(ball, paddle):
    if ball.bottom > paddle.top and ball.top < paddle.bottom and ball.left < paddle.right and ball.right > paddle.left:
        return True

    return False

def updateBallAngle(ball, ball_dy, paddle):
    # Calculate the relative's position of the collision with the paddle
    relativeIntersectY = (paddle.y + (paddle.height / 2)) - (ball.y + (ball.height / 2))
    normalizedRelativeIntersectionY = relativeIntersectY / (paddle.height / 2)

    # Calculate the rebound's angle (max 75 degrees)
    bounceAngle = normalizedRelativeIntersectionY * (5 * math.pi / 12)

    # Update the ball's vertical velocity
    ball_dy = BALL_SPEED * -math.sin(bounceAngle)

    return ball_dy

def generate_random_number(low, high):
    return random.randint(low, high)

def train_basic_no_display(Ai_selected):
    # Create paddles and ball
    class Paddle:
        def __init__(self, x, y, width, height):
            self.x = x
            self.y = y
            self.width = width
            self.height = height
            # Add center property to match pygame.Rect behavior
            self._center = (x + width/2, y + height/2)
        
        @property
        def center(self):
            return self._center
        
        @center.setter 
        def center(self, value):
            self._center = value
            self.x = value[0] - self.width/2
            self.y = value[1] - self.height/2
        
        @property
        def top(self):
            return self.y
        
        @property
        def bottom(self):
            return self.y + self.height
        
        @property
        def left(self):
            return self.x
        
        @property
        def right(self):
            return self.x + self.width

    class Ball:
        def __init__(self, x, y, size):
            self.x = x
            self.y = y
            self.size = size
            self.width = size
            self.height = size
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

    # Initialize game objects
    rightPaddle = Paddle(
        x = WIDTH - 50 - PADDLE_WIDTH,
        y = HEIGHT//2 - PADDLE_HEIGHT//2,
        width = PADDLE_WIDTH,
        height = PADDLE_HEIGHT
    )

    # # Predifine game loop
    # total_predefined = 0
    # for predefined_y in range(round(HEIGHT / 10), HEIGHT, round(HEIGHT / 10)):
    #     ball = Ball(
    #         x = 50,
    #         y = predefined_y,
    #         size = BALL_SIZE
    #     )

    #     for predefined_angle in range(-75, 76):
    #         total_predefined += 1
    #         # Ball movement
    #         ball_dx = BALL_SPEED
    #         ball_dy = BALL_SPEED * -math.sin(predefined_angle)

    #         # Update AI's target position
    #         ai_ball = AI_ball(ball, 0, 0, 0)
    #         ai_ball.update(ball, ball_dx, ball_dy)

    #         i = 0
    #         while (True):
    #             # Move the ball
    #             ball.x += ball_dx
    #             ball.y += ball_dy

    #             # Update the ai view
    #             if i % 60 == 0:
    #                 ai_ball.update(ball, ball_dx, ball_dy)

    #             # Move the right paddle
    #             match (Ai_selected.decision(rightPaddle.y, ai_ball, HEIGHT)):
    #                 case 0:
    #                     if rightPaddle.top > 0:
    #                         rightPaddle.y -= PADDLE_SPEED
    #                 case 1:
    #                     pass
    #                 case 2:
    #                     if rightPaddle.bottom < HEIGHT:
    #                         rightPaddle.y += PADDLE_SPEED

    #             # Ball collision with top and bottom
    #             if ball.top <= 0:
    #                 ball.top = GRID
    #                 ball_dy *= -1
    #                 if abs(ball_dy) < 1:
    #                     ball_dy = 1 if ball_dy > 0 else -1
    #             elif ball.bottom >= HEIGHT:
    #                 ball.bottom = HEIGHT - GRID
    #                 ball_dy *= -1
    #                 if abs(ball_dy) < 1:
    #                     ball_dy = 1 if ball_dy > 0 else -1

    #             # Ball collision with AI's paddles
    #             if collides(ball, rightPaddle):
    #                 if ball.right < rightPaddle.right:
    #                     Ai_selected.ai_score += 1
    #                     break

    #             # Ball out of bounds
    #             if ball.right >= WIDTH:
    #                 ai_bonus_score(ball.y, rightPaddle, Ai_selected)
    #                 break
                
    #             i += 1

    # print(f"\nScore before normal game: {Ai_selected.ai_score:.1f} / {total_predefined}")

    # Normal game loop
    ball = Ball(
        x = WIDTH / 2,
        y = HEIGHT / 2,
        size = BALL_SIZE
    )
    ball_dx = BALL_SPEED
    ball_dy = 0

    # Update AI's target position
    ai_ball = AI_ball(ball, 0, 0, 0)
    ai_ball.update(ball, ball_dx, ball_dy)

    running = True
    left_score = 0
    i = 0
    j = 0
    while running:
        # Limit the game time to GAME_CONF['time_limit'] theoretical minutes
        if get_game_config('time_limit')[0] != 0 \
            and i > (get_game_config('time_limit')[0] * 60 * 60):
            break
        i += 1

        # Move the ball
        ball.x += ball_dx
        ball.y += ball_dy

        # Update the ai view
        if i % 60 == 0:
            ai_ball.update(ball, ball_dx, ball_dy)

        # Move the right paddle
        match (Ai_selected.decision(rightPaddle.y, ai_ball, HEIGHT)):
            case 0:
                # print("AI decision: 0")
                if rightPaddle.top > 0:
                    rightPaddle.y -= PADDLE_SPEED
            case 1:
                # print("AI decision: 1")
                pass
            case 2:
                # print("AI decision: 2")
                if rightPaddle.bottom < HEIGHT:
                    rightPaddle.y += PADDLE_SPEED

        # Ball collision with top and bottom
        if ball.top <= 0:
            ball.top = GRID
            ball_dy *= -1
            if abs(ball_dy) < 1:
                ball_dy = 1 if ball_dy > 0 else -1
        elif ball.bottom >= HEIGHT:
            ball.bottom = HEIGHT - GRID
            ball_dy *= -1
            if abs(ball_dy) < 1:
                ball_dy = 1 if ball_dy > 0 else -1

        # Ball collision with left wall
        if ball.x <= 50:
            ball_dx *= -1
            ball.left = 50
            if j == 0:
                ball_dy = BALL_SPEED * -math.sin(generate_random_number(-75, 75))
                j = 42
            else:
                ball_dy = 0
                j = 0
        # Ball collision with AI's paddles
        if collides(ball, rightPaddle):
            if ball.right < rightPaddle.right:
                ball_dx *= -1
                ball.right = rightPaddle.left
                Ai_selected.ai_score += 1
                ball_dy = updateBallAngle(ball, ball_dy, rightPaddle)

        # Ball out of bounds
        if ball.right >= WIDTH:
            left_score += 1
            # ai_bonus_score(ball.y, rightPaddle, Ai_selected)
            reset_ball(ball)

        # End the game
        if left_score >= get_game_config('max_score')[0]:
            running = False


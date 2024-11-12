import pygame, random, time, math, os

# Set up the game window
WIDTH = 80 * 6
HEIGHT = 24 * 10
GRID = 5

DISPLAY_GAME = "no"
AI_DELAY = "yes"
MAX_SCORE = 10
NB_GENERATION = 1000
NB_SPECIES = 50
MAX_FRAME_RATE = 0  # 0 = unlimited
SAVE_FILE = "bestAI"
SAVE_FOLDER = "Saved_AI"
SAVE_AI = "yes"
TIME_LIMIT = 30

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)

# Paddle settings
PADDLE_HEIGHT = 5 * 6
PADDLE_WIDTH = 5
PADDLE_SPEED = 2

# Ball settings
BALL_SPEED = 2
BALL_SIZE = 5
BALL_MIN_DY = 0.5
ball : pygame.rect
ball_dx : float
ball_dy : float

class AI_ball:
    x: float
    y: float
    dx: float
    dy: float

    def __init__(self, x, y=None, dx=None, dy=None):
        if y == None:
            ball = x
            self.update(ball, ball_dx, ball_dy)
        else:
            self.x = x
            self.y = y
            self.dx = dx
            self.dy = dy

    def __repr__(self):
        return f"x = {self.x}\t\t\ty = {self.y} \ndx = {self.dx}\t\t\tdy = {self.dy}\n"
    
    def update(self, ball, ball_dx, ball_dy):
        self.x = ball.x
        self.y = ball.y
        self.dx = ball_dx
        self.dy = ball_dy

def ai_bonus_score(ball_y, rightPaddle, Ai_selected):
    dist = abs(ball_y - rightPaddle.top) / HEIGHT

    if dist < 0.2:
        Ai_selected.ai_score += 1 - dist

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

def train_basic(Ai_selected, SHOW_MATCH):
    os.environ["SDL_AUDIODRIVER"] = "dumb"

    # Initialize Pygame
    pygame.init()

    if SHOW_MATCH == "yes":
        window = pygame.display.set_mode((WIDTH, HEIGHT))
        pygame.display.set_caption("Pong")

    # Create paddles and ball
    leftPaddle = pygame.Rect(50, 0, PADDLE_WIDTH, HEIGHT) # Wall for trainning purpose
    rightPaddle = pygame.Rect(WIDTH - 50 - PADDLE_WIDTH, HEIGHT//2 - PADDLE_HEIGHT//2, PADDLE_WIDTH, PADDLE_HEIGHT)
    ball = pygame.Rect(WIDTH//2 - BALL_SIZE//2, HEIGHT//2 - BALL_SIZE//2, BALL_SIZE, BALL_SIZE)

    # Set up the game clock
    clock = pygame.time.Clock()

    # Ball movement
    ball_dx = BALL_SPEED
    ball_dy = 0

    # Score
    left_score = 0
    right_score = 0

    # Font for score display
    font = pygame.font.Font(None, 36)

    # Update AI's target position
    ai_ball = AI_ball(ball, 0, 0, 0)
    ai_ball.update(ball, ball_dx, ball_dy)

    # Game loop
    running = True
    i = 0
    j= 0
    while running:
        # Limit the game time to {TIME_LIMIT} theoretical minutes
        if i > (TIME_LIMIT * 60 * 60):
            break
        i += 1

        if (MAX_FRAME_RATE != 0):
            clock.tick(MAX_FRAME_RATE)

        # Display the game
        if SHOW_MATCH == "yes":
            # Clear the screen
            window.fill(BLACK)

            # Draw paddles and ball
            pygame.draw.rect(window, WHITE, leftPaddle)
            pygame.draw.rect(window, WHITE, rightPaddle)
            pygame.draw.ellipse(window, WHITE, ball)

            # Draw scores
            left_text = font.render(str(left_score), True, WHITE)
            right_text = font.render(str(right_score), True, WHITE)
            window.blit(left_text, (WIDTH//4, 20))
            window.blit(right_text, (3*WIDTH//4, 20))

            # Draw the center line
            pygame.draw.aaline(window, WHITE, (WIDTH//2, 0), (WIDTH//2, HEIGHT))

            # Update the display
            pygame.display.flip()

        keys = pygame.key.get_pressed()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return "STOP"
        if keys[pygame.K_ESCAPE]:
            pygame.quit()
            return "STOP"

        # Move the ball
        ball.x += ball_dx
        ball.y += ball_dy

        # Update the ai view
        if (AI_DELAY == "yes"):
            # current_time = time.time()
            # if current_time - last_update_time >= 1:
            if i % 60 == 0:
                ai_ball.update(ball, ball_dx, ball_dy)
        else:
            ai_ball.update(ball, ball_dx, ball_dy)

        # Move the right paddle
        match (Ai_selected.decision(rightPaddle.y, ai_ball, HEIGHT)):
            case 0:
                if rightPaddle.top > 0:
                    rightPaddle.y -= PADDLE_SPEED
            case 1:
                pass
            case 2:
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

        # Ball collision with paddles
        if collides(ball, leftPaddle):
            if ball.left > leftPaddle.left:
                ball_dx *= -1
                ball.left = leftPaddle.right
                if j == 0:
                    ball_dy = BALL_SPEED * -math.sin(generate_random_number(-75, 75))
                    j = 3
                else:
                    ball_dy = 0
                    j -= 1
        elif collides(ball, rightPaddle):
            if ball.right < rightPaddle.right:
                ball_dx *= -1
                ball.right = rightPaddle.left
                Ai_selected.ai_score += 1
                ball_dy = updateBallAngle(ball, ball_dy, rightPaddle)

        # Ball out of bounds
        if ball.left <= 0:
            right_score += 1
            reset_ball(ball)
        elif ball.right >= WIDTH:
            left_score += 1
            ai_bonus_score(ball.y, rightPaddle, Ai_selected)
            reset_ball(ball)

        # End the game
        if left_score >= MAX_SCORE:
            running = False

    # Quit the game
    pygame.quit()

def play_Ai(Ai, demo):
    os.environ["SDL_AUDIODRIVER"] = "dumb"

    # Initialize Pygame
    pygame.init()

    window = pygame.display.set_mode((WIDTH, HEIGHT))
    pygame.display.set_caption("Pong")

    # Create paddles and ball
    leftPaddle = pygame.Rect(50, HEIGHT//2 - PADDLE_HEIGHT//2, PADDLE_WIDTH, PADDLE_HEIGHT)
    rightPaddle = pygame.Rect(WIDTH - 50 - PADDLE_WIDTH, HEIGHT//2 - PADDLE_HEIGHT//2, PADDLE_WIDTH, PADDLE_HEIGHT)
    ball = pygame.Rect(WIDTH//2 - BALL_SIZE//2, HEIGHT//2 - BALL_SIZE//2, BALL_SIZE, BALL_SIZE)

    # Set up the game clock
    clock = pygame.time.Clock()

    # Ball movement
    ball_dx = BALL_SPEED * random.choice((1, -1))
    ball_dy = 0

    # Update AI's target position
    ai_ball = AI_ball(ball, 0, 0, 0)
    ai_ball.update(ball, ball_dx, ball_dy)

    # Score
    left_score = 0
    right_score = 0

    # Font for score display
    font = pygame.font.Font(None, 36)

    # New variables for AI's delayed reaction
    last_update_time = time.time()

    # Game loop
    running = True
    while running:
        keys = pygame.key.get_pressed()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                return "STOP"

        if keys[pygame.K_ESCAPE]:
            pygame.quit()
            return "STOP"

        if (AI_DELAY == "yes"):
            current_time = time.time()
            if current_time - last_update_time >= 1:
                ai_ball.update(ball, ball_dx, ball_dy)
                last_update_time = current_time
        else:
            ai_ball.update(ball, ball_dx, ball_dy)

        # Move the left paddle by AI
        if (demo == "yes"):
            match (Ai.decision_left(rightPaddle, ai_ball, HEIGHT)):
                case 0:
                    if leftPaddle.top > 0 :
                        leftPaddle.y -= PADDLE_SPEED
                case 1:
                    pass
                case 2:
                    if leftPaddle.bottom < HEIGHT:
                        leftPaddle.y += PADDLE_SPEED

        # Move the left paddle with keyboard inputs
        else:
            if keys[pygame.K_w] and leftPaddle.top > 0:
                leftPaddle.y -= PADDLE_SPEED
            if keys[pygame.K_s] and leftPaddle.bottom < HEIGHT:
                leftPaddle.y += PADDLE_SPEED

        # Move the AI's paddle
        match (Ai.decision(rightPaddle.y, ai_ball, HEIGHT)):
            case 0:
                if rightPaddle.top > 0:
                    rightPaddle.y -= PADDLE_SPEED
            case 1:
                pass
            case 2:
                if rightPaddle.bottom < HEIGHT:
                    rightPaddle.y += PADDLE_SPEED

        # Move the ball
        ball.x += ball_dx
        ball.y += ball_dy

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

        # Ball collision with paddles
        if collides(ball, leftPaddle):
            if ball.left > leftPaddle.left:
                ball_dx *= -1
                ball.left = leftPaddle.right
                ball_dy = updateBallAngle(ball, ball_dy, leftPaddle)
        elif collides(ball, rightPaddle):
            if ball.right < rightPaddle.right:
                ball_dx *= -1
                ball.right = rightPaddle.left
                ball_dy = updateBallAngle(ball, ball_dy, rightPaddle)

        # Ball out of bounds
        if ball.left <= 0:
            right_score += 1
            reset_ball(ball)
        elif ball.right >= WIDTH:
            left_score += 1
            reset_ball(ball)

        # End the game
        if left_score >= MAX_SCORE:
            running = False

        # Clear the screen
        window.fill(BLACK)

        # Draw paddles and ball
        pygame.draw.rect(window, WHITE, leftPaddle)
        pygame.draw.rect(window, WHITE, rightPaddle)
        pygame.draw.ellipse(window, WHITE, ball)

        # Draw scores
        left_text = font.render(str(left_score), True, WHITE)
        right_text = font.render(str(right_score), True, WHITE)
        window.blit(left_text, (WIDTH//4, 20))
        window.blit(right_text, (3*WIDTH//4, 20))

        # Draw the center line
        pygame.draw.aaline(window, WHITE, (WIDTH//2, 0), (WIDTH//2, HEIGHT))

        # Update the display
        pygame.display.flip()

        if (MAX_FRAME_RATE != 0):
            clock.tick(MAX_FRAME_RATE)

    # Quit the game
    pygame.quit()

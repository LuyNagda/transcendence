import random

# Set up the game window
WIDTH = 800
HEIGHT = 600

DISPLAY_GAME = "yes"
DYSPLAY_LOG = "yes"
AI_DELAY = "no"
MAX_SCORE = 10
NB_GENERATION = 100
NB_SPECIES = 50
MAX_FRAME_RATE = 0  # 0 = unlimited
SAVE_FILE = "bestAI"
SAVE_FOLDER = "Saved_AI"
SAVE_AI = "yes"

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)

# Paddle settings
PADDLE_WIDTH = 15
PADDLE_HEIGHT = 90
PADDLE_SPEED = 5

# Ball settings
BALL_SIZE = 15
BALL_SPEED_X = 7
BALL_SPEED_Y = 7

class opponent_ball:
    x: int
    y: int
    dx: int
    dy: int

    def __repr__(self):
        return f"x = {self.x}\t\t\ty = {self.y} \ndx = {self.dx}\t\t\tdy = {self.dy}\n"

def reset_ball(ball):
    ball.center = (WIDTH//2, HEIGHT//2)
    return BALL_SPEED_X * random.choice((1, -1)), BALL_SPEED_Y * random.choice((1, -1))


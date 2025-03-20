# Set up the game window
WIDTH = 858
HEIGHT = 525
GRID = 5

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)

# Paddle settings
PADDLE_WIDTH = 10
PADDLE_HEIGHT_BASE = 30
PADDLE_HEIGHT_STD = 5
PADDLE_HEIGHT = PADDLE_HEIGHT_BASE + (PADDLE_HEIGHT_STD * 4)

PADDLE_SPEED_BASE = 50
PADDLE_SPEED_STD = 5
PADDLE_SPEED = PADDLE_SPEED_BASE * PADDLE_SPEED_STD

# Ball settings
BALL_SPEED_BASE = 70
BALL_SPEED_STD = 5
BALL_SPEED = BALL_SPEED_BASE * BALL_SPEED_STD
BALL_SIZE = 10

# 60 game_tick per second
DT = 1 / 60

GAME_CONF = {
    'nb_generation' : (1, int),
    'nb_species' : (50, int),
    'time_limit' : (60, int), # 0 == unlimited (minutes)
    'max_score' : (5000, int)
}

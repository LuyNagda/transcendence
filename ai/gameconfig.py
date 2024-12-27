# Set up the game window
WIDTH = 858
HEIGHT = 525
GRID = 5

# Colors
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RED = (255, 0, 0)

# Paddle settings
PADDLE_HEIGHT = 30
PADDLE_WIDTH = 5
PADDLE_SPEED = 12

# Ball settings
BALL_SPEED = 2
BALL_SIZE = 5
BALL_MIN_DY = 0.5

GAME_CONF = {
    'nb_generation' : (1, int),
    'nb_species' : (50, int),
    'time_limit' : (60, int), # 0 == unlimited (minutes)
    'max_score' : (5000, int)
}

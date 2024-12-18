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
    'nb_generation' : (1000000000000, int),
    'nb_species' : (50, int),
    'time_limit' : (0, int), # 0 == unlimited (minutes)
    'max_score' : (1000, int)
}

DEFAULT_GAME_CONF = GAME_CONF.copy()

def get_game_config(key=None):
    """
    Retrieve game configuration.
    
    Args:
        key (str, optional): Specific configuration key to retrieve.
    
    Returns:
        If key is None: Full configuration dictionary
        If key exists: Tuple of (default_value, type_converter)
    """
    if key is None:
        return GAME_CONF
    
    return GAME_CONF[key]

def set_game_config(**kwargs):
    """
    Update game configuration.
    
    Args:
        **kwargs: Keyword arguments of configuration to update
    """
    global GAME_CONF
    
    for key, value in kwargs.items():
        # Get the type converter for this key (_ means we will ignore the value there)
        _, type_converter = GAME_CONF[key]
        
        # Convert value to appropriate type
        converted_value = type_converter(value)
        
        # Verify the value ask
        match key:
            case 'nb_generation':
                if converted_value < 1 or converted_value > 100:
                    print("error: invalid value: 1 <= nb_generation <= 100")
                    continue
            case 'nb_species':
                if converted_value < 6 or converted_value > 100:
                    print("error: invalid value: 6 <= nb_species <= 100")
                    continue
            case 'time_limit':
                if converted_value < 0 or converted_value > 120:
                    print("error: invalid value: 0 <= time_limit <= 120")
                    continue
            case 'max_score':
                if converted_value < 10 or converted_value > 1000:
                    print("error: invalid value: 10 <= max_score <= 1000")
                    continue

        # Update the configuration
        GAME_CONF[key] = (converted_value, type_converter)

def reset_game_config():
    global GAME_CONF

    GAME_CONF = DEFAULT_GAME_CONF.copy()
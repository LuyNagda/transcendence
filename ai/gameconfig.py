GAME_CONF = {
    'nb_generation' : (1, int),
    'nb_species' : (100, int),
    'time_limit' : (60, int), # 0 == unlimited (minutes)
    'max_score' : (50, int)
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
        # Get the type converter for this key (or keep original)
        _, type_converter = GAME_CONF[key]
        
        # Convert value to appropriate type
        converted_value = type_converter(value)
        
        # Update the configuration
        GAME_CONF[key] = (converted_value, type_converter)

def reset_game_config():
    global GAME_CONF

    GAME_CONF = DEFAULT_GAME_CONF.copy()
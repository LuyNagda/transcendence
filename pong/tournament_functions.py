import random
from typing import List, Tuple, Union
from authentication.models import User

def randomize_and_pair_players(players: List[User]) -> List[Union[Tuple[User, User], Tuple[User, None]]]:
    """
    Randomizes and pairs players with each other. If the number of players is odd,
    one player will be given a bye (paired with None).

    Returns a list of tuples, where each tuple contains two players.
    """
    # Shuffle the list of players
    random.shuffle(players)

    # Pair the players
    pairs = [(players[i], players[i + 1] if i + 1 < len(players) else None) for i in range(0, len(players), 2)]

    return pairs
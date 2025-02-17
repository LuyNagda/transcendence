import random
from typing import List, Tuple, Union
from authentication.models import User
from pong.models import Tournament, Match, PongGame
from django.db.models import F

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

def calculate_rankings(tournament: Tournament) -> List[Tuple[User, dict]]:
    """
    Calculates the player rankings for a given tournament based on completed matches.

    Returns a list of tuples where each tuple contains a player and their stats.
    """
    rankings = {}
    for game in Match.objects.filter(tournament=tournament):
        if game.completed_at:
            if game.pong_game.player1:
                if game.pong_game.player1 not in rankings:
                    rankings[game.pong_game.player1] = {'wins': 0, 'losses': 0, 'points': 0}
            if game.pong_game.player2:
                if game.pong_game.player2 not in rankings:
                    rankings[game.pong_game.player2] = {'wins': 0, 'losses': 0, 'points': 0}
            
            if game.pong_game.player1_score > game.pong_game.player2_score:
                rankings[game.pong_game.player1]['wins'] += 1
                rankings[game.pong_game.player1]['points'] += 3  # 3 points for a win
                rankings[game.pong_game.player2]['losses'] += 1
            else:
                rankings[game.pong_game.player2]['wins'] += 1
                rankings[game.pong_game.player2]['points'] += 3  # 3 points for a win
                rankings[game.pong_game.player1]['losses'] += 1

        # Sort players by points, then by wins
        sorted_rankings = sorted(rankings.items(), key=lambda item: (item[1]['points'], item[1]['wins']), reverse=True)
        return sorted_rankings
    
def total_games_played(player):
    return PongGame.objects.filter(player1=player).count() + PongGame.objects.filter(player2=player).count()

def total_wins(player):
    return PongGame.objects.filter(player1=player, player1_score__gt=F('player2_score')).count() + PongGame.objects.filter(player2=player, player2_score__gt=F('player1_score')).count()

def total_losses(player):
    return PongGame.objects.filter(player1=player, player1_score__lt=F('player2_score')).count() + PongGame.objects.filter(player2=player, player2_score__lt=F('player1_score')).count()

def winrate(player):
    total = total_wins(player) + total_losses(player)
    if total == 0:
        return 0
    return round(total_wins(player) / total, 2) * 100
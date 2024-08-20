from django.db import models
from django.contrib.auth.models import User

class PongGame(models.Model):
    player1 = models.ForeignKey(User, related_name='pong_games_as_player1', on_delete=models.CASCADE)
    player2 = models.ForeignKey(User, related_name='pong_games_as_player2', on_delete=models.CASCADE)
    score_player1 = models.IntegerField(default=0)
    score_player2 = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
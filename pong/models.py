from django.db import models
from authentication.models import User
from django.conf import settings

class PongGame(models.Model):
    class Status(models.TextChoices):
        ONGOING = 'ongoing'
        FINISHED = 'finished'

    room = models.ForeignKey('PongRoom', related_name='games', on_delete=models.CASCADE, null=True, blank=True)
    player1 = models.ForeignKey(User, related_name='player1_games', on_delete=models.CASCADE, null=True, blank=True)
    player2 = models.ForeignKey(User, related_name='player2_games', on_delete=models.CASCADE, null=True, blank=True)
    player2_is_ai = models.BooleanField(default=False)
    player1_score = models.IntegerField(default=0)
    player2_score = models.IntegerField(default=0)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.ONGOING)
    created_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"PONGGAME[{self.id}]: {self.status}"

    def get_state(self):
        return {
            'player1': self.player1.username if self.player1 else 'Unknown',
            'player2': self.player2.username if self.player2 else 'AI',
            'score_player1': self.player1_score,
            'score_player2': self.player2_score,
            'status': self.status,
        }

class PongRoom(models.Model):
    class Mode(models.TextChoices):
        AI = 'ai'
        CLASSIC = 'classic'
        RANKED = 'ranked'
        TOURNAMENT = 'tournament'

    room_id = models.CharField(max_length=10, unique=True)
    max_players = models.IntegerField(default=2)
    players = models.ManyToManyField(User, related_name='pong_room_users')
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.CLASSIC)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"PONGROOM[{self.room_id}]: {self.mode}"

    def get_ongoing_games(self):
        return self.games.filter(status=PongGame.Status.ONGOING)

    def get_finished_games(self):
        return self.games.filter(status=PongGame.Status.FINISHED)

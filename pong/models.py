from django.db import models
from authentication.models import User
from django.conf import settings

class PongGame(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)

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

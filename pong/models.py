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
        AI = 'AI', 'AI'
        CLASSIC = 'CLASSIC', 'Classic'
        RANKED = 'RANKED', 'Ranked'
        TOURNAMENT = 'TOURNAMENT', 'Tournament'

    class State(models.TextChoices):
        LOBBY = 'LOBBY', 'Lobby'
        PLAYING = 'PLAYING', 'Playing'

    room_id = models.CharField(max_length=10, unique=True)
    players = models.ManyToManyField(User, related_name='pong_rooms')
    pending_invitations = models.ManyToManyField(User, related_name='pending_pong_invitations')
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.CLASSIC)
    state = models.CharField(max_length=20, choices=State.choices, default=State.LOBBY)
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_pong_rooms', null=True)

    def __str__(self):
        return f"PONGROOM[{self.room_id}]: {self.mode}"

    def get_ongoing_games(self):
        return self.games.filter(status=PongGame.Status.ONGOING)

    def get_finished_games(self):
        return self.games.filter(status=PongGame.Status.FINISHED)

    @property
    def max_players(self):
        if self.mode == self.Mode.AI:
            return 1
        elif self.mode == self.Mode.TOURNAMENT:
            return 8
        else:
            return 2

    def save(self, *args, **kwargs):
        if self.mode:
            self.mode = self.mode.upper()
            if self.mode not in dict(self.Mode.choices):
                raise ValueError(f"Invalid mode: {self.mode}")
        super().save(*args, **kwargs)

    def serialize(self):
        """Returns a dictionary representation of the room state"""
        return {
            'id': self.room_id,
            'mode': self.mode,
            'owner': self.owner.player_data,
            'players': [player.player_data for player in self.players.all()],
            'pendingInvitations': [user.player_data for user in self.pending_invitations.all()],
            'maxPlayers': self.max_players,
            'state': self.state,
            'availableSlots': self.max_players - self.players.count()
        }

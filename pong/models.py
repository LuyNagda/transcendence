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
    player2_is_guest = models.BooleanField(default=False)
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
            'player2': (self.player2.username if self.player2 else
                        'AI' if self.player2_is_ai else
                        'Guest' if self.player2_is_guest else
                        'Unknown'),
            'score_player1': self.player1_score,
            'score_player2': self.player2_score,
            'status': self.status,
        }

class PongRoom(models.Model):
    class Mode(models.TextChoices):
        AI = 'AI', 'AI Mode'
        LOCAL = 'LOCAL', 'Local Mode'
        CLASSIC = 'CLASSIC', 'Classic Mode'
        TOURNAMENT = 'TOURNAMENT', 'Tournament Mode'

    class State(models.TextChoices):
        LOBBY = 'LOBBY', 'Lobby'
        PLAYING = 'PLAYING', 'Playing'

    room_id = models.CharField(max_length=10, unique=True)
    players = models.ManyToManyField(User, related_name='pong_rooms')
    pending_invitations = models.ManyToManyField(User, related_name='pending_pong_invitations')
    mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.AI)
    state = models.CharField(max_length=20, choices=State.choices, default=State.LOBBY)
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_pong_rooms', null=True)
    settings = models.JSONField(default=dict)

    def __str__(self):
        return f"PONGROOM[{self.room_id}]: {self.mode}"

    def get_ongoing_games(self):
        return self.games.filter(status=PongGame.Status.ONGOING)

    def get_finished_games(self):
        return self.games.filter(status=PongGame.Status.FINISHED)

    @property
    def player_count(self):
        return self.players.count()

    @property
    def is_full(self):
        return self.player_count >= self.max_players
    
    @property
    def is_ai(self):
        return self.mode == self.Mode.AI

    @property
    def is_local(self):
        return self.mode == self.Mode.LOCAL

    @property
    def max_players(self):
        if self.mode == self.Mode.AI or self.mode == self.Mode.LOCAL:
            return 1
        elif self.mode == self.Mode.TOURNAMENT:
            return 8
        else:
            return 2
        
    @property
    def can_start_game(self):
        return self.state == self.State.LOBBY and (
            (self.player_count == 1 and self.mode == self.Mode.AI) or
            (self.player_count == 1 and self.mode == self.Mode.LOCAL) or
            (self.player_count == 2 and self.mode == self.Mode.CLASSIC) or
            (self.player_count >= 3 and self.mode == self.Mode.TOURNAMENT)
        )

    def get_max_players(self):
        return self.max_players

    def save(self, *args, **kwargs):
        if self.mode:
            self.mode = self.mode.upper()
            if self.mode not in dict(self.Mode.choices):
                raise ValueError(f"Invalid mode: {self.mode}")
            
            if not self.settings:
                if self.mode == self.Mode.AI:
                    self.settings = {
                        'ballSpeed': 4,
                        'paddleSpeed': 4,
                        'paddleSize': 5,
                        'maxScore': 11,
                        'aiDifficulty': 'Marvin'
                    }
                else:
                    self.settings = {
                        'ballSpeed': 5,
                        'paddleSpeed': 5,
                        'paddleSize': 5,
                        'maxScore': 11,
                        'aiDifficulty': 'Marvin'
                    }
        super().save(*args, **kwargs)

    def serialize(self):
        return {
            'id': self.room_id,
            'mode': self.mode,
            'state': self.state,
            'owner': {
                'id': self.owner.id,
                'username': self.owner.nick_name
            } if self.owner else None,
            'players': sorted([{
                'id': player.id,
                'username': player.nick_name,
                'isOwner': player.id == self.owner.id if self.owner else False,
            } for player in self.players.all()], key=lambda x: x['id']),
            'pendingInvitations': [{
                'id': user.id,
                'username': user.nick_name
            } for user in self.pending_invitations.all()],
            'maxPlayers': self.max_players,
            'settings': self.settings,
            'canStartGame': self.can_start_game,
            'createdAt': self.created_at.isoformat(),
        }

class Tournament(models.Model):
	class Status(models.TextChoices):
		UPCOMING = 'upcoming'
		ONGOING = 'ongoing'
		FINISHED = 'finished'

	id = models.AutoField(primary_key=True)
	name = models.CharField(max_length=100)
	eliminated = models.ManyToManyField(User, related_name='eliminated_tournaments', blank=True)
	status = models.CharField(max_length=10, choices=Status.choices, default=Status.UPCOMING)
	pong_room = models.OneToOneField(PongRoom, on_delete=models.CASCADE, related_name='tournament')
	pong_games = models.ManyToManyField(PongGame, related_name='tournaments')
	start_date = models.DateTimeField(auto_now_add=True)
	end_date = models.DateTimeField(null=True, blank=True)

	def __str__(self):
		return f"TOURNAMENT[{self.id}]: {self.name} - {self.status}"
    
	def save(self, *args, **kwargs):
		super().save(*args, **kwargs)

	def serialize(self):
		return {
			'id': self.id,
			'name': self.name,
			'status': self.status,
			'pong_room': self.pong_room.id,
			'pong_games': [game.id for game in self.pong_games.all()],
			'start_date': self.created_at.isoformat(),
			'end_date': self.end_date.isoformat() if self.end_date else None,
		}

class Match(models.Model):
    tournament = models.ForeignKey(Tournament, related_name='matches', on_delete=models.CASCADE)
    pong_game = models.OneToOneField(PongGame, on_delete=models.CASCADE)
    round_number = models.IntegerField()
    scheduled_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"MATCH[{self.id}]: Tournament {self.tournament.id} - Round {self.round_number}"

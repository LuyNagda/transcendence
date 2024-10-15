import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import PongRoom, User
from django.template.loader import render_to_string
from django.core.exceptions import ObjectDoesNotExist
from enum import Enum

# Configurez le logger
logger = logging.getLogger(__name__)

class RoomState(Enum):
    LOBBY = 'LOBBY'
    PLAYING = 'PLAYING'

class PongRoomConsumer(AsyncWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._room = None
        self._state = RoomState.LOBBY
        self._players = []
        self._pending_invitations = []
        self._max_players = 0
        self._available_slots = 0

    @property
    def room(self):
        return self._room

    @room.setter
    @database_sync_to_async
    def room(self, value):
        self._room = value
        if value:
            self._room.save()

    @property
    def state(self):
        return self._state

    @state.setter
    @database_sync_to_async
    def state(self, value):
        if isinstance(value, RoomState):
            self._state = value
            # Vous pouvez ajouter ici une logique pour sauvegarder l'état dans la base de données si nécessaire

    @property
    def players(self):
        return self._players

    @players.setter
    @database_sync_to_async
    def players(self, value):
        self._players = value
        if self._room:
            self._room.players.set([User.objects.get(id=player['id']) for player in value])

    @property
    def pending_invitations(self):
        return self._pending_invitations

    @pending_invitations.setter
    @database_sync_to_async
    def pending_invitations(self, value):
        self._pending_invitations = value
        if self._room:
            self._room.pending_invitations.set([User.objects.get(id=inv['id']) for inv in value])

    @property
    def max_players(self):
        return self._max_players

    @max_players.setter
    def max_players(self, value):
        self._max_players = value

    @property
    def available_slots(self):
        return self._available_slots

    @available_slots.setter
    def available_slots(self, value):
        self._available_slots = value

    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'pong_room_{self.room_id}'
        self.user = self.scope["user"]

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        await self.initialize_room()
        await self.update_room_state()

    async def disconnect(self, close_code):
        await self.remove_user_from_room()
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
        await self.update_room_state()

    @database_sync_to_async
    def initialize_room(self):
        try:
            room = PongRoom.objects.get(room_id=self.room_id)
            self.room = room
            self.players = list(room.players.values('id', 'username'))
            self.pending_invitations = list(room.pending_invitations.values('id', 'username'))
            self.max_players = room.max_players
            self.available_slots = max(0, self.max_players - len(self.players) - len(self.pending_invitations))
            room.players.add(self.user)
            return True
        except ObjectDoesNotExist:
            return False

    @database_sync_to_async
    def remove_user_from_room(self):
        if self.room:
            self.room.players.remove(self.user)
            self.players = list(self.room.players.values('id', 'username'))
            self.available_slots = max(0, self.max_players - len(self.players) - len(self.pending_invitations))

    async def receive(self, text_data):
        data = json.loads(text_data)
        action = data.get('action')

        if action == 'invite_friend':
            await self.invite_friend(data['friend_id'])
        elif action == 'cancel_invitation':
            await self.cancel_invitation(data['invitation_id'])
        elif action == 'kick_player':
            await self.kick_player(data['player_id'])
        elif action == 'change_mode':
            success = await self.change_mode(data['mode'])
            if success:
                await self.update_room_state()
        elif action == 'start_game':
            await self.start_game()

    @database_sync_to_async
    def invite_friend(self, friend_id):
        friend = User.objects.get(id=friend_id)
        if len(self.players) + len(self.pending_invitations) < self.max_players:
            self.room.pending_invitations.add(friend)
            self.pending_invitations = list(self.room.pending_invitations.values('id', 'username'))
            self.available_slots = max(0, self.max_players - len(self.players) - len(self.pending_invitations))
            return True
        return False

    @database_sync_to_async
    def cancel_invitation(self, invitation_id):
        invitation = User.objects.get(id=invitation_id)
        self.room.pending_invitations.remove(invitation)
        self.pending_invitations = list(self.room.pending_invitations.values('id', 'username'))
        self.available_slots = max(0, self.max_players - len(self.players) - len(self.pending_invitations))

    @database_sync_to_async
    def kick_player(self, player_id):
        if self.user == self.room.owner:
            player = User.objects.get(id=player_id)
            self.room.players.remove(player)
            self.players = list(self.room.players.values('id', 'username'))
            self.available_slots = max(0, self.max_players - len(self.players) - len(self.pending_invitations))
            return True
        return False

    @database_sync_to_async
    def change_mode(self, mode):
        if self.user == self.room.owner:
            self.room.mode = mode
            self.room.save()
            self.max_players = self.room.max_players
            self.available_slots = max(0, self.max_players - len(self.players) - len(self.pending_invitations))
            return True
        return False

    @database_sync_to_async
    def start_game(self):
        if self.user == self.room.owner and len(self.players) >= 2:
            self.state = RoomState.PLAYING
            # Logique pour démarrer le jeu
            return True
        return False

    async def update_room_state(self):
        room_state = await self.get_room_state()
        html = await self.render_room_state(room_state)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send_room_update',
                'html': html,
                'room_state': room_state
            }
        )

    @database_sync_to_async
    def get_room_state(self):
        return {
            'mode': self.room.get_mode_display(),
            'owner': self.room.owner.username,
            'players': self.players,
            'pending_invitations': self.pending_invitations,
            'max_players': self.max_players,
            'available_slots': self.available_slots,
            'state': self.state.value,
        }

    @database_sync_to_async
    def render_room_state(self, room_state):
        return render_to_string('pong/components/room_state.html', {
            'room_state': room_state,
            'current_user': self.user
        })

    async def send_room_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'room_update',
            'html': event['html'],
            'room_state': event['room_state']
        }))

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        await self.channel_layer.group_add(
            f"user_{self.user.id}",
            self.channel_name
        )
        
        # Joindre tous les groupes de salles dont l'utilisateur fait partie
        rooms = self.user.pong_rooms.all()
        for room in rooms:
            await self.channel_layer.group_add(f"room_{room.room_id}", self.channel_name)
        
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            f"user_{self.user.id}",
            self.channel_name
        )
        
        rooms = self.user.pong_rooms.all()
        for room in rooms:
            await self.channel_layer.group_discard(f"room_{room.room_id}", self.channel_name)

    async def receive(self, text_data):
        pass

    async def send_notification(self, event):
        await self.send(text_data=json.dumps(event))

    async def send_notification(self, user_id, message):
        await self.channel_layer.group_send(
            f"user_{user_id}",
            {
                'type': 'send_notification',
                'message': message
            }
        )

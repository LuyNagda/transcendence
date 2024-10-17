import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import PongRoom, User
from django.core.exceptions import ObjectDoesNotExist
from enum import Enum
from django.contrib.auth import get_user_model
import jwt
from django.conf import settings

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
        self.user = None  # Initialiser l'attribut user
        
        logger.info(f"Tentative de connexion: room_id={self.room_id}")
        
        # Authentification de l'utilisateur
        query_string = self.scope['query_string'].decode()
        token = query_string.split('=')[1] if '=' in query_string else None
        
        if not token:
            logger.error("Token manquant dans la requête WebSocket")
            await self.close()
            return

        try:
            User = get_user_model()
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
            user_id = payload['user_id']
            self.user = await self.get_user(user_id)
            logger.info(f"Utilisateur authentifié: user_id={user_id}")
        except jwt.DecodeError:
            logger.error("Token JWT invalide")
            await self.close()
            return
        except Exception as e:
            logger.error(f"Échec de l'authentification: {str(e)}")
            await self.close()
            return

        if self.user is None or self.user.is_anonymous:
            logger.warning(f"Tentative de connexion d'un utilisateur anonyme ou inexistant: room_id={self.room_id}")
            await self.close()
            return

        try:
            self.room = await self.get_room()
            if not self.room:
                logger.error(f"Salle non trouvée: room_id={self.room_id}")
                await self.close()
                return

            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.accept()
            await self.update_room()
            logger.info(f"Connexion réussie: user={self.user}, room_id={self.room_id}")
        except Exception as e:
            logger.error(f"Erreur lors de la connexion: {str(e)}")
            await self.close()

    async def disconnect(self, close_code):
        logger.info(f"Déconnexion: user={self.user}, room_id={self.room_id}, close_code={close_code}")
        await self.remove_user_from_room()
        await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        await self.update_room()

    @database_sync_to_async
    def initialize_room(self):
        try:
            room = PongRoom.objects.get(room_id=self.room_id)
            self.room = room
            self.players = list(room.players.values('id', 'username'))
            self.pending_invitations = list(room.pending_invitations.values('id', 'username'))
            self.max_players = room.max_players
            self.available_slots = max(0, self.max_players - len(self.players) - len(self.pending_invitations))
            
            User = get_user_model()
            user = User.objects.get(id=self.scope["user"].id)
            
            room.players.add(user)
            self.players = list(room.players.values('id', 'username'))
            self.available_slots = max(0, self.max_players - len(self.players) - len(self.pending_invitations))
            return True
        except PongRoom.DoesNotExist:
            logger.error(f"Room not found: room_id={self.room_id}")
            return False
        except Exception as e:
            logger.error(f"Error in initialize_room: {str(e)}")
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
        logger.info(f"Message reçu: user={self.user}, room_id={self.room_id}, action={action}")

        if action == 'invite_friend':
            success = await self.invite_friend(data['friend_id'])
            logger.info(f"Invitation ami: user={self.user}, friend_id={data['friend_id']}, success={success}")
            if success:
                await self.update_room()
        elif action == 'cancel_invitation':
            await self.cancel_invitation(data['invitation_id'])
            logger.info(f"Annulation invitation: user={self.user}, invitation_id={data['invitation_id']}")
            await self.update_room()
        elif action == 'kick_player':
            success = await self.kick_player(data['player_id'])
            logger.info(f"Expulsion joueur: user={self.user}, player_id={data['player_id']}, success={success}")
            if success:
                await self.update_room()
        elif action == 'change_mode':
            success = await self.change_mode(data['mode'])
            logger.info(f"Changement de mode: user={self.user}, mode={data['mode']}, success={success}")
            if success:
                await self.update_room()
        elif action == 'start_game':
            success = await self.start_game()
            logger.info(f"Démarrage du jeu: user={self.user}, success={success}")
            if success:
                await self.update_room()

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

    async def update_room(self):
        room_state = await self.get_room_state()
        if room_state is None:
            logger.error(f"Tentative de mise à jour d'une salle inexistante: user={self.user}, room_id={self.room_id}")
            await self.close()
            return
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send_room_update',
                'room_state': room_state
            }
        )
        logger.info(f"Mise à jour de la salle envoyée: room_id={self.room_id}")

    @database_sync_to_async
    def get_room_state(self):
        if self.room is None:
            return None
        return {
            'room_id': self.room.room_id,
            'mode': self.room.get_mode_display(),
            'owner': self.room.owner.username,
            'players': self.players,
            'pending_invitations': self.pending_invitations,
            'max_players': self.max_players,
            'available_slots': self.available_slots,
            'state': self.state.value,
        }

    async def send_room_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'room_update',
            'room_state': event['room_state']
        }))
        logger.info(f"Mise à jour de la salle envoyée au client: user={self.user}, room_id={self.room_id}")

    @database_sync_to_async
    def get_room(self):
        try:
            return PongRoom.objects.get(room_id=self.room_id)
        except PongRoom.DoesNotExist:
            return None

    @database_sync_to_async
    def get_user(self, user_id):
        User = get_user_model()
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        logger.info(f"Connexion au consommateur de notifications: user={self.user}")
        await self.channel_layer.group_add(f"user_{self.user.id}", self.channel_name)
        
        rooms = self.user.pong_rooms.all()
        for room in rooms:
            await self.channel_layer.group_add(f"room_{room.room_id}", self.channel_name)
            logger.info(f"Utilisateur ajouté au groupe de la salle: user={self.user}, room_id={room.room_id}")
        
        await self.accept()
        logger.info(f"Connexion au consommateur de notifications acceptée: user={self.user}")

    async def disconnect(self, close_code):
        logger.info(f"Déconnexion du consommateur de notifications: user={self.user}, close_code={close_code}")
        await self.channel_layer.group_discard(f"user_{self.user.id}", self.channel_name)
        
        rooms = self.user.pong_rooms.all()
        for room in rooms:
            await self.channel_layer.group_discard(f"room_{room.room_id}", self.channel_name)
            logger.info(f"Utilisateur retiré du groupe de la salle: user={self.user}, room_id={room.room_id}")

    async def receive(self, text_data):
        logger.info(f"Message reçu par le consommateur de notifications: user={self.user}, data={text_data}")

    async def send_notification(self, event):
        await self.send(text_data=json.dumps(event))
        logger.info(f"Notification envoyée: user={self.user}, event={event}")

    async def send_notification(self, user_id, message):
        await self.channel_layer.group_send(
            f"user_{user_id}",
            {
                'type': 'send_notification',
                'message': message
            }
        )
        logger.info(f"Notification envoyée à l'utilisateur: user_id={user_id}, message={message}")

import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import PongRoom
from django.contrib.auth import get_user_model
from channels.exceptions import DenyConnection
from django.core.exceptions import ObjectDoesNotExist
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)

User = get_user_model()


class PongGameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        self.game_id = self.scope['url_route']['kwargs']['game_id']
        self.game_group_name = f'pong_game_{self.game_id}'

        logger.info('Game WebSocket connection attempt', extra={
            'user_id': getattr(self.user, 'id', None),
            'game_id': self.game_id,
        })

        if not self.user or self.user.is_anonymous:
            logger.warning("Unauthorized game connection attempt", extra={'game_id': self.game_id})
            raise DenyConnection("User not authenticated")

        try:
            self.game = await self.get_game()
            if not self.game:
                logger.error(f"Game not found: game_id={self.game_id}")
                raise DenyConnection("Game not found")

            # Vérifier si l'utilisateur est un des joueurs
            if self.user not in [self.game.player1, self.game.player2]:
                logger.error(f"User {self.user.id} not authorized for game {self.game_id}")
                raise DenyConnection("Not a player in this game")

            await self.channel_layer.group_add(self.game_group_name, self.channel_name)
            await self.accept()
            await self.send_player_ready()
            
        except Exception as e:
            logger.error(f"Error during game connection: {str(e)}")
            await self.close()

    async def disconnect(self, close_code):
        logger.info(f"Game disconnection: user={self.user}, game_id={self.game_id}, close_code={close_code}")
        if hasattr(self, 'game'):
            await self.channel_layer.group_discard(self.game_group_name, self.channel_name)
            # Notifier l'autre joueur de la déconnexion
            await self.notify_player_disconnected()

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'webrtc_signal':
                # Transmettre le signal WebRTC à l'autre joueur
                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'relay_webrtc_signal',
                        'signal': data.get('signal'),
                        'from_user': self.user.id
                    }
                )
            elif message_type == 'game_finished':
                # Mettre à jour le score et l'état de la partie
                await self.update_game_state(
                    data.get('player1_score'),
                    data.get('player2_score'),
                    'finished'
                )

        except json.JSONDecodeError:
            logger.error(f'Invalid game JSON data: {text_data}')
        except Exception as e:
            logger.error(f'Game error: {str(e)}, data: {text_data}')

    async def relay_webrtc_signal(self, event):
        # Vérifier que le signal provient bien d'un des joueurs
        sender_id = event['from_user']
        if sender_id not in [self.game.player1.id, self.game.player2.id]:
            logger.error(f"Unauthorized WebRTC signal from user {sender_id}")
            return

        # Ne pas renvoyer le signal au joueur qui l'a émis
        if sender_id != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'webrtc_signal',
                'signal': event['signal'],
                'from_user': sender_id
            }))

    @database_sync_to_async
    def get_game(self):
        try:
            return PongGame.objects.get(id=self.game_id)
        except PongGame.DoesNotExist:
            return None

    @database_sync_to_async
    def update_game_state(self, player1_score, player2_score, status):
        if self.game:
            self.game.player1_score = player1_score
            self.game.player2_score = player2_score
            self.game.status = status
            if status == 'finished':
                self.game.finished_at = timezone.now()
            self.game.save()

    async def send_player_ready(self):
        await self.channel_layer.group_send(
            self.game_group_name,
            {
                'type': 'player_ready',
                'user_id': self.user.id
            }
        )

    async def player_ready(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player_ready',
            'user_id': event['user_id']
        }))

    async def notify_player_disconnected(self):
        await self.channel_layer.group_send(
            self.game_group_name,
            {
                'type': 'player_disconnected',
                'user_id': self.user.id
            }
        )

    async def player_disconnected(self, event):
        await self.send(text_data=json.dumps({
            'type': 'player_disconnected',
            'user_id': event['user_id']
        }))

class PongRoomConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'pong_room_{self.room_id}'

        logger.info('WebSocket connection attempt', extra={
            'user_id': getattr(self.user, 'id', None),
            'room_id': self.room_id,
            'authenticated': self.user.is_authenticated
        })

        if not self.user or self.user.is_anonymous:
            logger.warning("Unauthorized connection attempt", extra={'room_id': self.room_id})
            raise DenyConnection("User not authenticated")

        try:
            self.room = await self.get_room()
            if not self.room:
                logger.error(f"Room not found: room_id={self.room_id}")
                raise DenyConnection("Room not found")

            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.accept()
            logger.info(f"WebSocket connection accepted for user {self.user} in room {self.room_id}")
            
            success, message = await self.add_user_to_room()
            if success:
                await self.update_room()
                logger.info(f"Connection successful: user={self.user}, room_id={self.room_id}, message={message}")
            else:
                logger.error(f"Failed to add user to room: user={self.user}, room_id={self.room_id}, message={message}")
                await self.close()
        except Exception as e:
            logger.error(f"Error during connection: {str(e)}")
            await self.close()

    async def disconnect(self, close_code):
        logger.info(f"Disconnection: user={self.user}, room_id={self.room_id}, close_code={close_code}")
        if hasattr(self, 'room'):
            await self.remove_user_from_room()
            await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
            await self.update_room()

    async def receive(self, text_data):
        logger.debug(f"Receive method called with data: {text_data}")
        try:
            logger.debug(f"Raw data received: {text_data}")
            data = json.loads(text_data)
            message_id = data.get('id')
            action = data.get('action')
            logger.info(f"Message received: user={self.user}, room_id={self.room_id}, action={action}, message_id={message_id}, data={data}")

            if action == 'update_property':
                property = data.get('property')
                value = data.get('value')
                logger.info(f"Updating property: {property} with value: {value}")  # Ajout de ce log
                success = await self.update_room_property(property, value)
                if success:
                    await self.update_room()
                    response = {'id': message_id, 'status': 'success', 'message': f'Property {property} updated'}
                else:
                    response = {'id': message_id, 'status': 'error', 'message': f'Failed to update property {property}'}
            elif action == 'invite_friend':
                success = await self.invite_friend(data['friend_id'])
                if success:
                    await self.update_room()
                    response = {'id': message_id, 'status': 'success', 'message': 'Friend invited'}
                else:
                    response = {'id': message_id, 'status': 'error', 'message': 'Failed to invite friend'}
            elif action == 'cancel_invitation':
                await self.cancel_invitation(data['invitation_id'])
                await self.update_room()
                response = {'id': message_id, 'status': 'success', 'message': 'Invitation cancelled'}
            elif action == 'kick_player':
                success = await self.kick_player(data['player_id'])
                if success:
                    await self.update_room()
                    response = {'id': message_id, 'status': 'success', 'message': 'Player kicked'}
                else:
                    response = {'id': message_id, 'status': 'error', 'message': 'Failed to kick player'}
            elif action == 'change_mode':
                success = await self.change_mode(data['mode'])
                if success:
                    await self.update_room()
                    response = {'id': message_id, 'status': 'success', 'message': 'Mode changed'}
                else:
                    response = {'id': message_id, 'status': 'error', 'message': 'Failed to change mode'}
            elif action == 'start_game':
                game = await self.create_game()
                if game:
                    # Notifier tous les joueurs que la partie commence
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'game_started',
                            'game_id': game.id,
                            'player1_id': game.player1.id,
                            'player2_id': game.player2.id
                        }
                    )
                    response = {'id': data.get('id'), 'status': 'success', 'game_id': game.id}
                else:
                    response = {'id': data.get('id'), 'status': 'error', 'message': 'Failed to create game'}
                await self.send(text_data=json.dumps(response))
            else:
                logger.warning(f"Unknown action received: {action}")

            logger.info(f"Sending response: {response}")
            await self.send(text_data=json.dumps(response))

        except json.JSONDecodeError:
            logger.error(f'Received invalid JSON data: {text_data}', extra={'user_id': self.user.id, 'room_id': self.room_id})
        except KeyError as e:
            logger.error(f'Missing key in received data: {text_data}', extra={'user_id': self.user.id, 'room_id': self.room_id, 'missing_key': str(e)})
        except Exception as e:
            logger.error(f'Unexpected error: {str(e)}, data: {text_data}', extra={'user_id': self.user.id, 'room_id': self.room_id})

    @database_sync_to_async
    def get_room(self):
        try:
            return PongRoom.objects.get(room_id=self.room_id)
        except PongRoom.DoesNotExist:
            return None

    @database_sync_to_async
    def add_user_to_room(self):
        if self.room:
            if self.user not in self.room.players.all():
                self.room.players.add(self.user)
                return True, "User added to room"
            else:
                return True, "User already in room"
        return False, "Room not found"

    @database_sync_to_async
    def remove_user_from_room(self):
        if self.room:
            self.room.players.remove(self.user)

    @database_sync_to_async
    def get_room_state(self):
        if self.room is None:
            return None
        
        def user_to_dict(user):
            return {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'profile_picture': user.profile_picture.url if user.profile_picture else None,
                # Ajoutez d'autres champs d'utilisateur selon vos besoins
            }
        
        return {
            'room_id': self.room.room_id,
            'mode': self.room.mode,
            'owner': user_to_dict(self.room.owner),
            'players': [user_to_dict(player) for player in self.room.players.all()],
            'pending_invitations': [user_to_dict(user) for user in self.room.pending_invitations.all()],
            'max_players': self.room.max_players,
            'available_slots': self.room.max_players - self.room.players.count() - self.room.pending_invitations.count(),
            'state': self.room.state,
        }

    async def update_room(self, event=None):
        room_state = await self.get_room_state()
        if room_state is None:
            logger.error(f"Attempt to update non-existent room: user={self.user}, room_id={self.room_id}")
            await self.close()
            return
        
        logger.info(f"Room state update: room_id={self.room_id}")
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'send_room_update',
                'room_state': room_state
            }
        )
        logger.info(f"Room update sent to group: room_id={self.room_id}")

    async def send_room_update(self, event):
        room_state = event['room_state']
        await self.send(text_data=json.dumps({
            'type': 'room_update',
            'room_state': room_state
        }))

    @database_sync_to_async
    def create_game(self):
        """Crée une nouvelle partie pour la room"""
        try:
            if self.room.players.count() < 2:
                logger.error("Not enough players to start game")
                return None

            if self.room.state != 'LOBBY':
                logger.error("Room not in LOBBY state")
                return None

            # Sélectionner le deuxième joueur
            player2 = next(player for player in self.room.players.all() 
                         if player != self.room.owner)
            
            # Créer la partie
            game = PongGame.objects.create(
                room=self.room,
                player1=self.room.owner,
                player2=player2,
                status='ongoing'
            )

            # Mettre à jour l'état de la room
            self.room.state = 'PLAYING'
            self.room.save()
            
            logger.info(f"Game created: {game.id} for room {self.room.id}")
            return game

        except Exception as e:
            logger.error(f"Error creating game: {str(e)}")
            return None

    async def game_started(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_started',
            'game_id': event['game_id'],
            'player1_id': event['player1_id'],
            'player2_id': event['player2_id']
        }))

    @database_sync_to_async
    def update_room_property(self, property, value):
        if self.room:
            logger.info(f"Updating room property: {property} with value: {value}")
            try:
                old_value = getattr(self.room, property, None)
                if property == 'owner':
                    user = User.objects.get(id=value['id'])
                    self.room.owner = user
                elif property == 'players':
                    player_ids = [player['id'] for player in value]
                    self.room.players.set(User.objects.filter(id__in=player_ids))
                elif property == 'pending_invitations':
                    invitation_ids = [inv['id'] for inv in value]
                    self.room.pending_invitations.set(User.objects.filter(id__in=invitation_ids))
                elif property == 'mode':
                    logger.info(f"Changing mode from {self.room.mode} to {value}")  # Ajout de ce log
                    self.room.mode = value
                elif property == 'max_players':
                    self.room.max_players = value
                elif property == 'state':
                    self.room.state = value
                else:
                    logger.warning(f"Tentative de mise à jour d'une propriété inconnue : {property}")
                    return False
                
                self.room.save()
                
                new_value = getattr(self.room, property, None)
                logger.info(f"Property '{property}' updated: {old_value} -> {new_value}")
                
                # Déclencher une mise à jour asynchrone de la room
                async_to_sync(self.channel_layer.group_send)(
                    self.room_group_name,
                    {
                        'type': 'update_room',
                    }
                )
                
                return True
            except ObjectDoesNotExist:
                logger.error(f"Objet non trouvé lors de la mise à jour de la propriété {property}")
                return False
            except Exception as e:
                logger.error(f"Erreur lors de la mise à jour de la propriété {property}: {str(e)}")
                return False
        return False

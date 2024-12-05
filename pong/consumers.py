import json, traceback, logging
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import async_to_sync
from contextlib import asynccontextmanager
from django.contrib.auth import get_user_model
from .models import PongRoom, PongGame

logger = logging.getLogger(__name__)

User = get_user_model()

@asynccontextmanager
async def channel_layer_lock(channel_layer, lock_name, timeout=10):
    """
    Async context manager for distributed locking using channel layer.
    """
    lock_group = f"lock_{lock_name}"
    try:
        await channel_layer.group_add(lock_group, "lock_holder")
        yield
    finally:
        await channel_layer.group_discard(lock_group, "lock_holder")

class PongGameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            self.connection_state = 'initializing'
            self.user = self.scope.get("user")
            self.game_id = self.scope['url_route']['kwargs']['game_id']
            self.game_group_name = f'pong_game_{self.game_id}'

            logger.info('Game WebSocket connection attempt', extra={
                'user_id': getattr(self.user, 'id', None),
                'game_id': self.game_id,
                'connection_state': self.connection_state
            })

            # 1. Authentication check
            if not self.user or self.user.is_anonymous:
                logger.warning("Unauthorized game connection attempt", extra={
                    'game_id': self.game_id,
                    'user': str(self.user)
                })
                await self.close(code=4001)
                return

            # Update state to validating
            self.connection_state = 'validating'

            try:
                # 2. Get and validate game
                self.game = await self.get_game()
                if not self.game:
                    logger.error(f"Game not found: game_id={self.game_id}")
                    await self.close(code=4004)
                    return

                # 3. Validate connecting user is participant
                is_player = (self.user == self.game.player1) or (self.user == self.game.player2)
                if not is_player and not self.game.player2_is_ai:
                    logger.error("User not authorized for game", extra={
                        'user_id': self.user.id,
                        'game_id': self.game_id,
                        'player1_id': self.game.player1.id,
                        'player2_id': getattr(self.game.player2, 'id', None),
                        'is_ai': self.game.player2_is_ai
                    })
                    await self.close(code=4003)
                    return

                # 4. Check game status
                if self.game.status != 'ongoing':
                    logger.error("Game is not in ongoing state, mostly finished", extra={
                        'game_id': self.game_id,
                        'status': self.game.status
                    })
                    await self.close(code=4005)
                    return

                # Update state to validated
                self.connection_state = 'validated'

                # 5. Add to game group and accept connection using a lock
                async with channel_layer_lock(self.channel_layer, f"game_{self.game_id}_connect"):
                    await self.channel_layer.group_add(self.game_group_name, self.channel_name)
                    await self.accept()
                    
                    # Update state to connected
                    self.connection_state = 'connected'
                    
                    # 6. Send initial game state with AI player info if applicable
                    game_state = await self.get_game_state()
                    await self.send(text_data=json.dumps({
                        'type': 'game_state',
                        'state': game_state,
                        'is_host': self.user == self.game.player1,
                        'connection_state': self.connection_state
                    }))
                    
                    # 7. Notify other players about connection
                    await self.notify_player_ready({
                        'user_id': self.user.id,
                        'username': self.user.username,
                        'is_host': self.user == self.game.player1,
                        'is_ai_opponent': self.game.player2_is_ai
                    })

                    logger.info("WebSocket connection accepted", extra={
                        'user_id': self.user.id,
                        'game_id': self.game_id,
                        'is_host': self.user == self.game.player1,
                        'connection_state': self.connection_state
                    })

            except ObjectDoesNotExist as e:
                logger.error("Game or related object not found", extra={
                    'error': str(e),
                    'game_id': self.game_id,
                    'connection_state': self.connection_state
                })
                await self.close(code=4004)
            except Exception as e:
                logger.error("Error during game validation", extra={
                    'error_type': type(e).__name__,
                    'error_message': str(e),
                    'traceback': traceback.format_exc(),
                    'connection_state': self.connection_state
                })
                await self.close(code=4002)

        except Exception as e:
            logger.error("Critical error during connection", extra={
                'error_type': type(e).__name__,
                'error_message': str(e),
                'traceback': traceback.format_exc(),
                'connection_state': getattr(self, 'connection_state', 'unknown')
            })
            await self.close(code=4002)

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

    async def disconnect(self, close_code):
        logger.info("Game disconnection", extra={
            'user_id': getattr(self.user, 'id', None),
            'game_id': getattr(self, 'game_id', None),
            'close_code': close_code
        })
        
        if hasattr(self, 'game_group_name'):
            try:
                # Remove from game group
                await self.channel_layer.group_discard(
                    self.game_group_name,
                    self.channel_name
                )
                
                if hasattr(self, 'game') and hasattr(self, 'user') and not self.user.is_anonymous:
                    # Notify other players about disconnection
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'player_disconnected',
                            'user_id': self.user.id
                        }
                    )
                    
                    # Update game status if needed
                    await self.update_game_on_disconnect()

            except Exception as e:
                logger.error("Error during disconnect cleanup", extra={
                    'error': str(e),
                    'traceback': traceback.format_exc(),
                    'game_id': getattr(self, 'game_id', None)
                })

    @database_sync_to_async
    def get_game(self):
        try:
            return PongGame.objects.select_related('player1', 'player2').get(id=self.game_id)
        except PongGame.DoesNotExist:
            return None

    @database_sync_to_async
    def get_game_state(self):
        """Get current game state with AI player handling"""
        return {
            'player1': {
                'id': self.game.player1.id,
                'username': self.game.player1.username,
                'is_connected': True
            },
            'player2': {
                'id': self.game.player2.id if self.game.player2 else None,
                'username': self.game.player2.username if self.game.player2 else 'AI',
                'is_connected': not self.game.player2_is_ai,
                'is_ai': self.game.player2_is_ai
            },
            'scores': {
                'player1': self.game.player1_score,
                'player2': self.game.player2_score
            },
            'status': self.game.status,
            'is_ai_game': self.game.player2_is_ai
        }
    
    @database_sync_to_async
    def update_game_state(self, player1_score, player2_score, status):
        if self.game:
            self.game.player1_score = player1_score
            self.game.player2_score = player2_score
            self.game.status = status
            if status == 'finished':
                self.game.finished_at = timezone.now()
            self.game.save()

    async def notify_player_ready(self, event):
        self.send(text_data=json.dumps({
            'type': 'player_ready',
            'user_id': event['user_id'],
            'username': event['username'],
            'is_host': event['is_host'],
            'is_ai_opponent': event.get('is_ai_opponent', False),
            'connection_state': self.connection_state
        }))

    @database_sync_to_async
    def update_game_on_disconnect(self):
        """Update game status when a player disconnects"""
        if self.game.status == 'ongoing':
            self.game.status = 'finished'
            # Set winner as the other player
            if self.user == self.game.player1:
                self.game.player2_score = 11  # Win score
            else:
                self.game.player1_score = 11
            self.game.finished_at = timezone.now()
            self.game.save()

            # Reset room state to LOBBY
            if self.game.room:
                self.game.room.state = 'LOBBY'
                self.game.room.save()

class PongRoomConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope.get("user")
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group_name = f'pong_room_{self.room_id}'

        logger.info('WebSocket connection attempt', extra={
            'user_id': getattr(self.user, 'id', None),
            'room_id': self.room_id,
            'authenticated': self.user.is_authenticated,
            'scope_details': {
                'type': self.scope.get('type'),
                'path': self.scope.get('path'),
                'raw_path': self.scope.get('raw_path'),
                'headers': dict(self.scope.get('headers', [])),
            }
        })

        if not self.user or self.user.is_anonymous:
            logger.warning("Unauthorized connection attempt", extra={'room_id': self.room_id})
            await self.close(code=4001)
            return

        try:
            self.room = await self.get_room()
            if not self.room:
                logger.error(f"Room not found: room_id={self.room_id}")
                await self.close(code=4004)
                return

            # Add to group before accepting
            await self.channel_layer.group_add(self.room_group_name, self.channel_name)
            await self.accept()
            logger.info(f"WebSocket connection accepted for user {self.user} in room {self.room_id}")
            
            success, message = await self.add_user_to_room()
            if success:
                await self.update_room()
                logger.info(f"Connection successful: user={self.user}, room_id={self.room_id}, message={message}")
            else:
                logger.error(f"Failed to add user to room: user={self.user}, room_id={self.room_id}, message={message}")
                await self.close(code=4003)
                
        except Exception as e:
            logger.error(f"Error during connection", extra={
                'error_type': type(e).__name__,
                'error_message': str(e),
                'traceback': traceback.format_exc(),
                'user_id': getattr(self.user, 'id', None),
                'room_id': self.room_id
            })
            await self.close(code=4002)

    async def disconnect(self, close_code):
        logger.info(f"Disconnection", extra={
            'user_id': getattr(self.user, 'id', None),
            'room_id': getattr(self, 'room_id', None),
            'close_code': close_code,
            'has_room': hasattr(self, 'room'),
            'has_group': hasattr(self, 'room_group_name')
        })
        
        try:
            if hasattr(self, 'room'):
                await self.remove_user_from_room()
            if hasattr(self, 'room_group_name') and hasattr(self, 'channel_name'):
                await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
                await self.update_room()
        except Exception as e:
            logger.error(f"Error during disconnect", extra={
                'error_type': type(e).__name__,
                'error_message': str(e),
                'traceback': traceback.format_exc()
            })

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
                    event_data = {
                        'type': 'game_started',
                        'game_id': game.id,
                        'player1_id': game.player1.id,
                        'is_ai_game': game.player2_is_ai
                    }
                    if game.player2:
                        event_data['player2_id'] = game.player2.id
                    
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        event_data
                    )
                    response = {'id': data.get('id'), 'status': 'success', 'game_id': game.id}
                else:
                    response = {'id': data.get('id'), 'status': 'error', 'message': 'Failed to create game'}
            else:
                logger.warning(f"Unknown action received: {action}")
                response = {'id': message_id, 'status': 'error', 'message': f'Unknown action: {action}'}

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
            }
        
        return {
            'id': self.room.room_id,
            'mode': self.room.mode,
            'owner': user_to_dict(self.room.owner),
            'players': [user_to_dict(player) for player in self.room.players.all()],
            'pendingInvitations': [user_to_dict(user) for user in self.room.pending_invitations.all()],
            'maxPlayers': self.room.max_players,
            'state': self.room.state,
            'currentUser': user_to_dict(self.user),
            'availableSlots': self.room.max_players - self.room.players.count()
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
            'room_state': room_state,
            'trigger_htmx': True
        }))

    @database_sync_to_async
    def create_game(self):
        """Creates a new game for the room"""
        try:
            if self.room.mode != 'AI' and self.room.players.count() < 2:
                logger.error("Not enough players to start game")
                return None

            if self.room.state != 'LOBBY':
                logger.error("Room not in LOBBY state")
                return None
            
            self.room.state = 'PLAYING'
            self.room.save()

            player2 = None
            player2_is_ai = self.room.mode == 'AI'
            
            if not player2_is_ai:
                player2 = next(player for player in self.room.players.all() 
                             if player != self.room.owner)
            
            game = PongGame.objects.create(
                room=self.room,
                player1=self.room.owner,
                player2=player2,
                player2_is_ai=player2_is_ai,
                status='ongoing'
            )
            
            logger.info(f"Game created: {game.id} for room {self.room.id}")
            return game

        except Exception as e:
            logger.error(f"Error creating game: {str(e)}")
            # Revert room state if game creation fails
            self.room.state = 'LOBBY'
            self.room.save()
            return None

    async def game_started(self, event):
        response_data = {
            'type': 'game_started',
            'game_id': event['game_id'],
            'player1_id': event['player1_id'],
            'is_ai_game': event.get('is_ai_game', False)
        }
        if 'player2_id' in event:
            response_data['player2_id'] = event['player2_id']

        await self.send(text_data=json.dumps(response_data))

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

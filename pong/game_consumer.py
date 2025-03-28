import json, traceback, logging
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from contextlib import asynccontextmanager
from django.contrib.auth import get_user_model
from .models import PongGame

logger = logging.getLogger(__name__)
User = get_user_model()

@asynccontextmanager
async def channel_layer_lock(channel_layer, lock_name, timeout=10):
    """Provides distributed locking using Django Channels layer"""
    lock_group = f"lock_{lock_name}"
    try:
        await channel_layer.group_add(lock_group, "lock_holder")
        yield
    finally:
        await channel_layer.group_discard(lock_group, "lock_holder")

class PongGameConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for Pong game sessions.
    
    Handles:
    - Connection setup and validation
    - Game state updates and notifications
    - Player disconnection cleanup
    - Direct physics state transport via WebSocket
    """

    async def connect(self):
        """
        Establishes WebSocket connection for a game session.
        
        Flow:
        1. Authenticate user
        2. Validate game exists and is active
        3. Verify user is a valid player
        4. Join game channel group
        5. Send initial state
        6. Notify other players
        """
        try:
            self.connection_state = 'initializing'
            self.user = self.scope.get("user")
            self.game_id = self.scope['url_route']['kwargs']['game_id']
            self.game_group_name = f'pong_game_{self.game_id}'

            logger.info(f'[Game {self.game_id}] Game WebSocket connection attempt - connection_state: {self.connection_state}', extra={
                'user_id': getattr(self.user, 'id', None)
            })

            # 1. Authentication check
            if not self.user or self.user.is_anonymous:
                logger.warning(f"[Game {self.game_id}] Unauthorized game connection attempt", extra={
                    'user_id': None
                })
                await self.close(code=4001)
                return

            self.connection_state = 'validating'

            try:
                # 2. Get and validate game
                self.game = await self.get_game()
                if not self.game:
                    logger.error(f"Game not found: game_id={self.game_id}", extra={
                        'user_id': self.user.id
                    })
                    await self.close(code=4004)
                    return

                # 3. Determine and validate role (host/guest)
                self.is_host = self.user == self.game.player1
                self.is_guest = self.user == self.game.player2 or self.game.player2_is_ai or self.game.player2_is_guest

                if not self.is_host and not self.is_guest:
                    logger.error(f"[Game {self.game_id}] User not authorized for game - player1_id: {self.game.player1.id}, player2_id: {getattr(self.game.player2, 'id', None)}, is_ai: {self.game.player2_is_ai}, is_local: {self.game.player2_is_guest}", extra={
                        'user_id': self.user.id
                    })
                    await self.close(code=4003)
                    return

                # 4. Check game status
                if self.game.status != 'ongoing':
                    logger.error(f"[Game {self.game_id}] Game is not in ongoing state - status: {self.game.status}", extra={
                        'user_id': self.user.id
                    })
                    await self.close(code=4005)
                    return

                self.connection_state = 'validated'

                # 5. Add to game group and accept connection using a lock
                # TODO: Lock encore utile si gamestate sync par webrtc ?
                async with channel_layer_lock(self.channel_layer, f"game_{self.game_id}_connect"):
                    await self.channel_layer.group_add(self.game_group_name, self.channel_name)
                    await self.accept()
                    
                    self.connection_state = 'connected'
                    
                    # 6. Send initial game state
                    game_state = await self.get_game_state()
                    await self.send(text_data=json.dumps({
                        'type': 'game_state',
                        'state': game_state,
                        'is_host': self.is_host,
                        'connection_state': self.connection_state,
                        'is_ai_game': self.game.player2_is_ai,
                        'is_local_game': self.game.player2_is_guest
                    }))
                    
                    # 7. Notify other players about connection
                    await self.notify_player_ready({
                        'user_id': self.user.id,
                        'username': self.user.username,
                        'is_host': self.is_host,
                        'is_ai_opponent': self.game.player2_is_ai,
                        'is_guest_opponent': self.game.player2_is_guest
                    })

                    logger.info(f"[Game {self.game_id}] WebSocket connection accepted - is_host: {self.is_host}, connection_state: {self.connection_state}", extra={
                        'user_id': self.user.id
                    })

            except ObjectDoesNotExist as e:
                logger.error(f"Game or related object not found - game_id: {self.game_id}, connection_state: {self.connection_state}, error: {str(e)}", extra={
                    'user_id': self.user.id
                })
                await self.close(code=4004)
            except Exception as e:
                logger.error(f"[Game {self.game_id}] Error during game validation - error_type: {type(e).__name__}, error_message: {str(e)}, connection_state: {self.connection_state}, traceback: {traceback.format_exc()}", extra={
                    'user_id': self.user.id
                })
                await self.close(code=4002)

        except Exception as e:
            logger.error(f"[Game {self.game_id}] Critical error during connection - error_type: {type(e).__name__}, error_message: {str(e)}, connection_state: {getattr(self, 'connection_state', 'unknown')}, traceback: {traceback.format_exc()}", extra={
                'user_id': getattr(self.user, 'id', None)
            })
            await self.close(code=4002)

    async def receive(self, text_data):
        """
        Handles incoming WebSocket messages.
        
        Message types:
        - player_ready: Player connection notification
        - game_complete: Game completion (host only)
        - physics_update: Physics state updates
        """
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'player_ready':
                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'player_ready',
                        'user_id': data.get('user_id'),
                        'is_host': self.is_host,
                        'is_ai_opponent': getattr(self.game, 'player2_is_ai', False),
                        'is_guest_opponent': getattr(self.game, 'player2_is_guest', False)
                    }
                )
                return

            # Physics update messages - relay to other player
            elif message_type == 'physics_update':
                # Only relays physics updates from host to client (host is authoritative)
                if self.is_host and not self.game.player2_is_ai and not self.game.player2_is_guest:
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'relay_physics_update',
                            'state': data.get('state'),
                            'from_user': self.user.id
                        }
                    )
                return
            
            # Paddle input messages
            elif message_type in ['paddle_move', 'paddle_stop'] and not self.game.player2_is_ai and not self.game.player2_is_guest:
                # Only relay from guest to host (client input to server)
                if not self.is_host:
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'relay_paddle_input',
                            'input_type': message_type,
                            'direction': data.get('direction', 0),
                            'intensity': data.get('intensity', 1.0),
                            'from_user': self.user.id
                        }
                    )
                return

            elif message_type == 'update_scores':
                scores = data.get('scores', {})
                player1_score = scores.get('left', 0)
                player2_score = scores.get('right', 0)
                logger.debug(f"[Game {self.game_id}] Updating scores - {player1_score}-{player2_score}", extra={
                    'user_id': self.user.id
                })
                await self.update_game_state(player1_score, player2_score, 'ongoing')

            elif message_type == 'game_complete':
                if not self.is_host:
                    logger.warning(f"Non-host player tried to complete game", extra={
                        'user_id': self.user.id
                    })
                    return

                scores = data.get('scores', {})
                player1_score = scores.get('left', 0)
                player2_score = scores.get('right', 0)

                logger.info(f"[Game {self.game_id}] Game finished - scores: {player1_score}-{player2_score}", extra={
                    'user_id': self.user.id
                })
                
                # Update game state
                await self.update_game_state(
                    player1_score,
                    player2_score,
                    'finished'
                )

                # Notify room about game completion and trigger room state update
                if self.game.room:
                    room_group_name = f'pong_room_{self.game.room.room_id}'
                    # Send room state update first
                    # Then send game finished notification
                    await self.channel_layer.group_send(
                        room_group_name,
                        {
                            'type': 'game_finished',
                            'winner_id': self.game.player1.id if player1_score > player2_score else self.game.player2.id if self.game.player2 else None,
							'loser': self.game.player1 if player1_score < player2_score else self.game.player2 if self.game.player2 else None,
                            'final_score': f"{player1_score}-{player2_score}"
                        }
                    )
            else:
                logger.warning(f"Received unknown message type: {message_type}", extra={
                    'user_id': self.user.id
                })

        except json.JSONDecodeError:
            logger.error(f'Invalid game JSON data: {text_data}', extra={
                'user_id': self.user.id
            })
        except Exception as e:
            logger.error(f'Game error: {str(e)}, data: {text_data}', extra={
                'user_id': self.user.id
            })        

    async def relay_physics_update(self, event):
        """Relays physics update from host to guest players (WebSocket transport mode)"""
        sender_id = event['from_user']
        
        # Only relay from host to guest
        if sender_id == self.game.player1.id and not self.is_host:
            try:
                await self.send(text_data=json.dumps({
                    'type': 'physics_update',
                    'state': event['state']
                }))
            except Exception as e:
                logger.warning(f"[Game {self.game_id}] Could not relay physics update: {str(e)}", extra={
                    'user_id': getattr(self.user, 'id', None)
                })

    async def relay_paddle_input(self, event):
        """Relays paddle input from guest to host (WebSocket transport mode)"""
        sender_id = event['from_user']
        
        # Only relay from guest to host
        if self.is_host and sender_id != self.user.id:
            try:
                # Send input to host - format matches the expected input in physics engine
                await self.send(text_data=json.dumps({
                    'type': event['input_type'],
                    'direction': event['direction'],
                    'intensity': event['intensity']
                }))
            except Exception as e:
                logger.warning(f"[Game {self.game_id}] Could not relay paddle input: {str(e)}", extra={
                    'user_id': getattr(self.user, 'id', None)
                })

    async def disconnect(self, close_code):
        """Handles cleanup on connection close"""
        logger.info(f"[Game {self.game_id}] Game disconnection - close_code: {close_code}", extra={
            'user_id': getattr(self.user, 'id', None)
        })
        
        if hasattr(self, 'game_group_name'):
            try:
                await self.channel_layer.group_discard(
                    self.game_group_name,
                    self.channel_name
                )
                
                if hasattr(self, 'game') and hasattr(self, 'user') and not self.user.is_anonymous:
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'player_disconnected',
                            'user_id': self.user.id,
                            'is_host': getattr(self, 'is_host', False)
                        }
                    )
                    
                    # Ne mettre à jour que si le jeu est toujours en cours
                    current_status = await self.get_current_game_status()
                    if current_status == 'ongoing':
                        await self.update_game_on_disconnect()

            except Exception as e:
                logger.error(f"[Game {self.game_id}] Error during disconnect cleanup - error: {str(e)}, traceback: {traceback.format_exc()}", extra={
                    'user_id': self.user.id
                })

    @database_sync_to_async
    def get_game(self):
        """Retrieves game instance with related players"""
        try:
            return PongGame.objects.select_related('player1', 'player2').get(id=self.game_id)
        except PongGame.DoesNotExist:
            return None

    @database_sync_to_async
    def get_game_state(self):
        """Returns current game state including AI player handling"""
        return {
            'player1': {
                'id': self.game.player1.id,
                'username': self.game.player1.username,
                'is_connected': True,
                'is_host': True
            },
            'player2': {
                'id': self.game.player2.id if self.game.player2 else None,
                'username': (self.game.player2.username if self.game.player2 else
                             'AI' if self.game.player2_is_ai else
                             'Guest'),
                'is_connected': not self.game.player2_is_ai or not self.game.player2_is_guest,
                'is_ai': self.game.player2_is_ai,
                'is_guest': self.game.player2_is_guest,
                'is_host': False
            },
            'scores': {
                'left': self.game.player1_score,
                'right': self.game.player2_score
            },
            'status': self.game.status,
            'is_ai_game': self.game.player2_is_ai,
            'is_local_game': self.game.player2_is_guest
        }
    
    @database_sync_to_async
    def update_game_state(self, player1_score, player2_score, status):
        """Updates game scores and status"""
        if self.game:
            self.game.player1_score = player1_score
            self.game.player2_score = player2_score
            self.game.status = status
            if status == 'finished':
                self.game.finished_at = timezone.now()
                # Update room state to LOBBY when game finishes
                if self.game.room:
                    self.game.room.state = 'LOBBY'
                    self.game.room.save()
            self.game.save()

    async def notify_player_ready(self, event):
        """Notifies clients about player connection status"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'player_ready',
                'user_id': event['user_id'],
                'username': event['username'],
                'is_host': event['is_host'],
                'is_ai_opponent': event.get('is_ai_opponent', False),
                'connection_state': self.connection_state
            }))
        except Exception as e:
            logger.warning(f"[Game {self.game_id}] Could not send player_ready notification: {str(e)}", extra={
                'user_id': getattr(self.user, 'id', None)
            })

    @database_sync_to_async
    def get_current_game_status(self):
        """Récupère le statut actuel du jeu depuis la base de données"""
        return PongGame.objects.get(id=self.game_id).status

    @database_sync_to_async
    def update_game_on_disconnect(self):
        """Handles game state updates on player disconnection"""
        self.game.refresh_from_db()  # Actualise l'état depuis la base
        if self.game.status == 'ongoing':
            self.game.status = 'finished'
            min_score = -1
            if self.is_host:
                self.game.player1_score = min_score
            else:
                self.game.player2_score = min_score
            self.game.finished_at = timezone.now()
            self.game.save()
            if self.game.room:
                self.game.room.state = 'LOBBY'
                self.game.room.save()

    async def player_disconnected(self, event):
        """Broadcasts player disconnection to remaining clients"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'player_disconnected',
                'user_id': event['user_id'],
                'is_host': event.get('is_host', False)
            }))
        except Exception as e:
            logger.warning(f"[Game {self.game_id}] Could not send player_disconnected notification: {str(e)}", extra={
                'user_id': getattr(self.user, 'id', None)
            })

    async def player_ready(self, event):
        """Handles player_ready messages sent through the channel layer"""
        try:
            await self.send(text_data=json.dumps({
                'type': 'player_ready',
                'user_id': event.get('user_id'),
                'is_host': event.get('is_host', False),
            }))
        except Exception as e:
            logger.error(f"Error handling player_ready event: {str(e)}", extra={
                'user_id': self.user.id
            })
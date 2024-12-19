import json, traceback, logging
from django.core.exceptions import ObjectDoesNotExist
from django.utils import timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import async_to_sync
from contextlib import asynccontextmanager
from django.contrib.auth import get_user_model
from .models import PongGame

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

            logger.info(f'Game WebSocket connection attempt - game_id: {self.game_id}, connection_state: {self.connection_state}', extra={
                'user_id': getattr(self.user, 'id', None)
            })

            # 1. Authentication check
            if not self.user or self.user.is_anonymous:
                logger.warning(f"Unauthorized game connection attempt - game_id: {self.game_id}", extra={
                    'user_id': None
                })
                await self.close(code=4001)
                return

            # Update state to validating
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
                self.is_guest = self.user == self.game.player2 or self.game.player2_is_ai

                if not self.is_host and not self.is_guest:
                    logger.error(f"User not authorized for game - game_id: {self.game_id}, player1_id: {self.game.player1.id}, player2_id: {getattr(self.game.player2, 'id', None)}, is_ai: {self.game.player2_is_ai}", extra={
                        'user_id': self.user.id
                    })
                    await self.close(code=4003)
                    return

                # 4. Check game status
                if self.game.status != 'ongoing':
                    logger.error(f"Game is not in ongoing state - game_id: {self.game_id}, status: {self.game.status}", extra={
                        'user_id': self.user.id
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
                    
                    # 6. Send initial game state
                    game_state = await self.get_game_state()
                    await self.send(text_data=json.dumps({
                        'type': 'game_state',
                        'state': game_state,
                        'is_host': self.is_host,
                        'connection_state': self.connection_state
                    }))
                    
                    # 7. Notify other players about connection
                    await self.notify_player_ready({
                        'user_id': self.user.id,
                        'username': self.user.username,
                        'is_host': self.is_host,
                        'is_ai_opponent': self.game.player2_is_ai
                    })

                    logger.info(f"Game WebSocket connection accepted - game_id: {self.game_id}, is_host: {self.is_host}, connection_state: {self.connection_state}", extra={
                        'user_id': self.user.id
                    })

            except ObjectDoesNotExist as e:
                logger.error(f"Game or related object not found - game_id: {self.game_id}, connection_state: {self.connection_state}, error: {str(e)}", extra={
                    'user_id': self.user.id
                })
                await self.close(code=4004)
            except Exception as e:
                logger.error(f"Error during game validation - error_type: {type(e).__name__}, error_message: {str(e)}, connection_state: {self.connection_state}, traceback: {traceback.format_exc()}", extra={
                    'user_id': self.user.id
                })
                await self.close(code=4002)

        except Exception as e:
            logger.error(f"Critical error during connection - error_type: {type(e).__name__}, error_message: {str(e)}, connection_state: {getattr(self, 'connection_state', 'unknown')}, traceback: {traceback.format_exc()}", extra={
                'user_id': getattr(self.user, 'id', None)
            })
            await self.close(code=4002)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'webrtc_signal':
                signal_type = data.get('signal', {}).get('type')
                
                # Allow ICE candidates from both host and guest
                if signal_type == 'candidate':
                    await self.channel_layer.group_send(
                        self.game_group_name,
                        {
                            'type': 'relay_webrtc_signal',
                            'signal': data.get('signal'),
                            'from_user': self.user.id
                        }
                    )
                    return
                
                # Validate offer/answer based on role
                if self.is_host and signal_type != 'offer':
                    logger.warning(f"Host sent invalid signal type - expected 'offer'", extra={
                        'user_id': self.user.id
                    })
                    return
                elif not self.is_host and signal_type != 'answer':
                    logger.warning(f"Guest sent invalid signal type - expected 'answer'", extra={
                        'user_id': self.user.id
                    })
                    return

                # Transmit WebRTC signal to other player
                await self.channel_layer.group_send(
                    self.game_group_name,
                    {
                        'type': 'relay_webrtc_signal',
                        'signal': data.get('signal'),
                        'from_user': self.user.id
                    }
                )
            elif message_type == 'game_finished':
                # Only host can declare game finished
                if not self.is_host:
                    logger.warning(f"Non-host player tried to finish game", extra={
                        'user_id': self.user.id
                    })
                    return

                logger.info(f"Game finished - game_id: {self.game_id}, scores: {data.get('player1_score')}-{data.get('player2_score')}", extra={
                    'user_id': self.user.id
                })
                # Update game score and state
                await self.update_game_state(
                    data.get('player1_score'),
                    data.get('player2_score'),
                    'finished'
                )

        except json.JSONDecodeError:
            logger.error(f'Invalid game JSON data: {text_data}', extra={
                'user_id': self.user.id
            })
        except Exception as e:
            logger.error(f'Game error: {str(e)}, data: {text_data}', extra={
                'user_id': self.user.id
            })

    async def relay_webrtc_signal(self, event):
        # Verify signal is from a valid player
        sender_id = event['from_user']
        valid_player_ids = [self.game.player1.id]
        if self.game.player2:  # Add player2's ID only if they exist (not AI)
            valid_player_ids.append(self.game.player2.id)

        if sender_id not in valid_player_ids:
            logger.error(f"Unauthorized WebRTC signal from user {sender_id}", extra={
                'user_id': self.user.id
            })
            return

        # Don't send signal back to sender
        if sender_id != self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'webrtc_signal',
                'signal': event['signal'],
                'from_user': sender_id
            }))

    async def disconnect(self, close_code):
        logger.info(f"Game disconnection - game_id: {getattr(self, 'game_id', None)}, close_code: {close_code}", extra={
            'user_id': getattr(self.user, 'id', None)
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
                            'user_id': self.user.id,
                            'is_host': getattr(self, 'is_host', False)
                        }
                    )
                    
                    # Update game status if needed
                    await self.update_game_on_disconnect()

            except Exception as e:
                logger.error(f"Error during disconnect cleanup - error: {str(e)}, traceback: {traceback.format_exc()}, game_id: {getattr(self, 'game_id', None)}", extra={
                    'user_id': self.user.id
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
                'is_connected': True,
                'is_host': True
            },
            'player2': {
                'id': self.game.player2.id if self.game.player2 else None,
                'username': self.game.player2.username if self.game.player2 else 'AI',
                'is_connected': not self.game.player2_is_ai,
                'is_ai': self.game.player2_is_ai,
                'is_host': False
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
        await self.send(text_data=json.dumps({
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
            if self.is_host:
                self.game.player2_score = 11  # Win score
            else:
                self.game.player1_score = 11
            self.game.finished_at = timezone.now()
            self.game.save()

            # Reset room state to LOBBY
            if self.game.room:
                self.game.room.state = 'LOBBY'
                self.game.room.save()

    async def player_disconnected(self, event):
        """Handle player disconnection event"""
        await self.send(text_data=json.dumps({
            'type': 'player_disconnected',
            'user_id': event['user_id'],
            'is_host': event.get('is_host', False)
        })) 
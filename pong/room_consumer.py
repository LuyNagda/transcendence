import json, traceback, logging
from django.core.exceptions import ObjectDoesNotExist
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from .models import PongRoom, PongGame

logger = logging.getLogger(__name__)
User = get_user_model()

class PongRoomConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            self.user = self.scope.get("user")
            self.room_id = self.scope['url_route']['kwargs']['room_id']
            self.room_group_name = f'pong_room_{self.room_id}'

            logger.info(f'Room WebSocket connection attempt - room_id: {self.room_id}, authenticated: {getattr(self.user, "is_authenticated", False)}, scope_details: {{"type": self.scope.get("type"), "path": self.scope.get("path"), "headers": dict(self.scope.get("headers", []))}}', extra={
                'user_id': getattr(self.user, 'id', None)
            })

            # Authentication check
            if not self.user or not self.user.is_authenticated:
                logger.warning(f"Unauthorized connection attempt - room_id: {self.room_id}, user: {str(self.user)}", extra={
                    'user_id': None
                })
                await self.close(code=4001)
                return

            # Get and validate room
            self.room = await self.get_room()
            if not self.room:
                logger.error(f"Room not found: room_id={self.room_id}", extra={
                    'user_id': self.user.id
                })
                await self.close(code=4004)
                return

            # Add user to room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )

            # Add user to room if not already present
            success, message = await self.add_user_to_room()
            if not success:
                logger.error(f"Failed to add user to room: {message} - room_id: {self.room_id}", extra={
                    'user_id': self.user.id
                })
                await self.close(code=4002)
                return

            await self.accept()
            logger.info(f"Room WebSocket connection accepted for user {self.user.username} in room {self.room_id}", extra={
                'user_id': self.user.id
            })

            # Send initial room state
            await self.update_room()

        except Exception as e:
            logger.error(f"Error during connection - error_type: {type(e).__name__}, error_message: {str(e)}, traceback: {traceback.format_exc()}, room_id: {getattr(self, 'room_id', None)}", extra={
                'user_id': getattr(self.user, 'id', None)
            })
            await self.close(code=4002)
            return

    async def disconnect(self, close_code):
        logger.info(f"Disconnection - room_id: {getattr(self, 'room_id', None)}, close_code: {close_code}, has_room: {hasattr(self, 'room')}, has_group: {hasattr(self, 'room_group_name')}", extra={
            'user_id': getattr(self.user, 'id', None)
        })
        
        try:
            if hasattr(self, 'room'):
                await self.remove_user_from_room()
                if hasattr(self, 'room_group_name'):
                    await self.update_room()
            if hasattr(self, 'room_group_name') and hasattr(self, 'channel_name'):
                await self.channel_layer.group_discard(self.room_group_name, self.channel_name)
        except Exception as e:
            logger.error(f"Error during disconnect - error_type: {type(e).__name__}, error_message: {str(e)}, traceback: {traceback.format_exc()}", extra={
                'user_id': getattr(self.user, 'id', None)
            })

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_id = data.get('id')
            action = data.get('action')
            logger.info(f"Message received - room_id: {self.room_id}, action: {action}, message_id: {message_id}, data: {data}", extra={
                'user_id': self.user.id
            })

            if action == 'update_property':
                property = data.get('property')
                value = data.get('value')
                logger.info(f"Updating property: {property} with value: {value}")
                
                # Handle all settings-related updates through the settings channel
                if property == 'settings' or property in ['maxScore', 'ballSpeed', 'paddleSpeed', 'aiDifficulty', 'powerUps']:
                    setting = data.get('setting') or property
                    # Broadcast settings update to all room members
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'settings_update',
                            'setting': setting,
                            'value': value
                        }
                    )
                    response = {'id': message_id, 'status': 'success', 'message': 'Settings updated'}
                elif property == 'mode':
                    # Only room owner can change mode
                    if self.user != self.room.owner:
                        response = {'id': message_id, 'status': 'error', 'message': 'Only room owner can change mode'}
                    else:
                        # Validate mode
                        if value not in dict(PongRoom.Mode.choices):
                            response = {'id': message_id, 'status': 'error', 'message': f'Invalid game mode: {value}'}
                        else:
                            success = await self.update_room_property('mode', value)
                            if success:
                                response = {'id': message_id, 'status': 'success', 'message': 'Mode updated'}
                            else:
                                response = {'id': message_id, 'status': 'error', 'message': 'Failed to update mode'}
                else:
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
            logger.error(f'Received invalid JSON data: {text_data}', extra={
                'user_id': self.user.id
            })
        except KeyError as e:
            logger.error(f'Missing key in received data: {text_data}, room_id: {self.room_id}, missing_key: {str(e)}', extra={
                'user_id': self.user.id
            })
        except Exception as e:
            logger.error(f'Unexpected error: {str(e)}, data: {text_data}, room_id: {self.room_id}', extra={
                'user_id': self.user.id
            })

    @database_sync_to_async
    def get_room(self):
        try:
            return PongRoom.objects.get(room_id=self.room_id)
        except PongRoom.DoesNotExist:
            return None

    @database_sync_to_async
    def add_user_to_room(self):
        try:
            if not self.room:
                logger.error(f"Cannot add user to room: Room not found, room_id: {self.room_id}", extra={
                    'user_id': self.user.id
                })
                return False, "Room not found"

            # If user is the owner, always allow them in
            if self.user == self.room.owner:
                if self.user not in self.room.players.all():
                    self.room.players.add(self.user)
                return True, "Owner added to room"

            # For non-owners, check if they can join
            if self.user not in self.room.players.all():
                current_players = self.room.players.count()
                max_players = self.room.max_players

                logger.info(f"Room join attempt - room_id: {self.room_id}, current_players: {current_players}, max_players: {max_players}, mode: {self.room.mode}, is_owner: {self.user == self.room.owner}", extra={
                    'user_id': self.user.id
                })

                # Check if room is full
                if current_players >= max_players:
                    logger.error(f"Cannot add user to room: Room is full - room_id: {self.room_id}, current_players: {current_players}, max_players: {max_players}", extra={
                        'user_id': self.user.id
                    })
                    return False, "Room is full"

                # For AI mode, only allow the owner
                if self.room.mode == 'AI' and self.user != self.room.owner:
                    logger.error(f"Cannot add user to AI room: Not the owner - room_id: {self.room_id}", extra={
                        'user_id': self.user.id
                    })
                    return False, "Cannot join AI mode room"

                # Check if user has a pending invitation
                if self.user in self.room.pending_invitations.all():
                    # Remove from pending invitations
                    self.room.pending_invitations.remove(self.user)
                    # Add to players
                    self.room.players.add(self.user)
                    logger.info(f"Invited user added to room - room_id: {self.room_id}", extra={
                        'user_id': self.user.id
                    })
                    return True, "Invited user added to room"

                self.room.players.add(self.user)
                logger.info(f"User added to room - room_id: {self.room_id}, current_players: {current_players + 1}, max_players: {max_players}", extra={
                    'user_id': self.user.id
                })
                return True, "User added to room"
            else:
                logger.info(f"User already in room - room_id: {self.room_id}", extra={
                    'user_id': self.user.id
                })
                return True, "User already in room"

        except Exception as e:
            logger.error(f"Error adding user to room - error_type: {type(e).__name__}, error_message: {str(e)}, room_id: {self.room_id}, traceback: {traceback.format_exc()}", extra={
                'user_id': self.user.id
            })
            return False, f"Error adding user to room: {str(e)}"

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
        
        logger.info(f"Room state update: room_id={self.room_id}, state={room_state}")
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
            'trigger_htmx': True,
            'trigger_components': ['game-settings']
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
                # Convert camelCase to snake_case for property names
                property = ''.join(['_' + c.lower() if c.isupper() else c for c in property]).lstrip('_')
                old_value = getattr(self.room, property, None)
                
                if property == 'state':
                    if value not in dict(PongRoom.State.choices):
                        logger.error(f"Invalid state value: {value}")
                        return False
                    self.room.state = value
                elif property == 'owner':
                    user = User.objects.get(id=value['id'])
                    self.room.owner = user
                elif property == 'players':
                    player_ids = [player['id'] for player in value]
                    self.room.players.set(User.objects.filter(id__in=player_ids))
                elif property == 'pending_invitations':
                    invitation_ids = [inv['id'] for inv in value]
                    self.room.pending_invitations.set(User.objects.filter(id__in=invitation_ids))
                elif property == 'mode':
                    logger.info(f"Changing mode from {self.room.mode} to {value}")
                    old_mode = self.room.mode
                    self.room.mode = value
                    self.room.save()  # Save immediately to update max_players
                    
                    # Get default settings for the new mode
                    settings = {
                        'ballSpeed': 4,
                        'paddleSpeed': 4,
                        'maxScore': 11,
                        'powerUps': False,
                        'aiDifficulty': 'medium'
                    } if value == 'AI' else {
                        'ballSpeed': 6,
                        'paddleSpeed': 6,
                        'maxScore': 11,
                        'powerUps': False
                    } if value == 'RANKED' else {
                        'ballSpeed': 5,
                        'paddleSpeed': 5,
                        'maxScore': 11,
                        'powerUps': False
                    }
                    
                    # Get updated room state
                    room_state = {
                        'id': self.room.room_id,
                        'mode': value,
                        'maxPlayers': self.room.max_players,  # Include updated max_players
                        'availableSlots': self.room.max_players - self.room.players.count()
                    }
                    
                    # Broadcast mode change with settings and room state
                    async_to_sync(self.channel_layer.group_send)(
                        self.room_group_name,
                        {
                            'type': 'mode_change',
                            'mode': value,
                            'settings': settings,
                            'room_state': room_state
                        }
                    )
                    
                    # Also trigger a full room update
                    async_to_sync(self.channel_layer.group_send)(
                        self.room_group_name,
                        {
                            'type': 'update_room',
                        }
                    )
                    
                    logger.info(f"Mode changed from {old_mode} to {value}, new max_players: {self.room.max_players}")
                    return True
                else:
                    logger.warning(f"Attempt to update unknown property: {property}")
                    return False
                
                self.room.save()
                
                new_value = getattr(self.room, property, None)
                logger.info(f"Property '{property}' updated: {old_value} -> {new_value}")
                
                # Trigger room update
                async_to_sync(self.channel_layer.group_send)(
                    self.room_group_name,
                    {
                        'type': 'update_room',
                    }
                )
                
                return True
            except ObjectDoesNotExist:
                logger.error(f"Object not found while updating property {property}")
                return False
            except Exception as e:
                logger.error(f"Error updating property {property}: {str(e)}")
                return False
        return False

    async def settings_update(self, event):
        """
        Handle settings update event and broadcast to room
        """
        # Get current room state
        room_state = await self.get_room_state()
        
        await self.send(text_data=json.dumps({
            'type': 'settings_update',
            'setting': event['setting'],
            'value': event['value'],
            'room_state': room_state
        }))

    async def mode_change(self, event):
        """
        Handle mode change event and broadcast to room
        """
        await self.send(text_data=json.dumps({
            'type': 'mode_change',
            'mode': event['mode'],
            'settings': event.get('settings', {}),
            'room_state': event.get('room_state', {}),
            'trigger_components': ['game-settings', 'mode-selection']
        }))

    async def settings_change(self, event):
        """
        Handle settings update event
        """
        await self.send(text_data=json.dumps({
            'type': 'settings_change',
            'settings': event['settings']
        })) 
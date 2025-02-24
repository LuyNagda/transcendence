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

            # First accept the connection
            await self.accept()

            # Add user to room group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )

            # Add user to room if not already present
            success, message, error_code = await self.add_user_to_room()
            if not success:
                logger.error(f"Failed to add user to room: {message} - room_id: {self.room_id}", extra={
                    'user_id': self.user.id
                })
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'code': error_code,
                    'message': message
                }))
                await self.channel_layer.group_discard(
                    self.room_group_name,
                    self.channel_name
                )
                await self.close(code=error_code)
                return

            logger.info(f"Room WebSocket connection accepted for user {self.user.username} in room {self.room_id}", extra={
                'user_id': self.user.id
            })

            # Send initial room state
            await self.update_room()

        except Exception as e:
            logger.error(f"Error during connection - error_type: {type(e).__name__}, error_message: {str(e)}, traceback: {traceback.format_exc()}, room_id: {getattr(self, 'room_id', None)}", extra={
                'user_id': getattr(self.user, 'id', None)
            })
            # If we've already accepted the connection, send error message
            if hasattr(self, 'accepted') and self.accepted:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'code': 4002,
                    'message': 'Internal server error'
                }))
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

            if action == 'get_state':
                # Get current room state and send it back
                room_state = await self.get_room_state()
                response = {'id': message_id, 'status': 'success', 'room_state': room_state}
            elif action == 'update_property':
                property = data.get('property')
                value = data.get('value')
                logger.info(f"Updating property: {property} with value: {value}")
                
                if property == 'settings' or property in ['maxScore', 'ballSpeed', 'paddleSpeed', 'aiDifficulty', 'paddleSize']:
                    if not await self.is_room_owner():
                        response = {'id': message_id, 'status': 'error', 'error': {'code': 4002, 'message': 'Only room owner can change settings'}}
                    else:
                        setting = data.get('setting') or property
                        setting_value = value
                        success = await self.update_room_settings(setting, setting_value)
                        if success:
                            room_state = await self.get_room_state()
                            await self.channel_layer.group_send(
                                self.room_group_name,
                                {
                                    'type': 'settings_update',
                                    'data': {
                                        'setting': setting,
                                        'value': setting_value,
                                        'room_state': room_state
                                    }
                                }
                            )
                            response = {'id': message_id, 'status': 'success', 'message': 'Settings updated', 'data': {'setting': setting, 'value': setting_value}}
                        else:
                            response = {'id': message_id, 'status': 'error', 'error': {'code': 4011, 'message': 'Failed to update settings'}}
                elif property == 'mode':
                    if not await self.is_room_owner():
                        response = {'id': message_id, 'status': 'error', 'error': {'code': 4002, 'message': 'Only room owner can change mode'}}
                    else:
                        if value not in dict(PongRoom.Mode.choices):
                            response = {'id': message_id, 'status': 'error', 'error': {'code': 4010, 'message': f'Invalid game mode: {value}'}}
                        else:
                            success = await self.update_room_property('mode', value)
                            if success:
                                room_state = await self.get_room_state()
                                await self.channel_layer.group_send(self.room_group_name, {'type': 'mode_change', 'data': {'mode': value, 'room_state': room_state}})
                                response = {'id': message_id, 'status': 'success', 'message': 'Mode updated'}
                            else:
                                response = {'id': message_id, 'status': 'error', 'error': {'code': 4010, 'message': 'Failed to update mode'}}
                elif property == 'state':
                    current_state = self.room.state
                    if value not in dict(PongRoom.State.choices):
                        response = {'id': message_id, 'status': 'error', 'error': {'code': 4012, 'message': f'Invalid state: {value}'}}
                    elif current_state == value:
                        response = {'id': message_id, 'status': 'success', 'message': f'Already in state {value}'}
                    elif current_state == 'PLAYING' and value == 'LOBBY':
                        success = await self.update_room_property('state', value)
                        if success:
                            await self.update_room()
                            response = {'id': message_id, 'status': 'success', 'message': 'State updated to LOBBY'}
                        else:
                            response = {'id': message_id, 'status': 'error', 'error': {'code': 4012, 'message': 'Failed to update state'}}
                    else:
                        response = {'id': message_id, 'status': 'error', 'error': {'code': 4012, 'message': f'Invalid state transition from {current_state} to {value}'}}
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
                mode = data.get('mode')
                if not await self.is_room_owner():
                    response = {'id': message_id, 'status': 'error', 'error': {'code': 4002, 'message': 'Only room owner can change mode'}}
                else:
                    if mode not in dict(PongRoom.Mode.choices):
                        response = {'id': message_id, 'status': 'error', 'error': {'code': 4010, 'message': f'Invalid game mode: {mode}'}}
                    else:
                        success = await self.update_room_property('mode', mode)
                        if success:
                            room_state = await self.get_room_state()
                            await self.channel_layer.group_send(self.room_group_name, {'type': 'mode_change', 'data': {'mode': mode, 'room_state': room_state}})
                            response = {'id': message_id, 'status': 'success', 'message': 'Mode updated'}
                        else:
                            response = {'id': message_id, 'status': 'error', 'error': {'code': 4010, 'message': 'Failed to update mode'}}
            elif action == 'start_game':
                if not await self.is_room_owner():
                    response = {'id': message_id, 'status': 'error', 'error': {'code': 4002, 'message': 'Only room owner can start game'}}
                else:
                    game = await self.create_game()
                    response = {'id': message_id, 'status': 'success' if game else 'error', 'message': 'Game started' if game else 'Failed to create game', 'data': {'game_id': game.id} if game else None}
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
                return False, "Room not found", 4004

            # If user is the owner, always allow them in
            if self.user == self.room.owner:
                if self.user not in self.room.players.all():
                    self.room.players.add(self.user)
                return True, "Owner added to room", None

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
                    return False, "Room is full", 4003

                # For AI mode, only allow the owner
                if self.room.mode == 'AI' and self.user != self.room.owner:
                    logger.error(f"Cannot add user to AI room: Not the owner - room_id: {self.room_id}", extra={
                        'user_id': self.user.id
                    })
                    return False, "Cannot join AI mode room", 4005

                if self.room.state == 'PLAYING':
                    logger.error(f"Cannot add user to room: Game in progress - room_id: {self.room_id}", extra={
                        'user_id': self.user.id
                    })
                    return False, "Cannot join room: Game in progress", 4006

                # Check if user has a pending invitation
                if self.user in self.room.pending_invitations.all():
                    # Remove from pending invitations
                    self.room.pending_invitations.remove(self.user)
                    # Add to players
                    self.room.players.add(self.user)
                    logger.info(f"Invited user added to room - room_id: {self.room_id}", extra={
                        'user_id': self.user.id
                    })
                    return True, "Invited user added to room", None

                # TODO: Implement is_private in model
                # # If room is private and user has no invitation
                # if self.user not in self.room.pending_invitations.all():
                #     logger.error(f"Cannot add user to private room: No invitation - room_id: {self.room_id}", extra={
                #         'user_id': self.user.id
                #     })
                #     return False, "Cannot join private room: No invitation", 4007

                self.room.players.add(self.user)
                logger.info(f"User added to room - room_id: {self.room_id}, current_players: {current_players + 1}, max_players: {max_players}", extra={
                    'user_id': self.user.id
                })
                return True, "User added to room", None
            else:
                logger.info(f"User already in room - room_id: {self.room_id}", extra={
                    'user_id': self.user.id
                })
                return True, "User already in room", None

        except Exception as e:
            logger.error(f"Error adding user to room - error_type: {type(e).__name__}, error_message: {str(e)}, room_id: {self.room_id}, traceback: {traceback.format_exc()}", extra={
                'user_id': self.user.id
            })
            return False, f"Error adding user to room: {str(e)}", 4002

    @database_sync_to_async
    def remove_user_from_room(self):
        if self.room:
            self.room.players.remove(self.user)

    @database_sync_to_async
    def get_room_state(self):
        if self.room is None:
            return None
        room_data = self.room.serialize()
        room_data['currentUser'] = {
            'id': self.user.id,
            'username': self.user.username,
        }
        return room_data

    async def update_room(self, event=None):
        """Broadcast room state update to all clients in the room"""
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
        """Send room state update to client"""
        room_state = event['room_state']
        await self.send(text_data=json.dumps({
            'type': 'room_update',
            'room_state': room_state
        }))

    async def create_game(self):
        """Creates a new game for the room"""
        try:
            # Validate game creation
            is_valid, error_message = await self.validate_game_creation()
            if not is_valid:
                logger.error(f"Game creation validation failed: {error_message}")
                return None

            # Update room state to PLAYING
            await self.update_room_state('PLAYING')
            
            # Create the game
            game = await self.create_game_with_settings()
            if not game:
                logger.error("Failed to create game with settings")
                await self.update_room_state('LOBBY')
                return None

            # Get room settings
            settings = self.room.settings or {}
            
            # Prepare event data
            event_data = {
                'type': 'game_started',
                'data': {
                    'game_id': game.id,
                    'player1_id': game.player1.id,
                    'is_ai_game': game.player2_is_ai,
                    'settings': settings
                }
            }
            if game.player2:
                event_data['data']['player2_id'] = game.player2.id

            # Broadcast game started event
            await self.channel_layer.group_send(
                self.room_group_name,
                event_data
            )
            
            logger.info(f"Game created and broadcast: {game.id} for room {self.room.id}")
            return game

        except Exception as e:
            logger.error(f"Error creating game: {str(e)}")
            await self.update_room_state('LOBBY')
            return None

    @database_sync_to_async
    def validate_game_creation(self):
        """Validates if a game can be created"""
        try:
            # For AI mode, we only need one player (the owner)
            if self.room.mode == 'AI':
                if self.room.players.count() < 1:
                    logger.error("No players in AI mode room")
                    return False, "No players in room"
            else:
                # For non-AI modes, we need at least 2 players
                if self.room.players.count() < 2:
                    logger.error("Not enough players to start game")
                    return False, "Not enough players"

            if self.room.state != 'LOBBY':
                logger.error("Room not in LOBBY state")
                return False, "Room not in LOBBY state"

            return True, None
        except Exception as e:
            logger.error(f"Error validating game creation: {str(e)}")
            return False, str(e)

    @database_sync_to_async
    def update_room_state(self, state):
        """Updates room state in the database"""
        self.room.state = state
        self.room.save()

    @database_sync_to_async
    def create_game_with_settings(self):
        """Creates a new game with current room settings"""
        try:
            game = PongGame.objects.create(
                room=self.room,
                player1=self.room.owner,
                player2=next((player for player in self.room.players.all() 
                            if player != self.room.owner), None),
                player2_is_ai=self.room.mode == 'AI',
                status='ongoing'
            )
            
            logger.info(f"Game created: {game.id} for room {self.room.id}")
            return game
        except Exception as e:
            logger.error(f"Error creating game with settings: {str(e)}")
            return None

    async def game_started(self, event):
        """Handle game started event and send to client"""
        logger.info(f"Handling game started event: {event}")
        
        # Extract data from the event
        event_data = event.get('data', {})
        
        response_data = {
            'type': 'game_started',
            'game_id': event_data.get('game_id'),
            'player1_id': event_data.get('player1_id'),
            'is_ai_game': event_data.get('is_ai_game', False),
            'settings': event_data.get('settings', {})
        }
        
        if 'player2_id' in event_data:
            response_data['player2_id'] = event_data['player2_id']

        logger.info(f"Sending game started response: {response_data}")
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
                    } if value == 'AI' else {
                        'ballSpeed': 6,
                        'paddleSpeed': 6,
                        'maxScore': 11,
                        'aiDifficulty': 'Medium'
                    } if value == 'RANKED' else {
                        'ballSpeed': 5,
                        'paddleSpeed': 5,
                        'maxScore': 11,
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
        """Handle settings update event and broadcast to room"""
        logger.info(f"Broadcasting settings update: {event}")
        await self.send(text_data=json.dumps({
            'type': 'settings_update',
            'data': event.get('data', {})
        }))

    async def mode_change(self, event):
        """Handle mode change event and broadcast to room"""
        logger.info(f"Broadcasting mode change: {event}")
        
        # Create a consistent data structure regardless of input format
        mode_data = {
            'type': 'mode_change',
            'data': {
                'mode': event.get('mode'),
                'settings': event.get('settings', {}),
                'room_state': event.get('room_state', {})
            }
        }
        
        # If the data is already in the new format, use it
        if 'data' in event:
            mode_data['data'] = event['data']
            
        logger.info(f"Sending mode change data: {mode_data}")
        await self.send(text_data=json.dumps(mode_data))

    async def settings_change(self, event):
        """
        Handle settings update event
        """
        room_state = await self.get_room_state()
        await self.send(text_data=json.dumps({
            'type': 'settings_change',
            'room_state': room_state
        }))

    async def game_finished(self, event):
        """
        Handle game finished event and update room state
        """
        try:
            # Update room state to LOBBY if not already
            if self.room.state != 'LOBBY':
                await self.update_room_property('state', 'LOBBY')
            
            # Send game finished notification to clients
            await self.send(text_data=json.dumps({
                'type': 'game_finished',
                'winner_id': event['winner_id'],
                'final_score': event['final_score']
            }))
            
            # Trigger a full room state update
            await self.update_room()
            
        except Exception as e:
            logger.error(f"Error handling game finished event: {str(e)}", extra={
                'user_id': getattr(self.user, 'id', None)
            }) 

    @database_sync_to_async
    def is_room_owner(self):
        return self.user == self.room.owner

    @database_sync_to_async
    def update_room_settings(self, setting, value):
        """Update room settings in database"""
        try:
            current_settings = self.room.settings or {}
            if setting == 'ballSpeed':
                value = max(1, min(10, int(value)))
            elif setting == 'paddleSpeed':
                value = max(1, min(10, int(value)))
            elif setting == 'maxScore':
                value = max(1, min(21, int(value)))
            elif setting == 'paddleSize':
                value = max(1, min(10, int(value)))

            current_settings[setting] = value
            self.room.settings = current_settings
            self.room.save()
            
            logger.info(f"Settings updated - room: {self.room_id}, setting: {setting}, value: {value}")
            return True
        except Exception as e:
            logger.error(f"Error updating settings: {str(e)}")
            return False 

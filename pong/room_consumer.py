import json, traceback, logging
from django.core.exceptions import ObjectDoesNotExist
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import async_to_sync
from django.contrib.auth import get_user_model
from .models import PongRoom, PongGame, Tournament
from django.utils import timezone

logger = logging.getLogger(__name__)
User = get_user_model()

class PongRoomConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            self.user = self.scope.get("user")
            self.room_id = self.scope['url_route']['kwargs']['room_id']
            self.room_group_name = f'pong_room_{self.room_id}'
            self._kicked = False

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

            success, message, error_code = await self.add_user_to_room()
            if not success:
                logger.error(f"Failed to add user to room: {message} - room_id: {self.room_id}", extra={
                    'user_id': self.user.id
                })
				
                # await self.update_room()

                # user_group = f"user_{self.user.id}"
                # await self.channel_layer.group_add(
                #     user_group,
                #     self.channel_name
                # )

                # await self.channel_layer.group_send(
                #     f'user_{self.user.id}',
                #     {
                #         'type': 'room_info',
                #         'message': message,
                #         'message_type': 'info',
                #         'timestamp': timezone.now().isoformat()
                #     })
                
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

            logger.info(f"Room WebSocket connection accepted for user {self.user.name} in room {self.room_id}", extra={
                'user_id': self.user.id
            })

            # Send initial room state
            await self.update_room()

            user_group = f"user_{self.user.id}"
            await self.channel_layer.group_add(
                user_group,
                self.channel_name
            )

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

            user_group = f"user_{self.user.id}"
            await self.channel_layer.group_discard(
                user_group,
                self.channel_name
            )
        except Exception as e:
            logger.error(f"Error during disconnect - error_type: {type(e).__name__}, error_message: {str(e)}, traceback: {traceback.format_exc()}", extra={
                'user_id': getattr(self.user, 'id', None)
            })

    async def receive(self, text_data):
        try:
            if hasattr(self, '_kicked') and self._kicked:
                logger.info(f"Ignoring message from kicked player - room_id: {self.room_id}, user_id: {getattr(self.user, 'id', None)}")
                return
            
            responses = []
            response = None
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
                player_id = data.get('player_id')
                success = await self.cancel_invitation(player_id)
                if success:  
                    await self.update_room()
                    response = {'id': message_id, 'status': 'success', 'message': 'Invitation cancelled'}
                else:
                    response = {'id': message_id, 'status': 'error', 'message': 'Failed to cancel invitation'}
            elif action == 'kick_player':
                player_id = data.get('player_id')
                success = await self.kick_player(player_id)
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
                    games = await self.create_game()
                    if not games:
                        response = {'id': message_id, 'status': 'error', 'message': 'Failed to create game'}
                    else:
                        for game in games:
                            responses.append({
                                'id': message_id, 
                                'status': 'success', 
                                'message': 'Game started', 
                                'data': {'game_id': game.id}
                            })
            else:
                logger.warning(f"Unknown action received: {action}")
                response = {'id': message_id, 'status': 'error', 'message': f'Unknown action: {action}'}

            if responses:
                for r in responses:
                    await self.send(text_data=json.dumps(r))
            elif response:
                await self.send(text_data=json.dumps(response))
            else:
                logger.warning("Aucune réponse générée pour l'action")

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

                # For LOCAL mode, only allow the owner
                if self.room.mode == 'LOCAL' and self.user != self.room.owner:
                    logger.error(f"Cannot add user to LOCAL room: Not the owner - room_id: {self.room_id}", extra={
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
        if hasattr(self, '_kicked') and self._kicked:
            logger.info(f"Not sending room update to kicked player - room_id: {self.room_id}, user_id: {getattr(self.user, 'id', None)}")
            return
        
        room_state = event['room_state']
        await self.send(text_data=json.dumps({
            'type': 'room_update',
            'room_state': room_state
        }))

    async def create_game(self):
        """Creates a new game for the room"""
        try:
            tournament = await self.get_tournament()
            
            if self.room.mode == 'TOURNAMENT' and not tournament:
                logger.error("Failed to create tournament")
                await self.update_room_state('LOBBY')
                return []
            
            await self.update_room_state('PLAYING')
            
            # Create tournament if mode is TOURNAMENT
            if self.room.mode == 'TOURNAMENT':
                tournament = await self.get_tournament()
                if not tournament:
                    logger.error("Failed to create tournament")
                    await self.update_room_state('LOBBY')
                    return []

            games = await self.create_game_with_settings() or []
            
            if not games:
                logger.error("Failed to create game with settings")
                await self.update_room_state('LOBBY')
                return []

            # Link games to tournament if exists
            if tournament:
                await self.add_games_to_tournament(tournament, games)

            settings = self.room.settings or {}

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'room_info',
                    'message': 'Round Started',
                    'message_type': 'info',
                    'timestamp': timezone.now().isoformat()
                }
            )
            for game in games:

                await self.channel_layer.group_send(
                    f"user_{game.player1.id}",
                    {
                        'type': 'room_info',
                        'message': f'Round starting against {game.player2.nick_name if game.player2 else "AI"}' if self.room.mode == "TOURNAMENT" else f'Match starting against {"Guest" if game.player2_is_guest else (game.player2.username if game.player2 else "AI")}',
                        'message_type': 'info',
                        'timestamp': timezone.now().isoformat()
                    }
                )

                if game.player2 and not game.player2_is_ai and not game.player2_is_guest:
                    await self.channel_layer.group_send(
                        f"user_{game.player2.id}",
                        {
                            'type': 'room_info',
                            'message': f'Match starting against {game.player1.nick_name}' if game.room.mode == "TOURNAMENT" else f'Match starting against {game.player1.username}',
                            'message_type': 'info',
                            'timestamp': timezone.now().isoformat()
                        }
                    )

                event_data = {
                    'type': 'game_started',
                    'data': {
                        'game_id': game.id,
                        'player1_id': game.player1.id,
                        'is_ai_game': game.player2_is_ai,
                        'is_local_game': game.player2_is_guest,
                        'settings': settings,
                        'tournament_id': tournament.id if tournament else None
                    }
                }

                if game.player2:
                    event_data['data']['player2_id'] = game.player2.id

                await self.channel_layer.group_send(
                    self.room_group_name,
                    event_data
                )
            
                logger.info(f"Game created and broadcast: {game.id} for room {self.room.id}")

            return games

        except Exception as e:
            logger.error(f"Error creating game: {str(e)}")
            await self.update_room_state('LOBBY')
            return []

    @database_sync_to_async
    def validate_game_creation(self):
        """Validates if a game can be created"""
        try:
            # For AI mode, we only need one player (the owner)
            if self.room.mode == 'AI':
                if self.room.players.count() < 1:
                    logger.error("No players in AI mode room")
                    return False, "No players in room"
            # For Local mode, we only need one player (the owner)
            elif self.room.mode == 'LOCAL':
                if self.room.players.count() < 1:
                    logger.error("No players in LOCAL mode room")
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
        """Crée un nouveau jeu avec les paramètres actuels"""
        try:
            games = []
            
            tournament = getattr(self.room, 'tournament', None)
            eliminated_players = list(tournament.eliminated.all()) if tournament else []
            
            player_pairs = self.pair_players(
                list(self.room.players.all()), 
                eliminated_players
            )
            
            if not player_pairs:
                logger.error("Aucun joueur actif pour créer des matchs")
                return []
            
            if len(player_pairs[0]) == 1 and len(player_pairs) == 1 and self.room.mode == 'TOURNAMENT':
                logger.info(f"{player_pairs[0][0].nick_name} win the tournament")
                self.room.tournament.eliminated.clear()
                return []

            logger.info(f"Generated Pairs : {[[p.id for p in pair if p] for pair in player_pairs]}")
            
            for pair in player_pairs:
                if len(pair) >= 1:
                    games.append(PongGame.objects.create(
                        room=self.room,
                        player1=pair[0],
                        player2=pair[1] if len(pair) > 1 else None,
                        player2_is_ai=self.room.mode == 'AI',
                        player2_is_guest=self.room.mode == 'LOCAL',
                        status='ongoing'
                    ))
                    logger.info(f"Jeu créé : {games[-1].id}")
            
            return games
        except Exception as e:
            logger.error(f"Erreur création jeu : {str(e)}")
            return []

    async def game_started(self, event):
        """Handle game started event and send to client"""
        # logger.info(f"Handling game started event: {event}")
        
        # Extract data from the event
        event_data = event.get('data', {})
        
        response_data = {
            'type': 'game_started',
            'game_id': event_data.get('game_id'),
            'player1_id': event_data.get('player1_id'),
            'is_ai_game': event_data.get('is_ai_game', False),
            'is_local_game': event_data.get('is_local_game', False),
            'settings': event_data.get('settings', {})
        }
        
        if 'player2_id' in event_data:
            response_data['player2_id'] = event_data['player2_id']

        # logger.info(f"Sending game started response: {response_data}")
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

    @database_sync_to_async
    def all_game_finished(self):
        if self.room.mode != "TOURNAMENT":
            return True
        
        tournament = self.room.tournament
        return all(
            game.status == PongGame.Status.FINISHED 
            for game in tournament.pong_games.all()
        )

    @database_sync_to_async
    def clean_tournament(self):
        tournament = self.room.tournament
        for game in tournament.pong_games.filter(status='finished'):
            tournament.pong_games.remove(game)
            logger.info(f"Jeu {game.id} retiré du tournoi {tournament.id}")
        tournament.save()

    @database_sync_to_async
    def tournament_finished(self):
        logger.info(f"{self.room.players.all()}, {self.room.tournament.eliminated.all()}")
        if len(self.room.players.all()) == len(self.room.tournament.eliminated.all()) + 1:
            winner = next(player for player in self.room.players.all() if player not in self.room.tournament.eliminated.all())
            self.room.tournament.eliminated.clear()
            logger.info(f"{winner.nick_name} win the tournament")
            return winner

        return None

    async def game_finished(self, event):
        """
        Handle game finished event and update room state
        """
        try:
            if self.room.mode == "TOURNAMENT":
                await self.add_eliminated_player(event['loser']) 
            if not await self.is_room_owner():
                await self.send(text_data=json.dumps({
                    'type': 'game_finished',
                    'winner_id': event['winner_id'],
                    'final_score': event['final_score']
                }))
                return                
           

            if self.room.state != 'LOBBY' and await self.all_game_finished():

                await self.update_room_property('state', 'LOBBY')
                
                if self.room.mode == "TOURNAMENT":
                    winner = await self.tournament_finished()
                    if winner:
                        await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'room_info',
                            'message': f'{winner.nick_name} win the tournament',
                            'message_type': 'info',
                            'timestamp': timezone.now().isoformat()
                        })
                    else:
                        await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'room_info',
                            'message': 'Round finished',
                            'message_type': 'info',
                            'timestamp': timezone.now().isoformat()
                        })
                else:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'room_info',
                            'message': 'Game finished',
                            'message_type': 'info',
                            'timestamp': timezone.now().isoformat()
                        })

            await self.send(text_data=json.dumps({
                'type': 'game_finished',
                'winner_id': event['winner_id'],
                'final_score': event['final_score']
            }))

            await self.update_room()
            
        except Exception as e:
            logger.error(f"Error handling game finished event: {str(e)}", extra={
                'user_id': getattr(self.user, 'id', None)
            }) 

    @database_sync_to_async
    def is_room_owner(self):
        return self.user == self.room.owner

    @database_sync_to_async
    def kick_player(self, player_id):
        """Kick a player from the room"""
        try:
            if not self.user == self.room.owner:
                logger.error(f"Cannot kick player: Not the owner - room_id: {self.room_id}, player_id: {player_id}", extra={
                    'user_id': self.user.id
                })
                return False
            
            if not player_id or player_id == "":
                logger.error(f"Cannot kick player: Invalid player ID - room_id: {self.room_id}, player_id: {player_id}", extra={
                    'user_id': self.user.id
                })
                return False
                
            try:
                player = User.objects.get(id=player_id)
            except User.DoesNotExist:
                logger.error(f"Cannot kick player: Player not found - room_id: {self.room_id}, player_id: {player_id}", extra={
                    'user_id': self.user.id
                })
                return False
                
            # Room owner can't kick themselves
            if player.id == self.room.owner.id:
                logger.error(f"Cannot kick player: Cannot kick room owner - room_id: {self.room_id}, player_id: {player_id}", extra={
                    'user_id': self.user.id
                })
                return False
                
            # Remove player from room
            if player in self.room.players.all():
                self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'handle_player_kicked',
                        'player_id': player.id
                    }
                )
                                
                self.room.players.remove(player)
                
                logger.info(f"Player kicked from room - room_id: {self.room_id}, player_id: {player_id}", extra={
                    'user_id': self.user.id
                })
                return True
            else:
                logger.error(f"Cannot kick player: Player not in room - room_id: {self.room_id}, player_id: {player_id}", extra={
                    'user_id': self.user.id
                })
                return False
                
        except Exception as e:
            logger.error(f"Error kicking player - error: {str(e)}, room_id: {self.room_id}, player_id: {player_id}", extra={
                'user_id': self.user.id
            })
            return False
            
    @database_sync_to_async
    def cancel_invitation(self, invitation_id):
        """Cancel a pending invitation to the room"""
        try:
            if not self.user == self.room.owner:
                logger.error(f"Cannot cancel invitation: Not the owner - room_id: {self.room_id}, invitation_id: {invitation_id}", extra={
                    'user_id': self.user.id
                })
                return False
                
            if not invitation_id or invitation_id == "":
                logger.error(f"Cannot cancel invitation: Invalid invitation ID - room_id: {self.room_id}, invitation_id: {invitation_id}", extra={
                    'user_id': self.user.id
                })
                return False
                
            try:
                invited_user = User.objects.get(id=invitation_id)
            except User.DoesNotExist:
                logger.error(f"Cannot cancel invitation: User not found - room_id: {self.room_id}, invitation_id: {invitation_id}", extra={
                    'user_id': self.user.id
                })
                return False
                
            # Remove from pending invitations
            if invited_user in self.room.pending_invitations.all():
                self.room.pending_invitations.remove(invited_user)
                
                logger.info(f"Invitation canceled - room_id: {self.room_id}, invitation_id: {invitation_id}", extra={
                    'user_id': self.user.id
                })
                return True
            else:
                logger.error(f"Cannot cancel invitation: User not in pending invitations - room_id: {self.room_id}, invitation_id: {invitation_id}", extra={
                    'user_id': self.user.id
                })
                return False
                
        except Exception as e:
            logger.error(f"Error canceling invitation - error: {str(e)}, room_id: {self.room_id}, invitation_id: {invitation_id}", extra={
                'user_id': self.user.id
            })
            return False

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
            
            #  logger.info(f"Settings updated - room: {self.room_id}, setting: {setting}, value: {value}")
            return True
        except Exception as e:
            logger.error(f"Error updating settings: {str(e)}")
            return False 

    def pair_players(self, player_ids: list, eliminated: list) -> list:
        """Group players into pairs for multiple concurrent games"""
        logger.info(f"Eliminated list {eliminated}")
        active_players = [player for player in player_ids if player not in eliminated]
        
        if not active_players:
            return []
        
        if len(active_players) == 1:
            return [[active_players[0]]]
        
        max_index = len(active_players) - 1 if len(active_players) % 2 != 0 else len(active_players)
        
        pairs = [
            active_players[i:i+2] 
            for i in range(0, max_index, 2)
        ]
        
        logger.info(f"Player pairs generated: {[[p.id for p in pair] for pair in pairs]}")
        return pairs

    @database_sync_to_async
    def get_tournament(self):
        """Create or get existing tournament linked to the room"""
        try:
            if hasattr(self.room, 'tournament') and self.room.tournament:
                return self.room.tournament
            
            tournament = Tournament.objects.create(
                name=f"Tournament {self.room.room_id}",
                pong_room=self.room,
                status='ONGOING'
            )
            self.room.tournament = tournament
            self.room.save()
            return tournament
        except Exception as e:
            logger.error(f"Error creating tournament: {str(e)}")
            return None

    @database_sync_to_async
    def add_games_to_tournament(self, tournament, games):
        """Add games to tournament's pong_games"""
        try:
            tournament.pong_games.add(*games)
            tournament.save()
        except Exception as e:
            logger.error(f"Error adding games to tournament: {str(e)}")

    async def room_info(self, event):
        """Envoie les messages d'information de la salle à tous les clients"""
        await self.send(text_data=json.dumps({
            'type': 'room_info',
            'message': event['message'],
            'message_type': event.get('message_type', 'info'),
            'timestamp': event.get('timestamp')
        }))

    @database_sync_to_async
    def add_eliminated_player(self, player):
        """Ajoute un joueur éliminé au tournoi de manière thread-safe"""
        self.room.tournament.eliminated.add(player)

    async def handle_player_kicked(self, event):
        """Handle player kicked event - only the kicked player will close their connection"""
        player_id = event.get('player_id')
        
        try:
            if str(self.user.id) == str(player_id):
                logger.info(f"Processing kick for player - room_id: {self.room_id}, player_id: {player_id}")
                self._kicked = True
                await database_sync_to_async(self.room.players.remove)(self.user)
                
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'code': 4008,
                    'error': event.get('message', 'You have been kicked from the room')
                }))
                
                try:
                    await self.close(code=4008)
                except Exception as e:
                    logger.error(f"Error closing connection for kicked player - error: {str(e)}")
                    # Fallback to normal close
                    await self.close()
        except Exception as e:
            logger.error(f"Error handling player kicked - room_id: {self.room_id}, player_id: {player_id}, error: {str(e)}")

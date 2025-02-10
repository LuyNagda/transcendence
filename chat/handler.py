import json
import logging
from typing import Dict, Any, Optional, Callable, Awaitable, TypedDict, Union
from django.db import models
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth import get_user_model
from .models import ChatMessage, BlockedUser
from pong.models import PongRoom
from authentication.models import User
import uuid

User = get_user_model()

log = logging.getLogger(__name__)

class MessageResponse(TypedDict, total=False):
    type: str
    success: bool
    error: Optional[str]
    data: Optional[Dict[str, Any]]

class ChatHandler:
    def __init__(self, consumer):
        self.consumer = consumer

    async def send_response(self, response_type: str, success: bool = True, data: Optional[Dict[str, Any]] = None, error: Optional[str] = None) -> None:
        """
        Send responses back to the client
        """
        response: MessageResponse = {
            'type': response_type,
            'success': success
        }
        if data is not None:
            response['data'] = data
        if error is not None:
            response['error'] = error
            
        await self.consumer.send(text_data=json.dumps(response))

    async def handle_message(self, message_type: str, data: Dict[str, Any]) -> None:
        actions: Dict[str, Callable[[Dict[str, Any]], Awaitable[None]]] = {
            'chat_message': self.handle_chat_message,
            'add_friend': self.handle_add_friend,
            'user_status_change': self.handle_user_status_change,
            'get_profile': self.handle_get_profile,
            'game_invitation': self.handle_game_invitation,
            'accept_game_invitation': self.handle_accept_game_invitation,
            'tournament_warning': self.handle_tournament_warning,
            'accept_friend_request': self.handle_accept_friend_request,
            'deny_friend_request': self.handle_deny_friend_request
        }

        try:
            handler = actions.get(message_type)
            if handler:
                log.debug('Handling message', extra={
                    'user_id': self.consumer.user.id,
                    'message_type': message_type,
                    'data': json.dumps(data)
                })
                await handler(data)
            else:
                log.warning('Unhandled message type', extra={
                    'user_id': self.consumer.user.id,
                    'message_type': message_type
                })
                await self.send_response('error', success=False, error='Invalid message type')
        except KeyError as e:
            log.error('Missing required data', extra={
                'user_id': self.consumer.user.id,
                'message_type': message_type,
                'error': str(e)
            })
            await self.send_response('error', success=False, error=f'Missing required data: {str(e)}')
        except Exception as e:
            log.error('Error handling message', extra={
                'user_id': self.consumer.user.id,
                'message_type': message_type,
                'error': str(e)
            })
            await self.send_response('error', success=False, error='An error occurred while processing your request')

    async def handle_tournament_warning(self, data: Dict[str, Any]) -> None:
        log.warning('Tournament warning received', extra={
            'user_id': self.consumer.user.id,
            'data': json.dumps(data)
        })
        await self.send_response('tournament_warning_received', success=True)

    @database_sync_to_async
    def is_blocked(self, recipient_id: int) -> bool:
        try:
            return BlockedUser.objects.filter(
                models.Q(user_id=recipient_id, blocked_user=self.consumer.user) |
                models.Q(user=self.consumer.user, blocked_user_id=recipient_id)
            ).exists()
        except Exception as e:
            log.error('Error checking blocked status', extra={
                'user_id': self.consumer.user.id,
                'recipient_id': recipient_id,
                'error': str(e)
            })
            return False

    async def handle_add_friend(self, data: Dict[str, Any]) -> None:
        if 'friend_username' not in data:
            raise KeyError('friend_username')
        
        friend_username = data['friend_username']

        try:
            friend = await self.get_user_by_username(friend_username)
            if not friend:
                await self.send_response('add_friend', success=False, error='Error sending friend request')
                return
            
            # Check if friend is already in the user's friends list
            friends = await self.get_consumer_friends(self.consumer.user)
            if friend.id in [f.id for f in friends]:
                await self.send_response('add_friend', success=False, error='User is already in your friends list')
                return
            
            # Add friend to user's friends list
            await self.send_response('add_friend', success=True, data={'friend': self.serialize_user(friend)})
            await self.consumer.channel_layer.group_send(
                f"chat_{friend.id}",
                {
                    'type': 'friend_request',
                    'message': f'{self.consumer.user.username} sent you a friend request',
                    'sender_id': self.consumer.user.id
                }
            )
            log.info(f"Friend request sent to {friend_username} from {self.consumer.user.username}", extra={
                'user_id': self.consumer.user.id
            })

        except Exception as e:
            log.error(f'Error getting user by username {friend_username}: {str(e)}', extra={
                'user_id': self.consumer.user.id
            })
            raise
        
    async def handle_accept_friend_request(self, data: Dict[str, Any]) -> None:
        sender_id = data.get('sender_id')
        if not sender_id:
            await self.send_response('accept_friend_request', success=False, error='Missing sender_id')
            return

        sender = await self.get_user_by_id(sender_id)
        if not sender:
            await self.send_response('accept_friend_request', success=False, error='User not found')
            return

        # Add sender to the user's friends list
        await self.add_friend(self.consumer.user, sender)
        await self.send_response('accept_friend_request', success=True, data={'sender_id': sender_id})

    async def handle_deny_friend_request(self, data: Dict[str, Any]) -> None:
        sender_id = data.get('sender_id')
        if not sender_id:
            await self.send_response('deny_friend_request', success=False, error='Missing sender_id')
            return

        # No additional action needed for denying a friend request
        await self.send_response('deny_friend_request', success=True, data={'sender_id': sender_id})
    
    @database_sync_to_async
    def get_user_by_username(self, username: str) -> Optional[User]:
        try:
            user = User.objects.get(username=username)
            log.info(f"User found:", user)
            return user
        except ObjectDoesNotExist:
            return None

    @database_sync_to_async
    def get_consumer_friends(self, user: User) -> list[User]:
        return list(user.friends.all())
    
    @database_sync_to_async
    def get_user_by_id(self, user_id: int) -> Optional[User]:
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    @database_sync_to_async
    def add_friend(self, user: User, friend: User) -> None:
        user.friends.add(friend)
        friend.friends.add(user)
        user.save()
        friend.save()

    def serialize_user(self, user: User) -> Dict[str, Any]:
        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            # Add other fields as needed
        }

    async def handle_chat_message(self, data: Dict[str, Any]) -> None:
        if 'message' not in data or 'recipient_id' not in data:
            raise KeyError('message, recipient_id')
        
        message = data['message']
        recipient_id = data['recipient_id']

        try:
            if await self.is_blocked(recipient_id):
                await self.send_response('chat_message', success=False, error='Message blocked: User is blocked')
                return

            saved_message = await self.save_message(message, recipient_id)
            formatted_message = {
                'id': saved_message.id,
                'content': saved_message.content,
                'timestamp': int(saved_message.timestamp.timestamp() * 1000),
                'type': message.get('type', 'text') if isinstance(message, dict) else 'text'
            }

            # Send to recipient's channel group
            await self.consumer.channel_layer.group_send(
                f"chat_{recipient_id}",
                {
                    'type': 'chat_message',
                    'message': formatted_message,
                    'sender_id': self.consumer.user.id
                }
            )

            await self.send_response('chat_message', success=True, data={'message': formatted_message})

        except ObjectDoesNotExist:
            await self.send_response('chat_message', success=False, error='Recipient not found')
        except Exception as e:
            log.error(f'Error handling chat message from recipient {recipient_id}: {str(e)}', extra={
                'user_id': self.consumer.user.id
            })
            raise

    async def handle_user_status_change(self, data: Dict[str, Any]) -> None:
        if 'user_id' not in data or 'status' not in data:
            raise KeyError('user_id, status')
        
        user_id = data['user_id']
        status = data['status']
        
        try:
            if user_id == self.consumer.user.id:
                await self.consumer.broadcast_status(status)
                await self.send_response('status_change', success=True, data={'status': status})
            else:
                await self.send_response('status_change', success=False, error='Can only change own status')
        except Exception as e:
            log.error(f'Error handling status change {status} : {str(e)}', extra={
                'user_id': self.consumer.user.id
            })
            raise

    async def handle_game_invitation(self, data: Dict[str, Any]) -> None:
        if 'recipient_id' not in data or 'room_id' not in data:
            raise KeyError('recipient_id, room_id')
        
        recipient_id = data['recipient_id']
        room_id = data['room_id']

        try:
            if await self.is_blocked(recipient_id):
                await self.send_response('game_invitation', success=False, error='Cannot invite: User is blocked')
                return

            # Verify room exists and user is owner
            room = await self.get_pong_room(room_id)
            if not room:
                await self.send_response('game_invitation', success=False, error='Room not found')
                return
            
            owner_id = await self.get_room_owner_id(room)
            if owner_id != self.consumer.user.id:
                await self.send_response('game_invitation', success=False, error='Only room owner can send invitations')
                return
            
            # Add recipient to pending invitations
            success = await self.add_to_pending_invitations(room_id, recipient_id)
            if not success:
                raise Exception('Failed to add recipient to pending invitations')

            # Send invitation to recipient
            await self.consumer.channel_layer.group_send(
                f"chat_{recipient_id}",
                {
                    'type': 'game_invitation',
                    'sender_id': self.consumer.user.id,
                    'room_id': room_id
                }
            )
            
            await self.send_response('game_invitation', success=True, data={
                'recipient_id': recipient_id,
                'room_id': room_id
            })

        except ObjectDoesNotExist:
            await self.send_response('game_invitation', success=False, error='Recipient not found')
        except Exception as e:
            log.error(f"Error handling game invitation: {str(e)}", extra={
                'user_id': self.consumer.user.id,
                'recipient_id': recipient_id,
                'room_id': room_id
            })
            raise

    @database_sync_to_async
    def get_pong_room(self, room_id: str) -> Optional[PongRoom]:
        try:
            return PongRoom.objects.get(room_id=room_id)
        except PongRoom.DoesNotExist:
            return None

    @database_sync_to_async
    def add_to_pending_invitations(self, room_id: str, recipient_id: int) -> bool:
        try:
            room = PongRoom.objects.get(room_id=room_id)
            recipient = User.objects.get(id=recipient_id)
            room.pending_invitations.add(recipient)
            return True
        except (PongRoom.DoesNotExist, User.DoesNotExist) as e:
            log.error(f"Error adding to pending invitations room {room_id} recipient {recipient_id}: {str(e)}")
            return False

    @database_sync_to_async
    def check_room_full(self, room: PongRoom) -> tuple[bool, int]:
        return room.is_full, room.max_players

    async def handle_accept_game_invitation(self, data: Dict[str, Any]) -> None:
        if 'sender_id' not in data:
            raise KeyError('sender_id')
        
        sender_id = data['sender_id']

        try:
            # Find room with pending invitation
            room = await self.get_room_with_pending_invitation(sender_id)
            if not room:
                await self.send_response('accept_game_invitation', success=False, error='No pending invitation found')
                return

            # Check if room is full
            room_obj = await self.get_pong_room(room['room_id'])
            if not room_obj:
                await self.send_response('accept_game_invitation', success=False, error='Room not found')
                return

            is_full, max_players = await self.check_room_full(room_obj)
            if is_full:
                await self.send_response('accept_game_invitation', success=False, 
                    error=f'Room is full, already has maximum {max_players} player(s)')
                return

            # Remove from pending invitations
            await self.remove_from_pending_invitations(room['room_id'])

            # Send success response with room info
            await self.send_response('accept_game_invitation', success=True, data={'room_id': room['room_id']})

        except Exception as e:
            log.error(f"Error handling game invitation acceptance: {str(e)}", extra={
                'user_id': self.consumer.user.id
            })
            raise

    @database_sync_to_async
    def get_room_with_pending_invitation(self, owner_id: int) -> Optional[Dict[str, Any]]:
        try:
            room = PongRoom.objects.filter(
                owner_id=owner_id,
                pending_invitations__id=self.consumer.user.id
            ).first()
            if room:
                return {
                    'room_id': room.room_id,
                    'owner_id': room.owner_id
                }
            return None
        except Exception as e:
            log.error(f"Error getting room with pending invitation: {str(e)}")
            return None

    @database_sync_to_async
    def remove_from_pending_invitations(self, room_id: str) -> bool:
        try:
            room = PongRoom.objects.get(room_id=room_id)
            room.pending_invitations.remove(self.consumer.user)
            return True
        except PongRoom.DoesNotExist:
            return False

    async def handle_get_profile(self, data: Dict[str, Any]) -> None:
        if 'user_id' not in data:
            raise KeyError('user_id')
            
        try:
            profile = await self.get_user_profile(data['user_id'])
            if profile:
                await self.send_response('user_profile', success=True, data={'profile': profile})
            else:
                await self.send_response('user_profile', success=False, error='User profile not found')
        except Exception as e:
            log.error(f'Error getting user profile {data["user_id"]}', extra={
                'user_id': self.consumer.user.id
            })
            raise

    @database_sync_to_async
    def get_user_profile(self, user_id: int) -> Optional[Dict[str, Any]]:
        try:
            user = User.objects.get(id=user_id)
            return {
                'id': user.id,
                'username': user.username,
                'nick_name': getattr(user, 'nick_name', ''),
                'profile_picture': user.profile_picture.url if hasattr(user, 'profile_picture') and user.profile_picture else None,
                'online': getattr(user, 'online', False),
            }
        except ObjectDoesNotExist:
            log.error(f"User with id {user_id} not found", extra={
                'user_id': self.consumer.user.id
            })
            return None
        except Exception as e:
            raise e

    @database_sync_to_async
    def save_message(self, message: Union[str, Dict[str, Any]], recipient_id: int) -> ChatMessage:
        try:
            recipient = User.objects.get(id=recipient_id)
            # Extract content from message object if it's a dict
            content = message.get('content') if isinstance(message, dict) else message
            return ChatMessage.objects.create(
                sender=self.consumer.user,
                recipient=recipient,
                content=content
            )
        except ObjectDoesNotExist:
            log.error(f"Recipient with id {recipient_id} not found", extra={
                'user_id': self.consumer.user.id
            })
            raise ObjectDoesNotExist("Recipient not found")
        except Exception as e:
            log.error(f"Error saving message: {str(e)}", extra={
                'user_id': self.consumer.user.id
            })
            raise e

    @database_sync_to_async
    def get_room_owner_id(self, room: PongRoom) -> int:
        return room.owner.id
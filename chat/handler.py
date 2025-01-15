import json
import logging
from django.db import models
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth import get_user_model
from .models import ChatMessage, BlockedUser
from pong.models import PongRoom
import uuid

User = get_user_model()

log = logging.getLogger(__name__)

class ChatHandler:
    def __init__(self, consumer):
        self.consumer = consumer

    async def handle_message(self, message_type, data):
        actions = {
            'chat_message': self.handle_chat_message,
            'user_status_change': self.handle_user_status_change,
            'get_profile': self.handle_get_profile,
            'game_invitation': self.handle_game_invitation,
            'accept_game_invitation': self.handle_accept_game_invitation,
            'tournament_warning': self.handle_tournament_warning
        }
        handler = actions.get(message_type)
        if handler:
            log.debug(f'Calling handler for message type: {message_type}', extra={
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
            await self.consumer.send(text_data=json.dumps({
                'error': 'Invalid message type'
            }))

    async def handle_tournament_warning(self, data):
        log.warning('Tournament warning received', extra={
            'user_id': self.consumer.user.id,
            'data': json.dumps(data)
        })

    @database_sync_to_async
    def is_blocked(self, recipient_id):
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

    async def handle_chat_message(self, data):
        log.debug('Handling chat message', extra={
            'user_id': self.consumer.user.id,
            'data': json.dumps(data)
        })

        if 'message' not in data or 'recipient_id' not in data:
            raise KeyError('Missing required keys: message or recipient_id')
        
        message = data['message']
        recipient_id = data['recipient_id']
        if await self.is_blocked(recipient_id):
            await self.consumer.send(text_data=json.dumps({
                'error': 'You are blocked...'
            }))
            return

        try:
            await self.save_message(message, recipient_id)
        except ObjectDoesNotExist:
            await self.consumer.send(text_data=json.dumps({
                'error': 'Recipient not found'
            }))
            return
        except Exception as e:
            # Re-raise the exception to be caught by handle_message
            raise e

        await self.consumer.channel_layer.group_send(
            f"chat_{recipient_id}",
            {
                'type': 'chat_message',
                'message': message,
                'sender_id': self.consumer.user.id
            }
        )

    async def handle_user_status_change(self, data):
        if 'user_id' not in data or 'status' not in data:
            raise KeyError('Missing required keys: user_id or status')
        user_id = data['user_id']
        status = data['status']
        if user_id == self.consumer.user.id:
            await self.consumer.broadcast_status(status)

    async def handle_game_invitation(self, data):
        if 'recipient_id' not in data or 'game_id' not in data:
            raise KeyError('Missing required keys: recipient_id or game_id')
        recipient_id = data['recipient_id']
        game_id = data['game_id']

        if await self.is_blocked(recipient_id):
            await self.consumer.send(text_data=json.dumps({
                'error': 'You are blocked...'
            }))
            return

        try:
            # Create a new room for the invitation
            room_response = await self.create_pong_room()
            if not room_response.get('status') == 'success':
                raise Exception('Failed to create pong room')
            
            room_id = room_response.get('room_id')
            
            # Add recipient to pending invitations
            success = await self.add_to_pending_invitations(room_id, recipient_id)
            if not success:
                raise Exception('Failed to add recipient to pending invitations')

            # Send invitation to recipient
            await self.consumer.channel_layer.group_send(
                f"chat_{recipient_id}",
                {
                    'type': 'game_invitation',
                    'game_id': game_id,
                    'sender_id': self.consumer.user.id,
                    'room_id': room_id
                }
            )
        except ObjectDoesNotExist:
            await self.consumer.send(text_data=json.dumps({
                'error': 'Recipient not found'
            }))
            return
        except Exception as e:
            raise e

    @database_sync_to_async
    def create_pong_room(self):
        try:
            room_id = str(uuid.uuid4())[:8]
            room = PongRoom.objects.create(
                room_id=room_id,
                owner=self.consumer.user,
                mode='CLASSIC'
            )
            room.players.add(self.consumer.user)
            return {
                'status': 'success',
                'room_id': room_id,
                'room_data': room.serialize()
            }
        except Exception as e:
            log.error(f"Error creating pong room: {str(e)}")
            return {
                'status': 'error',
                'message': 'Failed to create room'
            }

    @database_sync_to_async
    def add_to_pending_invitations(self, room_id, recipient_id):
        try:
            room = PongRoom.objects.get(room_id=room_id)
            recipient = User.objects.get(id=recipient_id)
            room.pending_invitations.add(recipient)
            return True
        except (PongRoom.DoesNotExist, User.DoesNotExist) as e:
            log.error(f"Error adding to pending invitations: {str(e)}")
            return False

    async def handle_accept_game_invitation(self, data):
        if 'sender_id' not in data or 'game_id' not in data:
            raise KeyError('Missing required keys: sender_id or game_id')
        
        sender_id = data['sender_id']
        game_id = data['game_id']

        try:
            # Find room with pending invitation
            room = await self.get_room_with_pending_invitation(sender_id)
            if not room:
                await self.consumer.send(text_data=json.dumps({
                    'error': 'No pending invitation found'
                }))
                return

            # Remove from pending invitations
            await self.remove_from_pending_invitations(room['room_id'])

            # Notify the sender
            await self.consumer.channel_layer.group_send(
                f"chat_{sender_id}",
                {
                    'type': 'redirect',
                    'url': f'/pong/room/{room["room_id"]}/'
                }
            )

            # Redirect the recipient
            await self.consumer.send(text_data=json.dumps({
                'type': 'redirect',
                'url': f'/pong/room/{room["room_id"]}/'
            }))

        except Exception as e:
            log.error(f"Error handling game invitation acceptance: {str(e)}", extra={
                'user_id': self.consumer.user.id
            })
            raise e

    @database_sync_to_async
    def get_room_with_pending_invitation(self, owner_id):
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
    def remove_from_pending_invitations(self, room_id):
        try:
            room = PongRoom.objects.get(room_id=room_id)
            room.pending_invitations.remove(self.consumer.user)
            return True
        except PongRoom.DoesNotExist:
            return False

    async def handle_get_profile(self, data):
        if 'user_id' not in data:
            raise KeyError('Missing required keys: user_id')
        profile = await self.get_user_profile(data['user_id'])
        if profile:
            await self.consumer.send(text_data=json.dumps({
                'type': 'user_profile',
                'profile': profile
            }))
        else:
            await self.consumer.send(text_data=json.dumps({
                'type': 'error',
                'message': 'User profile not found'
            }))

    @database_sync_to_async
    def get_user_profile(self, user_id):
        try:
            user = User.objects.get(id=user_id)
            return {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'bio': getattr(user, 'bio', ''),
                'name': getattr(user, 'name', ''),
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
    def save_message(self, message, recipient_id):
        try:
            recipient = User.objects.get(id=recipient_id)
            return ChatMessage.objects.create(
                sender=self.consumer.user,
                recipient=recipient,
                content=message
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
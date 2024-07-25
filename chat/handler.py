import json
import logging
import asyncio
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth import get_user_model
from .models import ChatMessage, BlockedUser, GameInvitation

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
            'tournament_warning': lambda data: log.warning(f"TODO : Implementation: {message_type}")
        }
        handler = actions.get(message_type, lambda data: log.warning(f"Unhandled message type: {message_type}") or asyncio.sleep(0))
        await handler(data)

    @database_sync_to_async
    def is_blocked(self, recipient_id):
        try:
            return BlockedUser.objects.filter(user_id=recipient_id, blocked_user=self.consumer.user).exists()
        except Exception as e:
            log.error(f"Error checking blocked status: {str(e)}")
            return False

    async def handle_chat_message(self, data):
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

        await self.consumer.channel_layer.group_send(
            f"chat_{recipient_id}",
            {
                'type': 'chat_message',
                'message': message,
                'sender_id': self.consumer.user.id
            }
        )

    async def handle_user_status_change(self, data):
        user_id = data['user_id']
        status = data['status']
        if user_id == self.consumer.user.id:
            await self.consumer.broadcast_status(status)

    async def handle_game_invitation(self, data):
        recipient_id = data['recipient_id']
        game_id = data['game_id']

        if await self.is_blocked(recipient_id):
            await self.consumer.send(text_data=json.dumps({
                'error': 'You are blocked...'
            }))
            return

        try:
            await self.delete_existing_invitation(recipient_id, game_id)
            await self.save_game_invitation(game_id, recipient_id)
        except ObjectDoesNotExist:
            await self.consumer.send(text_data=json.dumps({
                'error': 'Recipient not found'
            }))
            return
        
        await self.consumer.channel_layer.group_send(
            f"chat_{recipient_id}",
            {
                'type': 'game_invitation',
                'game_id': game_id,
                'sender_id': self.consumer.user.id
            }
        )

    async def handle_get_profile(self, data):
        if await self.is_blocked(data['user_id']):
            await self.consumer.send(text_data=json.dumps({
                'error': 'You are blocked...'
            }))
            return

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
            log.error(f"User with id {user_id} not found")
            return None
        except Exception as e:
            log.error(f"Error fetching user profile: {str(e)}")
            return None

    @database_sync_to_async
    def save_message(self, message, recipient_id):
        try:
            recipient = User.objects.get(id=recipient_id)
            ChatMessage.objects.create(
                sender=self.consumer.user,
                recipient=recipient,
                content=message
            )
        except ObjectDoesNotExist:
            log.error(f"Recipient with id {recipient_id} not found")
            raise ObjectDoesNotExist("Recipient not found")
        except Exception as e:
            log.error(f"Error saving message: {str(e)}")
            raise Exception("Error saving message")
        
    @database_sync_to_async
    def save_game_invitation(self, game_id, recipient_id):
        try:
            recipient = User.objects.get(id=recipient_id)
            GameInvitation.objects.create(
                sender=self.consumer.user,
                recipient=recipient,
                game_id=game_id
            )
        except ObjectDoesNotExist:
            log.error(f"Recipient with id {recipient_id} not found")
            raise ObjectDoesNotExist("Recipient not found")
        except Exception as e:
            log.error(f"Error saving game invitation: {str(e)}")
            raise Exception("Error saving game invitation")
        
    @database_sync_to_async
    def delete_existing_invitation(self, recipient_id, game_id):
       	GameInvitation.objects.filter(recipient_id=recipient_id, game_id=game_id).delete()
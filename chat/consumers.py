import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import BlockedUser
from .handler import ChatHandler
from channels.exceptions import DenyConnection

User = get_user_model()

log = logging.getLogger(__name__)

all = 'all_users'

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]
        log.info('WebSocket connection attempt', extra={
            'user_id': getattr(self.user, 'id', None),
            'authenticated': self.user.is_authenticated
        })
        if not self.user.is_authenticated:
            log.error('Unauthenticated user connection attempt', extra={
                'user_id': getattr(self.user, 'id', None)
            })
            raise DenyConnection("User is not authenticated")

        self.user_group_name = f"chat_{self.user.id}"
        self.handler = ChatHandler(self)
        
        await self.channel_layer.group_add(all, self.channel_name)
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.set_user_online()
        await self.accept()
        await self.broadcast_status('online')
        log.info('WebSocket connected', extra={
            'user_id': self.user.id
        })

    async def disconnect(self, close_code):
        if hasattr(self, 'user') and self.user.is_authenticated:
            await self.broadcast_status('offline')
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)
            await self.set_user_offline()
        await self.channel_layer.group_discard(all, self.channel_name)
        log.info(f"WebSocket disconnected", extra={
            'user_id': getattr(self.user, 'id', 'Unknown')
        })

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data['type']
            await self.handler.handle_message(message_type, data)
        except json.JSONDecodeError:
            log.error('Received invalid JSON data', extra={
                'user_id': self.user.id
            })
            await self.send(text_data=json.dumps({'error': 'Invalid JSON data'}))
        except KeyError as e:
            log.error('Missing key in received data', extra={
                'user_id': self.user.id,
                'missing_key': str(e)
            })
            await self.send(text_data=json.dumps({'error': 'Missing keys in received data'}))
        except ValueError as e:
            log.error('Value error in received data', extra={
                'user_id': self.user.id,
                'error': str(e)
            })
            await self.send(text_data=json.dumps({'error': 'Value error in received data'}))
        except Exception as e:
            log.error('Unexpected error', extra={
                'user_id': self.user.id,
                'error': str(e)
            })
            await self.send(text_data=json.dumps({'error': 'An unexpected error occurred'}))

    @database_sync_to_async
    def set_user_online(self):
        if self.user.is_authenticated:
            self.user.online = True
            self.user.save()
        else:
            log.warning("Attempted to set AnonymousUser online")

    @database_sync_to_async
    def set_user_offline(self):
        User.objects.filter(id=self.user.id).update(online=False)

    async def broadcast_status(self, status):
        user_ids = await self.get_allowed_user_ids()
        for recipient_id in user_ids:
            await self.channel_layer.group_send(
                f"chat_{recipient_id}",
                {
                    "type": "user_status_change",
                    "user_id": self.user.id,
                    "status": status
                }
            )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'sender_id': event['sender_id']
        }))

    async def user_status_change(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_status_change',
            'user_id': event['user_id'],
            'status': event['status']
        }))

    async def game_invitation(self, event):
        log.debug(f"{self.user.id} - Received game invitation")
        await self.send(text_data=json.dumps({
            'type': 'game_invitation',
            'game_id': event['game_id'],
            'sender_id': event['sender_id']
        }))

    @database_sync_to_async
    def get_allowed_user_ids(self):
        if not self.user.is_authenticated:
            return []
        # Exclude users who have blocked the current user or whom the current user has blocked
        blocked_by_ids = BlockedUser.objects.filter(blocked_user=self.user).values_list('user_id', flat=True)
        blocking_ids = BlockedUser.objects.filter(user=self.user).values_list('blocked_user_id', flat=True)
        excluded_ids = set(blocked_by_ids) | set(blocking_ids)
        allowed_users = User.objects.exclude(id__in=excluded_ids).values_list('id', flat=True)
        return list(allowed_users)
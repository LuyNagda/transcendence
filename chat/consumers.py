import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .handler import ChatHandler

User = get_user_model()

log = logging.getLogger(__name__)

all = 'all_users'

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if not self.channel_layer:
            log.error(f"{self.user.id} - Channel layer is not initialized!")
            await self.close()
            return
        self.user = self.scope["user"]
        self.user_group_name = f"chat_{self.user.id}"
        self.handler = ChatHandler(self)
        
        await self.channel_layer.group_add(all, self.channel_name)
        await self.channel_layer.group_add(self.user_group_name, self.channel_name)
        await self.set_user_online()
        await self.accept()
        await self.broadcast_status('online')
        log.info(f"{self.user.id} - WebSocket connected")

    async def disconnect(self, close_code):
        await self.broadcast_status('offline')
        await self.channel_layer.group_discard(self.user_group_name, self.channel_name)
        await self.channel_layer.group_discard(all, self.channel_name)
        await self.set_user_offline()
        log.info(f"{self.user.id} - WebSocket disconnected")

    async def receive(self, text_data):
        log.debug(f"{self.user.id} - Received message: %s", text_data)
        try:
            data = json.loads(text_data)
            message_type = data['type']
            await self.handler.handle_message(message_type, data)
        except json.JSONDecodeError:
            log.error(f"{self.user.id} - Received invalid JSON data")
            await self.send(text_data=json.dumps({'error': 'Invalid JSON data'}))
        except KeyError as e:
            log.error(f"{self.user.id} - Missing key in received data: {str(e)}")
            await self.send(text_data=json.dumps({'error': 'Missing keys in received data'}))
        except Exception as e:
            log.error(f"{self.user.id} - Error processing received data: {str(e)}")
            await self.send(text_data=json.dumps({'error': 'An error occurred while processing your request'}))

    @database_sync_to_async
    def set_user_online(self):
        self.user.online = True
        self.user.save()

    @database_sync_to_async
    def set_user_offline(self):
        self.user.online = False
        self.user.save()

    async def broadcast_status(self, status):
        await self.channel_layer.group_send(
            all,
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
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .models import ChatMessage, BlockedUser
from django.contrib.auth.models import User

from django.contrib.auth import get_user_model

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        if not self.channel_layer:
            raise ValueError("Channel layer is not initialized!")
        self.user = self.scope["user"]
        self.user_group_name = f"chat_{self.user.id}"
        
        await self.channel_layer.group_add(
            self.user_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.user_group_name,
            self.channel_name
        )
        
    @database_sync_to_async
    def is_blocked(self, recipient_id):
        return BlockedUser.objects.filter(user_id=recipient_id, blocked_user=self.user).exists()

    @database_sync_to_async
    def get_user_profile(self, user_id):
        user = User.objects.get(id=user_id)
        return {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'bio': user.bio,
            'name': user.name,
            'nick_name': user.nick_name,
            'profile_picture': user.profile_picture.url if user.profile_picture else None,
            'online': user.online,
        }

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data['type']

        if message_type == 'chat_message':
            print("Received chat message", data)
            message = data['message']
            recipient_id = data['recipient_id']
            
            if await self.is_blocked(recipient_id):
                await self.send(text_data=json.dumps({
                    'error': 'You are blocked...'
                }))
                return

            await self.save_message(message, recipient_id)
            
            recipient_group_name = f"chat_{recipient_id}"
            
            await self.channel_layer.group_send(
                recipient_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender_id': self.user.id
                }
            )
        elif message_type == 'game_invitation':
            recipient_id = data['recipient_id']
            game_id = data['game_id']

            recipient_group_name = f"chat_{recipient_id}"
            
            await self.channel_layer.group_send(
                recipient_group_name,
                {
                    'type': 'game_invitation',
                    'game_id': game_id,
                    'sender_id': self.user.id
                }
            )
        elif message_type == 'get_profile':
            user_id = data['user_id']
            profile = await self.get_user_profile(user_id)
            await self.send(text_data=json.dumps({
                'type': 'user_profile',
                'profile': profile
            }))
        elif message_type == 'tournament_warning':
            # Handle incoming tournament warnings (if needed to be handled by WebSocket)
            pass  # Implement if server needs to initiate tournament warnings

    async def chat_message(self, event):
        message = event['message']
        sender_id = event['sender_id']

        await self.send(text_data=json.dumps({
            'message': message,
            'sender_id': sender_id
        }))

    async def game_invitation(self, event):
        game_id = event['game_id']
        sender_id = event['sender_id']

        await self.send(text_data=json.dumps({
            'type': 'game_invitation',
            'game_id': game_id,
            'sender_id': sender_id
        }))

    async def tournament_warning(self, event):
        tournament_id = event['tournament_id']
        match_time = event['match_time']

        await self.send(text_data=json.dumps({
            'type': 'tournament_warning',
            'tournament_id': tournament_id,
            'match_time': match_time
        }))

    async def user_profile(self, event):
        profile = event['profile']
        await self.send(text_data=json.dumps({
            'type': 'user_profile',
            'profile': profile
        }))

    @database_sync_to_async
    def save_message(self, message, recipient_id):
        recipient = User.objects.get(id=recipient_id)
        ChatMessage.objects.create(
            sender=self.user,
            recipient=recipient,
            content=message
        )
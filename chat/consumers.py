import json
import logging
from typing import Optional, Dict, Any, List, Set, Union, cast
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.layers import BaseChannelLayer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import BlockedUser, ChatMessage
from .handler import ChatHandler

User = get_user_model()

log: logging.Logger = logging.getLogger(__name__)

all: str = 'all_users'

class MessageSender:
    """Handles message formatting, logging, and sending through WebSocket"""
    
    @staticmethod
    def chat_message(message: Union[ChatMessage, Dict[str, Any]], event: Dict[str, Any] = None) -> Dict[str, Any]:
        """Format a chat message for sending over WebSocket
        
        Args:
            message: Either a ChatMessage model instance or a dictionary containing message data
            event: Optional event data containing sender_id
            
        Returns:
            Dict containing the formatted message with type, message content, and sender_id
        """
        formatted_message = {
            'id': message.id if isinstance(message, ChatMessage) else message.get('id'),
            'content': message.content if isinstance(message, ChatMessage) else message.get('content'),
            'timestamp': int(message.timestamp.timestamp() * 1000) if isinstance(message, ChatMessage) else message.get('timestamp'),
            'type': 'text' if isinstance(message, ChatMessage) else message.get('type', 'text')
        }

        return {
            'type': 'chat_message',
            'message': formatted_message,
            'sender_id': message.sender.id if isinstance(message, ChatMessage) else event.get('sender_id')
        }
    
    @staticmethod
    def status_update(user_data: Union[Dict, User]) -> Dict[str, Any]:
        """Creates a status update message"""
        # Handle both dict and User model cases
        if isinstance(user_data, dict):
            user_info = user_data
        else:
            user_info = user_data.chat_user

        return {
            'type': 'status_update',
            'user': user_info
        }
    
    @staticmethod
    def game_invitation(sender_id: int, room_id: str) -> Dict[str, Any]:
        """Format a game invitation message"""
        return {
            'type': 'game_invitation',
            'sender_id': sender_id,
            'room_id': room_id
        }
    
    @staticmethod
    def error(error_msg: str) -> Dict[str, Any]:
        """Format an error message"""
        return {
            'type': 'error',
            'message': error_msg
        }

    @classmethod
    async def send_message(cls, consumer, message_data: Dict[str, Any]) -> None:
        """Middleware for sending messages with logging"""
        log.debug('Sending message', extra={
            'user_id': getattr(consumer.user, 'id', None),
            'message_type': message_data.get('type'),
            'data': json.dumps(message_data)
        })
        await consumer.send(text_data=json.dumps(message_data))

    @classmethod
    async def send_error(cls, consumer, error_msg: str) -> None:
        """Error handling middleware with logging"""
        log.error('Sending error message', extra={
            'user_id': getattr(consumer.user, 'id', None),
            'data': json.dumps({'error': error_msg})
        })
        await cls.send_message(consumer, cls.error(error_msg))

class ChatConsumer(AsyncWebsocketConsumer):
    user: Optional[User]
    handler: ChatHandler
    user_group_name: str
    channel_layer: BaseChannelLayer
    
    async def connect(self) -> None:
        self.user = self.scope.get("user")
        log.info('WebSocket connection attempt', extra={
            'user_id': getattr(self.user, 'id', None),
            'authenticated': self.user.is_authenticated if self.user else False
        })
        if not self.user or self.user.is_anonymous:
            await self.close()
        else:
            await self.accept()
            self.user_group_name = f"chat_{self.user.id}"
            self.handler = ChatHandler(self)
            
            await self.channel_layer.group_add(all, self.channel_name)
            await self.channel_layer.group_add(self.user_group_name, self.channel_name)
            await self.set_user_online()
            await self.broadcast_status()
            log.info('WebSocket connected', extra={
                'user_id': self.user.id
            })

    async def disconnect(self, close_code: int) -> None:
        if hasattr(self, 'user') and self.user.is_authenticated:
            await self.set_user_offline()
            await self.broadcast_status()
            await self.channel_layer.group_discard(self.user_group_name, self.channel_name)
        await self.channel_layer.group_discard(all, self.channel_name)
        log.info(f"WebSocket disconnected", extra={
            'user_id': getattr(self.user, 'id', 'Unknown')
        })

    async def receive(self, text_data: str) -> None:
        log.debug(f"Received data: {text_data}", extra={
            'user_id': self.user.id if self.user else None
        })
        try:
            data: dict = json.loads(text_data)
            message_type: Optional[str] = data.get('type')
            if not message_type:
                raise KeyError('type')
            await self.handler.handle_message(message_type, data)
        except json.JSONDecodeError:
            await MessageSender.send_error(self, 'Invalid JSON data')
        except KeyError as e:
            await MessageSender.send_error(self, f'Missing required field: {e.args[0]}')
        except ValueError as e:
            await MessageSender.send_error(self, 'Invalid data format')
        except Exception as e:
            await MessageSender.send_error(self, 'An error occurred while processing your request')

    @database_sync_to_async
    def set_user_online(self) -> None:
        if self.user and self.user.is_authenticated:
            self.user.online = True
            self.user.save()
        else:
            log.warning("Attempted to set AnonymousUser online", extra={
                'user_id': getattr(self.user, 'id', 'Unknown')
            })

    @database_sync_to_async
    def set_user_offline(self) -> None:
        if self.user:
            self.user.online = False
            self.user.save()

    async def broadcast_status(self) -> None:
        user_ids: List[int] = await self.get_allowed_user_ids()
        for recipient_id in user_ids:
            if recipient_id == self.user.id:
                continue
            await self.channel_layer.group_send(
                f"chat_{recipient_id}",
                MessageSender.status_update(self.user.chat_user)
            )

    async def chat_message(self, event: Dict[str, Any]) -> None:
        """Handle incoming chat message from channel layer"""
        await MessageSender.send_message(self, MessageSender.chat_message(event['message'], event))
    
    async def friend_request_message(self, event: Dict[str, Any]) -> None:
        """Handle incoming friends request message from channel layer"""
        await MessageSender.send_message(self, event)

    async def friend_request_choice_message(self, event: Dict[str, Any]) -> None:
        """Handle incoming friends request choice message from channel layer"""
        await MessageSender.send_message(self, event)

    async def remove_friend_message(self, event: Dict[str, Any]) -> None:
        """Handle incoming remove friend message from channel layer"""
        await MessageSender.send_message(self, event)

    async def load_friend_requests_message(self, event: Dict[str, Any]) -> None:
        """Handle incoming load friend requests message from channel layer"""
        await MessageSender.send_message(self, event)

    async def status_update(self, event: Dict[str, Any]) -> None:
        """Handle status update event"""
        user = event.get('user')  # Get user from event
        if user:
            await MessageSender.send_message(self, MessageSender.status_update(user))
        else:
            log.warning("Received status update event without user data", extra={
                'user_id': getattr(self.user, 'id', None)
            })

    async def game_invitation(self, event: Dict[str, Any]) -> None:
        log.debug(f"{self.user.id} - Received game invitation", extra={'user_id': self.user.id})
        await MessageSender.send_message(self, 
            MessageSender.game_invitation(
                event['sender_id'],
                event['room_id']
            )
        )

    @database_sync_to_async
    def get_allowed_user_ids(self) -> List[int]:
        if not self.user or not self.user.is_authenticated:
            return []
        # Exclude users who have blocked the current user or whom the current user has blocked
        blocked_by_ids: Set[int] = set(BlockedUser.objects.filter(
            blocked_user=self.user
        ).values_list('user_id', flat=True))
        
        blocking_ids: Set[int] = set(BlockedUser.objects.filter(
            user=self.user
        ).values_list('blocked_user_id', flat=True))
        
        excluded_ids: Set[int] = blocked_by_ids | blocking_ids
        allowed_users: List[int] = list(User.objects.exclude(
            id__in=excluded_ids
        ).values_list('id', flat=True))
        
        return allowed_users

    async def refresh_friends(self, event: Dict[str, Any]) -> None:
        """Handle friend list refresh requests"""
        await self.send(text_data=json.dumps({
            'type': 'refresh_friends',
            'message': 'update_required'
        }))
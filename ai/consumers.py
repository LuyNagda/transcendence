from channels.generic.websocket import AsyncWebsocketConsumer
from channels.layers import BaseChannelLayer
import json, logging

log: logging.Logger = logging.getLogger(__name__)
ai_group: str = 'ai_group'

class AIConsumer(AsyncWebsocketConsumer):
    channel_layer: BaseChannelLayer

    async def connect(self):
        try:
            self.user = self.scope.get("user")
            log.info('WebSocket AI connection attempt', extra={
                'user_id': getattr(self.user, 'id', None),
                'authenticated': self.user.is_authenticated if self.user else False
            })

            if not self.user or self.user.is_anonymous:
                await self.close()

            await self.accept()
            await self.channel_layer.group_add(ai_group, self.channel_name)
            log.info('WebSocket AI connected', extra={
                'user_id': self.user.id
            })
        
        except Exception as e:
            log.error(f'[AIConsumer]: failed to connect: {str(e)}')

    async def disconnect(self, close_code):
        try:
            await self.channel_layer.group_discard(ai_group, self.channel_name)

            log.info(f"WebSocket disconnected", extra={
                'user_id': getattr(self.user, 'id', 'Unknown')
            })
            pass
        
        except Exception as e:
            log.error(f'[AIConsumer]: failed to disconnect: {str(e)}')

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            await self.channel_layer.group_send(
                ai_group,
                {
                    'type': 'broadcast_ai_status',
                    'message': data
                }
            )
        
        except Exception as e:
            log.error(f'[AIConsumer]: failed to connect: {str(e)}')

    async def broadcast_ai_status(self, event):
        try:
            message = event['message']
            await self.send(text_data=json.dumps(message))
        
        except Exception as e:
            log.error(f'[AIConsumer]: failed to broadcast ai\'s status: {str(e)}')

    async def ai_modified(self, event):
        try:
            # Send the notification to the WebSocket
            await self.send(text_data=json.dumps({
                'type': 'ai_modified'
            }))
        
        except Exception as e:
            log.error(f'[AIConsumer]: failed to send modification notification: {str(e)}')

    async def ai_training_log(self, event):
            """Handles AI training log messages and sends them to all users."""
            try:
                message = event['message']
                await self.send(text_data=json.dumps({
                    "type": "ai_training_log",
                    "content": message
                }))
            
            except Exception as e:
                log.error(f'[AIConsumer]: failed to send AI training log: {str(e)}')

from channels.generic.websocket import AsyncWebsocketConsumer
import json

class AIConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.accept()

    async def disconnect(self, close_code):
        pass

    async def receive(self, text_data):
        data = json.loads(text_data)
        await self.channel_layer.group_send(
            "ai_group",
            {
                'type': 'broadcast_ai_status',
                'message': data
            }
        )

    async def broadcast_ai_status(self, event):
        message = event['message']
        await self.send(text_data=json.dumps(message))


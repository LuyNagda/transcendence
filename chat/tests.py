import asyncio
from unittest import mock
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.urls import path
from channels.routing import URLRouter
from channels.auth import AuthMiddlewareStack
from channels.layers import get_channel_layer
from channels.db import database_sync_to_async
from chat.consumers import ChatConsumer
from chat.models import BlockedUser, ChatMessage, GameInvitation

User = get_user_model()

class ChatConsumerTestCase(TransactionTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        asyncio.run(cls.asyncSetUpClass())

    @classmethod
    async def asyncSetUpClass(cls):
        cls.user = await database_sync_to_async(User.objects.create_user)(
            username='testuser', password='password123', email='testuser@example.com')
        cls.other_user = await database_sync_to_async(User.objects.create_user)(
            username='otheruser', password='password123', email='otheruser@example.com')
        cls.channel_layer = get_channel_layer()

    async def create_communicator(self, user=None):
        application = AuthMiddlewareStack(URLRouter([path("ws/chat/", ChatConsumer.as_asgi())]))
        communicator = WebsocketCommunicator(application, "/ws/chat/")
        communicator.scope["user"] = user or self.user
        return communicator

    async def connect_and_send(self, message_type, data, user=None):
        communicator = await self.create_communicator(user)
        await communicator.connect()
        await communicator.send_json_to({**data, 'type': message_type})
        return communicator

    async def test_connect_and_disconnect(self):
        communicator = await self.create_communicator()
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()
        
        # Add a small delay to ensure the connection is fully closed
        await asyncio.sleep(0.1)
        
        # Try to receive a message and expect it to fail
        with self.assertRaises(Exception):
            await communicator.receive_from()

    async def test_authentication(self):
        # Test unauthenticated access
        application = AuthMiddlewareStack(URLRouter([path("ws/chat/", ChatConsumer.as_asgi())]))
        communicator = WebsocketCommunicator(application, "/ws/chat/")
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

        # Test authenticated access
        communicator = await self.create_communicator(self.user)
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_chat_message_flow(self):
        sender_comm = await self.connect_and_send('chat_message', {
            'message': 'Hello!',
            'recipient_id': self.other_user.id
        })
        recipient_comm = await self.create_communicator(self.other_user)
        await recipient_comm.connect()

        response = await recipient_comm.receive_json_from()
        while response.get('type') == 'user_status_change':
            response = await recipient_comm.receive_json_from()

        self.assertEqual(response.get('type'), 'chat_message')
        self.assertEqual(response.get('message'), 'Hello!')
        self.assertEqual(response.get('sender_id'), self.user.id)

        messages = await database_sync_to_async(ChatMessage.objects.filter)(
            sender=self.user, recipient=self.other_user)
        self.assertEqual(await database_sync_to_async(messages.count)(), 1)

        await sender_comm.disconnect()
        await recipient_comm.disconnect()

    async def test_blocked_user_interactions(self):
        # Ensure users are created and persisted
        self.user = await database_sync_to_async(User.objects.create_user)(
            username='testuser', password='password123', email='testuser@example.com')
        self.other_user = await database_sync_to_async(User.objects.create_user)(
            username='otheruser', password='password123', email='otheruser@example.com')

        # Create BlockedUser object
        await database_sync_to_async(BlockedUser.objects.create)(
            user=self.other_user, blocked_user=self.user)

        communicator = await self.connect_and_send('chat_message', {
            'message': 'Blocked message',
            'recipient_id': self.other_user.id
        })
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('error'), 'You are blocked...')
        await communicator.disconnect()

        # Clean up
        await database_sync_to_async(BlockedUser.objects.all().delete)()
        await database_sync_to_async(User.objects.all().delete)()

    async def test_user_profile_and_status(self):
        # Recreate users if necessary
        self.other_user = await database_sync_to_async(User.objects.create_user)(
            username='otheruser', password='password123', email='otheruser@example.com'
        )
        communicator = await self.connect_and_send('get_profile', {
            'user_id': self.other_user.id
        })
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'user_profile')
        self.assertEqual(response['profile']['username'], 'otheruser')

        status_response = await communicator.receive_json_from()
        self.assertEqual(status_response.get('type'), 'user_status_change')
        self.assertEqual(status_response.get('user_id'), self.user.id)
        self.assertEqual(status_response.get('status'), 'online')

        await communicator.disconnect()

    async def test_game_invitation(self):
        sender_comm = await self.connect_and_send('game_invitation', {
            'recipient_id': self.other_user.id,
            'game_id': 'pong'
        })
        recipient_comm = await self.create_communicator(self.other_user)
        await recipient_comm.connect()

        response = await recipient_comm.receive_json_from()
        while response.get('type') == 'user_status_change':
            response = await recipient_comm.receive_json_from()

        self.assertEqual(response.get('type'), 'game_invitation')
        self.assertEqual(response.get('game_id'), 'pong')
        self.assertEqual(response.get('sender_id'), self.user.id)

        invitations = await database_sync_to_async(GameInvitation.objects.filter)(sender=self.user)
        self.assertEqual(await database_sync_to_async(invitations.count)(), 1)

        await sender_comm.disconnect()
        await recipient_comm.disconnect()

    async def test_error_handling(self):
        communicator = await self.create_communicator()
        await communicator.connect()
        await communicator.send_to(text_data='{"type": invalid}')
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('error'), 'Invalid JSON data')

        await communicator.send_json_to({'type': 'chat_message'})
        response = await communicator.receive_json_from() # Online message
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('error'), 'Missing required keys: message or recipient_id')

        await communicator.send_json_to({'type': 'get_profile', 'user_id': 9999})
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'error')
        self.assertEqual(response.get('message'), 'User profile not found')

        await communicator.send_json_to({'type': 'invalid_type', 'message': 'Test'})
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('error'), 'Invalid message type')

        await communicator.disconnect()

    @mock.patch('chat.models.ChatMessage.objects.create')
    async def test_database_error_handling(self, mock_create):
        mock_create.side_effect = Exception('Database error')
        communicator = await self.connect_and_send('chat_message', {
            'message': 'This should trigger a database error',
            'recipient_id': self.other_user.id
        })
        response = await communicator.receive_json_from()
        self.assertIn('error', response)
        await communicator.disconnect()

    async def test_unauthorized_access(self):
        # Test accessing a protected route without authentication
        application = AuthMiddlewareStack(URLRouter([path("ws/chat/", ChatConsumer.as_asgi())]))
        communicator = WebsocketCommunicator(application, "/ws/chat/")
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def tearDown(self):
        await database_sync_to_async(User.objects.all().delete)()
        await database_sync_to_async(BlockedUser.objects.all().delete)()
        await database_sync_to_async(ChatMessage.objects.all().delete)()
        await database_sync_to_async(GameInvitation.objects.all().delete)()

    @classmethod
    def tearDownClass(cls):
        asyncio.run(cls.asyncTearDownClass())
        super().tearDownClass()

    @classmethod
    async def asyncTearDownClass(cls):
        await database_sync_to_async(User.objects.all().delete)()
        await database_sync_to_async(BlockedUser.objects.all().delete)()
        await database_sync_to_async(ChatMessage.objects.all().delete)()
        await database_sync_to_async(GameInvitation.objects.all().delete)()
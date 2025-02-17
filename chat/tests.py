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
from .consumers import ChatConsumer
from .models import BlockedUser, ChatMessage

User = get_user_model()

class ChatConsumerTestCase(TransactionTestCase):
    async def asyncSetUp(self):
        self.user = await database_sync_to_async(User.objects.create_user)(
            username='marvin', password='password123', email='marvin@student.42lyon.fr')
        self.other_user = await database_sync_to_async(User.objects.create_user)(
            username='otheruser', password='password123', email='otheruser@student.42lyon.fr')
        self.channel_layer = get_channel_layer()

    def setUp(self):
        self.loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self.loop)
        self.loop.run_until_complete(self.asyncSetUp())

    async def asyncTearDown(self):
        # Clean up users
        if hasattr(self, 'user'):
            try:
                await database_sync_to_async(self.user.delete)()
            except User.DoesNotExist:
                pass
        if hasattr(self, 'other_user'):
            try:
                await database_sync_to_async(self.other_user.delete)()
            except User.DoesNotExist:
                pass
        # Clean up any remaining test data
        await database_sync_to_async(User.objects.all().delete)()
        await database_sync_to_async(BlockedUser.objects.all().delete)()
        await database_sync_to_async(ChatMessage.objects.all().delete)()

    def tearDown(self):
        self.loop.run_until_complete(self.asyncTearDown())
        self.loop.close()

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
        # Create test users specifically for this test
        test_sender = await database_sync_to_async(User.objects.create_user)(
            username='test_sender',
            password='password123',
            email='test_sender@student.42lyon.fr'
        )
        test_recipient = await database_sync_to_async(User.objects.create_user)(
            username='test_recipient',
            password='password123',
            email='test_recipient@student.42lyon.fr'
        )

        try:
            sender_comm = await self.connect_and_send('chat_message', {
                'message': 'Hello!',
                'recipient_id': test_recipient.id
            }, user=test_sender)
            
            recipient_comm = await self.create_communicator(test_recipient)
            await recipient_comm.connect()

            response = await recipient_comm.receive_json_from()
            while response.get('type') == 'status_update':
                response = await recipient_comm.receive_json_from()

            self.assertEqual(response.get('type'), 'chat_message')
            self.assertEqual(response.get('message', {}).get('content'), 'Hello!')
            self.assertEqual(response.get('sender_id'), test_sender.id)

            messages = await database_sync_to_async(ChatMessage.objects.filter)(
                sender=test_sender, recipient=test_recipient)
            self.assertEqual(await database_sync_to_async(messages.count)(), 1)

        finally:
            # Clean up connections
            if 'sender_comm' in locals():
                await sender_comm.disconnect()
            if 'recipient_comm' in locals():
                await recipient_comm.disconnect()
            
            # Clean up test users
            await database_sync_to_async(test_sender.delete)()
            await database_sync_to_async(test_recipient.delete)()

    async def test_blocked_user_interactions(self):
        # Create users with unique names for this test
        blocked_sender = await database_sync_to_async(User.objects.create_user)(
            username='blocked_sender',
            password='password123',
            email='blocked_sender@student.42lyon.fr'
        )
        blocking_user = await database_sync_to_async(User.objects.create_user)(
            username='blocking_user',
            password='password123',
            email='blocking_user@student.42lyon.fr'
        )

        try:
            # Create BlockedUser object
            await database_sync_to_async(BlockedUser.objects.create)(
                user=blocking_user, blocked_user=blocked_sender)

            communicator = await self.connect_and_send('chat_message', {
                'message': 'Blocked message',
                'recipient_id': blocking_user.id
            }, user=blocked_sender)
            
            response = await communicator.receive_json_from()
            self.assertEqual(response.get('error'), 'Message blocked: User is blocked')
            await communicator.disconnect()

        finally:
            # Clean up
            await database_sync_to_async(BlockedUser.objects.all().delete)()
            await database_sync_to_async(blocked_sender.delete)()
            await database_sync_to_async(blocking_user.delete)()

    async def test_user_profile_and_status(self):
        # Create test users with unique names
        profile_user = await database_sync_to_async(User.objects.create_user)(
            username='profile_test_user',
            password='password123',
            email='profile_test@student.42lyon.fr'
        )

        try:
            communicator = await self.connect_and_send('get_profile', {
                'user_id': profile_user.id
            })

            profile_user_comm = await self.create_communicator(profile_user)
            connected, _ = await profile_user_comm.connect()
            self.assertTrue(connected, "Test user failed to connect")

            # Get the first response : profile
            response = await communicator.receive_json_from()
            self.assertEqual(response['type'], 'user_profile')
            self.assertEqual(response['data']['profile']['username'], 'profile_test_user')

            # Get the next response : status
            response = await communicator.receive_json_from()
            while response.get('type') == 'status_update' and response.get('user', {}).get('id') != profile_user.id:
                response = await communicator.receive_json_from()

            self.assertEqual(response['type'], 'status_update')
            self.assertTrue(response.get('user', {}).get('online', False))
            self.assertEqual(response.get('user', {}).get('id'), profile_user.id)

        finally:
            if 'communicator' in locals():
                await communicator.disconnect()
            if 'profile_user_comm' in locals():
                await profile_user_comm.disconnect()
            await database_sync_to_async(profile_user.delete)()

    async def test_error_handling(self):
        communicator = await self.create_communicator()
        await communicator.connect()
        
        # Test invalid JSON
        await communicator.send_to(text_data='{"type": invalid}')
        response = await communicator.receive_json_from()
        if response.get('type') == 'status_update': # Skip any status updates
            response = await communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'error')
        error_msg = response.get('message') or response.get('error')
        self.assertEqual(error_msg, 'Invalid JSON data')

        # Test missing required fields
        await communicator.send_json_to({'type': 'chat_message'})
        response = await communicator.receive_json_from()
        if response.get('type') == 'status_update': # We might receive a status message first
            response = await communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'error')
        error_msg = response.get('message') or response.get('error')
        self.assertEqual(error_msg, "Missing required data: 'message, recipient_id'")

        # Test invalid user profile
        await communicator.send_json_to({'type': 'get_profile', 'user_id': 9999})
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'user_profile')
        self.assertEqual(response.get('success'), False)
        self.assertEqual(response.get('error'), 'User profile not found')

        # Test invalid message type
        await communicator.send_json_to({'type': 'invalid_type', 'message': 'Test'})
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'error')
        error_msg = response.get('message') or response.get('error')
        self.assertEqual(error_msg, 'Invalid message type')

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

    @classmethod
    def tearDownClass(cls):
        asyncio.run(cls.asyncTearDownClass())
        super().tearDownClass()

    @classmethod
    async def asyncTearDownClass(cls):
        try:
            await database_sync_to_async(User.objects.all().delete)()
            await database_sync_to_async(BlockedUser.objects.all().delete)()
            await database_sync_to_async(ChatMessage.objects.all().delete)()
        except Exception as e:
            print(f"Error during asyncTearDownClass: {type(e).__name__}: {str(e)}")
            raise
    
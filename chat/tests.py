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
    def setUp(self):
        super().setUp()
        self.user = self.create_user('testuser', 'password123', 'testuser@example.com')
        self.other_user = self.create_user('otheruser', 'password123', 'otheruser@example.com')
        self.channel_layer = get_channel_layer()

    async def asyncSetUp(self):
        await database_sync_to_async(self.create_blocked_user)(self.other_user, self.user)

    @staticmethod
    def create_user(username, password, email):
        return User.objects.create_user(username=username, password=password, email=email)

    @database_sync_to_async
    def create_blocked_user(self, user, blocked_user):
        return BlockedUser.objects.create(user=user, blocked_user=blocked_user)

    async def test_connect(self):
        communicator = await self.create_communicator()
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.disconnect()

    async def test_disconnect(self):
        communicator = await self.create_communicator()
        await communicator.connect()
        await communicator.disconnect()
        try:
            await communicator.send_json_to({'type': 'ping'})
            self.fail("Expected an exception when sending after disconnect")
        except Exception:
            pass  # Expected behavior

    async def test_receive_chat_message(self):
        sender_communicator = await self.create_communicator()
        recipient_communicator = await self.create_communicator()
        recipient_communicator.scope["user"] = self.other_user
        await sender_communicator.connect()
        await recipient_communicator.connect()
        await sender_communicator.send_json_to({
            'type': 'chat_message',
            'message': 'Hello!',
            'recipient_id': self.other_user.id
        })

        chat_message_received = 0
        while True:
            response = await recipient_communicator.receive_json_from()
            print("Received response:", response)
            if response.get('type') == 'chat_message':
                self.assertEqual(response.get('message'), 'Hello!')
                self.assertEqual(response.get('sender_id'), self.user.id)
                chat_message_received += 1
                break
            elif response.get('type') == 'user_status_change':
                continue
            else:
                self.fail(f"Unexpected message type received: {response.get('type')}")

        messages = await database_sync_to_async(ChatMessage.objects.filter)(sender=self.user, recipient=self.other_user)
        self.assertEqual(await database_sync_to_async(messages.count)(), chat_message_received)
        await sender_communicator.disconnect()
        await recipient_communicator.disconnect()

    async def test_blocked_user_cannot_receive_message(self):
        await self.create_blocked_user(self.other_user, self.user)
        communicator = await self.create_communicator()
        await communicator.connect()
        await communicator.send_json_to({
            'type': 'chat_message',
            'message': 'Blocked message',
            'recipient_id': self.other_user.id
        })
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('error'), 'You are blocked...')
        await communicator.disconnect()

    async def test_get_user_profile(self):
        communicator = await self.create_communicator()
        await communicator.connect()
        await communicator.send_json_to({
            'type': 'get_profile',
            'user_id': self.other_user.id
        })
        response = await communicator.receive_json_from()
        self.assertEqual(response['type'], 'user_profile')
        self.assertEqual(response['profile']['username'], 'otheruser')
        await communicator.disconnect()
    
    async def test_broadcast_status(self):
        communicator = await self.create_communicator()
        await communicator.connect()
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'user_status_change')
        self.assertEqual(response.get('user_id'), self.user.id)
        self.assertEqual(response.get('status'), 'online')
        await communicator.disconnect()

    async def test_user_status_change_notification(self):
        recipient_communicator = await self.create_communicator()
        recipient_communicator.scope["user"] = self.user
        await recipient_communicator.connect()
        sender_communicator = await self.create_communicator()
        sender_communicator.scope["user"] = self.other_user
        await sender_communicator.connect()
        response = await recipient_communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'user_status_change')
        self.assertEqual(response.get('user_id'), self.user.id)
        self.assertEqual(response.get('status'), 'online')
        response = await recipient_communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'user_status_change')
        self.assertEqual(response.get('user_id'), self.other_user.id)
        self.assertEqual(response.get('status'), 'online')
        await sender_communicator.disconnect()
        response = await recipient_communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'user_status_change')
        self.assertEqual(response.get('user_id'), self.other_user.id)
        self.assertEqual(response.get('status'), 'offline')
        await recipient_communicator.disconnect()

    async def test_handle_game_invitation(self):
        sender_communicator = await self.create_communicator()
        recipient_communicator = await self.create_communicator()
        recipient_communicator.scope["user"] = self.other_user
        await sender_communicator.connect()
        await recipient_communicator.connect()
        await sender_communicator.send_json_to({
            'type': 'game_invitation',
            'recipient_id': self.other_user.id,
            'game_id': 'pong'
        })

        game_invitation_received = 0
        while True:
            response = await recipient_communicator.receive_json_from()
            print("Received response:", response)
            if response.get('type') == 'game_invitation':
                self.assertEqual(response.get('game_id'), 'pong')
                self.assertEqual(response.get('sender_id'), self.user.id)
                game_invitation_received += 1
                break
            elif response.get('type') == 'user_status_change':
                continue
            else:
                self.fail(f"Unexpected message type received: {response.get('type')}")

        messages = await database_sync_to_async(GameInvitation.objects.filter)(sender=self.user)
        self.assertEqual(await database_sync_to_async(messages.count)(), game_invitation_received)
        await sender_communicator.disconnect()
        await recipient_communicator.disconnect()

    async def test_invalid_json_data(self):
        communicator = await self.create_communicator()
        await communicator.connect()
        await communicator.send_to(text_data='{"type": invalid}')
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('error'), 'Invalid JSON data')
        await communicator.disconnect()

    async def test_missing_keys_in_data(self):
        communicator = await self.create_communicator()
        await communicator.connect()
        await communicator.send_json_to({'type': 'chat_message'})
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('error'), 'Missing keys in received data')
        await communicator.disconnect()

    async def test_profile_error_handling(self):
        communicator = await self.create_communicator()
        await communicator.connect()
        await communicator.send_json_to({
            'type': 'get_profile',
            'user_id': 9999 # doesn't exist
        })
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'error')
        self.assertEqual(response.get('message'), 'User profile not found')
        await communicator.disconnect()

    async def test_message_saving_error_handling(self):
        communicator = await self.create_communicator()
        await communicator.connect()
        await communicator.send_json_to({
            'type': 'chat_message',
            'message': 'Test message',
            'recipient_id': 9999 # doesn't exist
        })
        response = await communicator.receive_json_from()
        self.assertEqual(response.get('error'), 'Recipient not found')
        await communicator.disconnect()

    async def test_connection_and_disconnection_error_handling(self):
        communicator = await self.create_communicator()
        with mock.patch.object(self.channel_layer, 'group_add', side_effect=Exception("Channel layer is not initialized!")):
            with self.assertRaises(Exception) as e:
                await communicator.connect()
            self.assertEqual(str(e.exception), "Channel layer is not initialized!")

        communicator = await self.create_communicator()
        await communicator.connect()
        with mock.patch.object(self.channel_layer, 'group_discard', side_effect=Exception("Channel layer is not initialized!")):
            with self.assertRaises(Exception) as e:
                await communicator.disconnect()
            self.assertEqual(str(e.exception), "Channel layer is not initialized!")

    async def create_communicator(self):
        application = AuthMiddlewareStack(
            URLRouter([
                path("ws/chat/", ChatConsumer.as_asgi()),
            ])
        )
        communicator = WebsocketCommunicator(application, "/ws/chat/")
        communicator.scope["user"] = self.user
        return communicator

    async def tearDownAsync(self):
        await database_sync_to_async(User.objects.all().delete)()
        await database_sync_to_async(BlockedUser.objects.all().delete)()
        await database_sync_to_async(ChatMessage.objects.all().delete)()
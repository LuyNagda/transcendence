from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase
from rest_framework import status
from chat.models import ChatMessage, BlockedUser
from django.utils.timezone import now
from authentication.models import User

class ChatViewsTestCase(APITestCase):

    def setUp(self):
        # Create test users
        self.user1 = User.objects.create_user(username='user1', password='password123', email='user1@test.com')
        self.user2 = User.objects.create_user(username='user2', password='password123', email='user2@test.com')

        # Make users friends
        self.user1.friends.add(self.user2)
        self.user2.friends.add(self.user1)

    def login(self, username, password):
        """Helper function to log in a user and set authentication cookies."""
        response = self.client.post('/login', {'username': username, 'password': password})
        self.assertEqual(response.status_code, 302)

        # Extract JWT tokens from cookies
        access_token = response.cookies.get('access_token')
        refresh_token = response.cookies.get('refresh_token')

        self.assertIsNotNone(access_token, "Access token should be set in cookies")
        self.assertIsNotNone(refresh_token, "Refresh token should be set in cookies")

        # Set authentication cookies for subsequent requests
        self.client.cookies['access_token'] = access_token.value
        self.client.cookies['refresh_token'] = refresh_token.value

    def test_message_history(self):
        self.login('user1', 'password123')

        # Create test messages
        ChatMessage.objects.create(sender=self.user1, recipient=self.user2, content='Hello', timestamp=now())
        ChatMessage.objects.create(sender=self.user2, recipient=self.user1, content='Hi', timestamp=now())

        response = self.client.get(f'/chat/history/{self.user2.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['content'], 'Hello')
        self.assertEqual(data[1]['content'], 'Hi')

    def test_get_blocked_users(self):
        self.login('user1', 'password123')

        BlockedUser.objects.create(user=self.user1, blocked_user=self.user2)
        response = self.client.get('/chat/blacklist/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        blocked_users = response.json()
        self.assertIn(self.user2.id, blocked_users)

    def test_block_user(self):
        self.login('user1', 'password123')
        response = self.client.post(f'/chat/block/{self.user2.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(BlockedUser.objects.filter(user=self.user1, blocked_user=self.user2).exists())

    def test_unblock_user(self):
        self.login('user1', 'password123')
        BlockedUser.objects.create(user=self.user1, blocked_user=self.user2)

        response = self.client.delete(f'/chat/unblock/{self.user2.id}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(BlockedUser.objects.filter(user=self.user1, blocked_user=self.user2).exists())

    def test_get_users(self):
        self.login('user1', 'password123')
        response = self.client.get('/chat/users/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        users = response.json()
        self.assertEqual(len(users), 1)
        self.assertEqual(users[0]['username'], self.user2.username)
    
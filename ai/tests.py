from django.test import TestCase, Client
from django.urls import reverse
from authentication.models import User
from django.contrib.auth.hashers import make_password
from unittest.mock import patch, mock_open, MagicMock
import json
from pathlib import Path

class SendAiToFrontTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create(
            username='testuser',
            password=make_password('testpassword'),
            twofa=False,
            nick_name='testnick'
        )
        self.client.login(username='testuser', password='testpassword')

    def login(self, username, password):
        response = self.client.post('/login', {'username': username, 'password': password})
        self.assertEqual(response.status_code, 302)
        access_token = response.cookies.get('access_token')
        refresh_token = response.cookies.get('refresh_token')
        self.assertIsNotNone(access_token)
        self.assertIsNotNone(refresh_token)
        self.client.cookies['access_token'] = access_token.value
        self.client.cookies['refresh_token'] = refresh_token.value

    @patch('builtins.open', mock_open(read_data=json.dumps([{"ai_name": "testAi"}])))
    @patch('django.conf.settings.STATICFILES_DIRS', ["/mock/static"])
    def test_send_ai_to_front_valid_ai(self):
        self.login(username='testuser', password='testpassword')
        # Mocking a valid AI file
        response = self.client.get(reverse('send_ai_with_name', kwargs={'ai_name': 'testAi'}))
        self.assertEqual(response.status_code, 200)
        self.assertJSONEqual(response.content, {"ai_name": "testAi"})


    def test_ai_manager_view_authenticated(self):
        """Test that authenticated users can access the AI manager view."""
        self.login(username='testuser', password='testpassword')
        response = self.client.get(reverse('ai-manager'))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'ai-manager.html')

    def test_ai_manager_view_unauthenticated(self):
        """Test that unauthenticated users cannot access the AI manager view."""
        # Logout first
        self.client.logout()
        # Clear cookies
        self.client.cookies.clear()
        
        response = self.client.get(reverse('ai-manager'))
        self.assertNotEqual(response.status_code, 200)

    def test_ai_manager_view_no_cookies(self):
        """Test AI manager view with missing cookies."""
        # Login first
        self.login(username='testuser', password='testpassword')
        
        # Clear cookies after login
        self.client.cookies.clear()
        
        response = self.client.get(reverse('ai-manager'))
        self.assertEqual(response.status_code, 302)

    def test_ai_manager_context_data(self):
        """Test that the AI manager view contains the correct context data."""
        self.login(username='testuser', password='testpassword')
        response = self.client.get(reverse('ai-manager'))
        
        # Check that context contains necessary items
        self.assertEqual(response.context['user'], self.user)
        self.assertIsNotNone(response.context['access_token'])
        self.assertIsNotNone(response.context['refresh_token'])

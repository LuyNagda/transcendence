from django.test import TestCase, Client
from django.urls import reverse
from unittest.mock import patch, MagicMock
import json
from django.conf import settings
import os

class SendAiToFrontTest(TestCase):
    def setUp(self):
        self.client = Client()
        self.valid_ai_name = "TestAI"
        self.invalid_ai_name = "Invalid@Name!"
        self.too_long_ai_name = "A" * 101
        self.ai_folder = settings.STATICFILES_DIRS[0] / 'saved_ai'
        self.marvin_name = "Marvin"

        # Simulate an authenticated user with cookies
        self.client.cookies['access_token'] = 'fake_access_token'
        self.client.cookies['refresh_token'] = 'fake_refresh_token'

    @patch("builtins.open", create=True)
    def test_send_ai_to_front_success(self, mock_open):
        """Test fetching an existing AI."""
        mock_open.return_value.__enter__.return_value.read.return_value = '[{"ai": "test_data"}]'
        response = self.client.get(reverse('send_ai_to_front', args=[self.valid_ai_name]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ai": "test_data"})

    @patch("os.path.exists", return_value=False)
    @patch("builtins.open", create=True)
    def test_send_ai_to_front_fallback_to_marvin(self, mock_open, mock_exists):
        """Test fallback to Marvin AI if no file is found."""
        mock_open.return_value.__enter__.return_value.read.return_value = '[{"ai": "marvin_data"}]'
        response = self.client.get(reverse('send_ai_to_front', args=[self.valid_ai_name]))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ai": "marvin_data"})
        self.assertEqual(response['X-Fallback-AI'], 'Marvin')

    @patch("builtins.open", create=True)
    def test_send_ai_to_front_invalid_name(self, mock_open):
        """Test invalid AI name (special characters)."""
        response = self.client.get(reverse('send_ai_to_front', args=[self.invalid_ai_name]))
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid AI name", response.json()["error"])

    def test_send_ai_to_front_too_long_name(self):
        """Test AI name too long."""
        response = self.client.get(reverse('send_ai_to_front', args=[self.too_long_ai_name]))
        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid AI name", response.json()["error"])

    @patch("builtins.open", create=True)
    def test_send_ai_to_front_file_not_found(self, mock_open):
        """Test file not found and fallback to Marvin."""
        mock_open.side_effect = FileNotFoundError
        response = self.client.get(reverse('send_ai_to_front', args=[self.valid_ai_name]))
        self.assertEqual(response.status_code, 404)
        self.assertIn("No AI found", response.json()["error"])

    @patch("builtins.open", create=True)
    def test_send_ai_to_front_json_decode_error(self, mock_open):
        """Test JSON decoding error."""
        mock_open.return_value.__enter__.return_value.read.return_value = '{ai": "test_data"}'  # Invalid JSON
        response = self.client.get(reverse('send_ai_to_front', args=[self.valid_ai_name]))
        self.assertEqual(response.status_code, 500)
        self.assertIn("Failed to decode AI data", response.json()["error"])

    @patch("builtins.open", create=True)
    def test_send_ai_to_front_general_error(self, mock_open):
        """Test a general error in the view."""
        mock_open.side_effect = Exception("Something went wrong")
        response = self.client.get(reverse('send_ai_to_front', args=[self.valid_ai_name]))
        self.assertEqual(response.status_code, 500)
        self.assertIn("Something went wrong", response.json()["error"])

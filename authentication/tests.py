from django.test import TestCase
from django.http import HttpRequest, HttpResponse
from .forms import CustomUserCreationForm
from django.contrib.auth import get_user_model
        
class CustomUserCreationFormTest(TestCase):
    def test_form_valid(self):
        form_data = {
            'username': 'marvin',
            'email': 'marvin@example.com',
            'nick_name': 'marvin',
            'password1': 'complexpassword123',
            'password2': 'complexpassword123'
        }
        form = CustomUserCreationForm(data=form_data)
        self.assertTrue(form.is_valid())

    def test_password_mismatch(self):
        form_data = {
            'username': 'marvin',
            'email': 'marvin@example.com',
            'nick_name': 'marvin',
            'password1': 'complexpassword123',
            'password2': 'wrongpassword'
        }
        form = CustomUserCreationForm(data=form_data)
        self.assertFalse(form.is_valid())
        self.assertIn('password2', form.errors)

    def test_clean_password1_invalid(self):
        form_data = {
            'username': 'marvin',
            'email': 'marvin@example.com',
            'nick_name': 'marvin',
            'password1': '123',  # intentionally weak password
            'password2': '123'
        }
        form = CustomUserCreationForm(data=form_data)
        self.assertFalse(form.is_valid())
        self.assertIn('password1', form.errors)
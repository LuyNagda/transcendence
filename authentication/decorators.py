from rest_framework.permissions import BasePermission
from django.contrib.auth.models import User  # Replace with your actual User model
from rest_framework_simplejwt.tokens import AccessToken
from jwt.exceptions import ExpiredSignatureError, DecodeError, InvalidTokenError
from .models import User

class IsAuthenticatedWithCookie(BasePermission):
    def has_permission(self, request, view):
        # Check if the 'access_token' cookie is present
        token = request.COOKIES.get('access_token')
        if not token:
            return False
        
        try:
            # Validate the token
            access_token = AccessToken(token)
            user_id = access_token['user_id']
            user = User.objects.get(id=user_id)
            
            # Optionally: Set the user to the request object if you want
            request.user = user
            
            # If the user is found and token is valid
            return True
        except (ExpiredSignatureError, DecodeError, InvalidTokenError, User.DoesNotExist):
            # If the token is invalid or user does not exist
            return False
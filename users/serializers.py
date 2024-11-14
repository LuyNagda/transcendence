from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'name', 'nick_name', 'date_of_birth', 'bio', 'profile_picture', 'online']
        read_only_fields = ['id', 'username', 'email']
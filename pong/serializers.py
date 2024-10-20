from rest_framework import serializers
from .models import PongGame

class PongGameSerializer(serializers.ModelSerializer):
    class Meta:
        model = PongGame
        fields = ['id', 'player1', 'player2', 'score_player1', 'score_player2', 'is_active', 'created_at']
import logging, json, uuid
from django.core.serializers.json import DjangoJSONEncoder
from django.db import models
from django.shortcuts import get_object_or_404, redirect, render
from django.http import JsonResponse
from django.contrib.auth import get_user_model
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie
from .models import PongGame, PongRoom
from utils.htmx import with_state_update
from rest_framework.response import Response
from django.urls import reverse

User = get_user_model()

# Configure the logger
logger = logging.getLogger(__name__)

DEFAULT_RANKED_SETTINGS = {
    'ballSpeed': 6,
    'paddleSpeed': 6,
    'paddleSize': 5,
    'maxScore': 11,
}

def validate_settings(settings):
    """Validate game settings and return sanitized values"""
    validated = {}
    validated['ballSpeed'] = max(1, min(10, int(settings.get('ballSpeed', 5))))
    validated['paddleSpeed'] = max(1, min(10, int(settings.get('paddleSpeed', 5))))
    validated['paddleSize'] = max(1, min(10, int(settings.get('paddleSize', 5))))
    validated['maxScore'] = max(1, min(21, int(settings.get('maxScore', 11))))
    return validated

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def pong_view(request):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    users = User.objects.exclude(email=request.user.email)
    return render(request, 'pong/pong.html', {
        'users': users,
        'access_token': access_token, 
        'refresh_token': refresh_token
    })

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def game_history(request):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    games = PongGame.objects.filter(
        models.Q(player1=request.user) | models.Q(player2=request.user)
    ).order_by('created_at')
    return render(request, 'pong/game_history.html', {'games': games, 'access_token': access_token, 'refresh_token': refresh_token})

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedWithCookie])
def create_pong_room(request):
    try:
        room_id = str(uuid.uuid4())[:8]
        room = PongRoom.objects.create(
            room_id=room_id,
            owner=request.user,
            mode=PongRoom.Mode.CLASSIC
        )
        room.players.add(request.user)
        logger.info(f"Room created with ID {room_id} by user {request.user.username}")
        return render(request, 'pong/pong.html', {'room_id': room_id, 'room': 'created'})
    except Exception as e:
        logger.error(f"Error creating room for user {request.user.username} : {str(e)}")
        return JsonResponse({'status': 'error'})

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def pong_game(request, game_id):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    game = get_object_or_404(PongGame, id=game_id)
    game_state = game.get_state()
    return render(request, 'pong/game.html', {
        'game': game_state,
        'access_token': access_token,
        'refresh_token': refresh_token
    })

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def pong_room_view(request, room_id):
    try:
        room = get_object_or_404(PongRoom, room_id=room_id)
        logger.info(f"Accessing room with ID {room_id} by user {request.user.username}")
        room_data = room.serialize()
        room_data['currentUser'] = request.user.player_data
        json_data = json.dumps(room_data, cls=DjangoJSONEncoder, separators=(',', ':'))
        return render(request, 'pong/pong_room.html', {
            'room_id': room_id,
            'pongRoom': json_data,
            'current_user': {
                'id': request.user.id,
                'username': request.user.username,
            }
        })
    except Exception as e:
        logger.error(f"Error accessing room: {str(e)}")
        return JsonResponse({'status': 'error'})

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def invite_friends(request, room_id):
    room = get_object_or_404(PongRoom, room_id=room_id)
    friend_ids = request.POST.getlist('friends')
    friends = User.objects.filter(id__in=friend_ids)

    max_players = get_max_players_for_mode(room.mode)
    current_players = room.players.count()
    current_invitations = room.pending_invitations.count()
    available_slots = max_players - current_players - current_invitations

    if available_slots > 0:
        invitations_to_send = min(available_slots, len(friends))
        for friend in friends[:invitations_to_send]:
            room.pending_invitations.add(friend)
        
        # Envoyer une mise à jour WebSocket
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'pong_room_{room_id}',
            {'type': 'update_players'}
        )

        return JsonResponse({"status": "invitations sent", "sent": invitations_to_send})
    else:
        return JsonResponse({"status": "room full", "sent": 0})

def get_max_players_for_mode(mode):
    if mode == 'TOURNAMENT':
        return 8  # Or maximum players for tournament mode
    elif mode == 'AI':
        return 1
    else:
        return 2  # For CLASSIC and RANKED modes

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def pong_room_state(request, room_id):
    try:
        room = get_object_or_404(PongRoom, room_id=room_id)
        room_data = room.serialize()
        room_data['currentUser'] = request.user.player_data
        
        # Create response with room state in HX-Trigger
        response = render(request, 'pong/components/room_state.html', {
            'room_id': room_id,
            'pongRoom': json.dumps(room_data, cls=DjangoJSONEncoder, separators=(',', ':'))
        })
        
        # Add state update using the new mechanism
        return with_state_update(response, 'room', room_data)
        
    except Exception as e:
        logger.error(f"Error getting room state: {str(e)}")
        return JsonResponse({'error': 'Failed to get room state'}, status=500)

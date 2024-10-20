from django.shortcuts import get_object_or_404, redirect, render
from django.http import JsonResponse
from .models import PongGame, PongRoom
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie
from django.db import models
import uuid
import logging
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.db import IntegrityError
from django.utils import timezone
from django.urls import reverse
from rest_framework.response import Response

User = get_user_model()

# Configure the logger
logger = logging.getLogger(__name__)

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

@api_view(['POST'])
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
        
        url = reverse('pong_room', kwargs={'room_id': room_id})
        return Response({'status': 'success', 'url': url})
    except Exception as e:
        logger.error(f"Erreur lors de la création de la salle : {str(e)}")
        return Response({
            'status': 'error',
            'message': 'Impossible de créer la salle'
        }, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def update_pong_game_state(request, game_id):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    game = get_object_or_404(PongGame, id=game_id)
    # Logique pour mettre à jour l'état du jeu
    return JsonResponse({'status': 'updated', 'access_token': access_token, 'refresh_token': refresh_token})

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
    room = get_object_or_404(PongRoom, room_id=room_id)
    return render(request, 'pong/pong_room.html', {
        'room_id': room_id,
        'current_user': {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
        }
    })

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def invite_friend(request, room_id):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    room = get_object_or_404(PongRoom, room_id=room_id)
    friend_id = request.POST.get('friend')
    friend = get_object_or_404(User, id=friend_id)
    room.players.add(friend)
    return redirect('pong_room', room_id=room.room_id)

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
        return 8  # ou le nombre maximum de joueurs pour un tournoi
    else:
        return 2  # pour les modes CLASSIC et RANKED

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def start_ai_game(request, room_id):
    logger.info(f"Requête reçue pour démarrer une partie AI dans la salle {room_id} par l'utilisateur {request.user.username}")
    room = get_object_or_404(PongRoom, room_id=room_id)
    player1 = request.user
    game = PongGame.objects.create(room=room, player1=player1, player2_is_ai=True, status=PongGame.Status.ONGOING)
    logger.info(f"Partie AI créée avec succès. ID de la partie : {game.id}")
    return redirect('pong_game', game_id=game.id)

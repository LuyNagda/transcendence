from django.shortcuts import get_object_or_404, redirect, render
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import PongGame, PongRoom
from django.contrib.auth import get_user_model
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie
from django.db import models
import uuid
import logging

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
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    players = [request.user]
    room_id = str(uuid.uuid4())[:8]
    room = PongRoom.objects.create(room_id=room_id)
    room.players.set(players)
    return redirect('pong_room', room_id=room.room_id)

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

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedWithCookie])
def pong_room_view(request, room_id):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    room = get_object_or_404(PongRoom, room_id=room_id)
    
    if request.method == 'POST':
        mode = request.POST.get('mode')
        room.mode = mode
        room.save()
        if mode == PongRoom.Mode.AI:
            # Logique pour jouer contre l'AI
            pass
        elif mode == PongRoom.Mode.CLASSIC:
            # Logique pour inviter un ami ou lancer un matchmaking
            pass
        elif mode == PongRoom.Mode.RANKED:
            # Logique pour lancer un matchmaking
            pass
        elif mode == PongRoom.Mode.TOURNAMENT:
            # Logique pour inviter des amis ou lancer un matchmaking
            pass
        return redirect('pong_room', room_id=room.room_id)
    
    return render(request, 'pong/pong-room.html', {
        'room': room,
        'access_token': access_token,
        'refresh_token': refresh_token
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
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    room = get_object_or_404(PongRoom, room_id=room_id)
    friend_ids = request.POST.getlist('friends')
    friends = User.objects.filter(id__in=friend_ids)
    room.players.add(*friends)
    return redirect('pong_room', room_id=room_id)

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def start_ai_game(request, room_id):
    logger.info(f"Requête reçue pour démarrer une partie AI dans la salle {room_id} par l'utilisateur {request.user.username}")
    room = get_object_or_404(PongRoom, room_id=room_id)
    player1 = request.user
    game = PongGame.objects.create(room=room, player1=player1, player2_is_ai=True, status=PongGame.Status.ONGOING)
    logger.info(f"Partie AI créée avec succès. ID de la partie : {game.id}")
    return redirect('pong_game', game_id=game.id)

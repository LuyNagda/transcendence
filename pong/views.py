from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import PongGame
from django.contrib.auth import get_user_model
from django.shortcuts import render
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie

User = get_user_model()

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def pong_view(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'User not authenticated'}, status=401)
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    users = User.objects.exclude(id=request.user.id)
    return render(request, 'pong/pong.html', {'users': users, 'access_token': access_token, 'refresh_token': refresh_token})

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def game_history(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'User not authenticated'}, status=401)
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    games = PongGame.objects.filter(
        models.Q(player1=request.user) | models.Q(player2=request.user)
    ).order_by('created_at')
    return render(request, 'pong/game_history.html', {'games': games, 'access_token': access_token, 'refresh_token': refresh_token})

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def create_pong_game(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'User not authenticated'}, status=401)
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    player1 = User.objects.get(id=request.user.id)
    player2_id = request.data.get('player2_id')
    player2 = get_object_or_404(User, id=player2_id)
    game = PongGame.objects.create(player1=player1, player2=player2)
    return JsonResponse({'game_id': game.id, 'status': 'created', 'access_token': access_token, 'refresh_token': refresh_token})

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def update_pong_game_state(request, game_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'User not authenticated'}, status=401)
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    game = get_object_or_404(PongGame, id=game_id)
    # Logique pour mettre à jour l'état du jeu
    return JsonResponse({'status': 'updated', 'access_token': access_token, 'refresh_token': refresh_token})

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def get_pong_game_state(request, game_id):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'User not authenticated'}, status=401)
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    game = get_object_or_404(PongGame, id=game_id)
    return JsonResponse({
        'player1': game.player1.username,
        'player2': game.player2.username,
        'score_player1': game.score_player1,
        'score_player2': game.score_player2,
        'is_active': game.is_active,
        'access_token': access_token,
        'refresh_token': refresh_token
    })
from authentication.models import User
from django.contrib import messages
from django.shortcuts import render
from .forms import ProfileForm, MyPasswordChangeForm
from pong.models import PongGame, Tournament, PongRoom, Match
from django.contrib.auth import login
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie
from pong.pong_functions import total_games_played, total_wins, total_losses, winrate, calculate_rankings
from django.http import JsonResponse
from django.db import models
from django.shortcuts import get_object_or_404
import logging

logger = logging.getLogger(__name__)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedWithCookie])
def profile(request):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    user = request.user
    if request.method == 'POST':
        form = ProfileForm(request.POST, request.FILES, item_id=user.username)
        if form.is_valid():
            form.save()
            messages.success(request, 'Profile updated successfully.')
            context = {'user': user, 'form': form, 'access_token': access_token, 'refresh_token': refresh_token}
            return render(request, 'profile.html', context)
        else:
            messages.error(request, 'Profile not updated. Please correct the errors.')
    else:
        form = ProfileForm(item_id=user.username)
    context = {'user': user, 'form': form, 'access_token': access_token, 'refresh_token': refresh_token}
    return render(request, 'profile.html', context)

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def settings_view(request):
    user = User.objects.get(username=request.user.username)
    logger.info("inside settings view", user)
    return render(request, 'settings.html', {'user': user})

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def enable_2fa(request):
	user = get_object_or_404(User, username=request.user.username)
	user.twofa = not user.twofa
	user.save()
	return JsonResponse({
		'message': f'Two-factor authentication {"enabled" if user.twofa else "disabled"}.',
		'twofa': user.twofa
	}, headers={'HX-Location': '/settings'})

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedWithCookie])
def change_password(request):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    user = request.user
    if request.method == 'POST':
        form = MyPasswordChangeForm(user=request.user, data=request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'Password changed successfully.')
            context = {'user': user, 'form': form, 'access_token': access_token, 'refresh_token': refresh_token}
            return render(request, 'change-password.html', context)
    else:
        form = MyPasswordChangeForm(user=request.user)
    context = {'user': user, 'form': form, 'access_token': access_token, 'refresh_token': refresh_token}
    return render(request, 'change-password.html', context)

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def games_history(request):
    player = User.objects.get(username=request.user.username)
    games_history = PongGame.objects.exclude(room__mode=PongRoom.Mode.TOURNAMENT).filter(
        models.Q(player1=player) | 
        models.Q(player2=player)
	).order_by('-created_at')[:5]
    tournament_played_by_player = Tournament.objects.filter(status=Tournament.Status.FINISHED).filter(pong_room__players=player)
    player_rankings = []
    for tournament in tournament_played_by_player:
        rankings = calculate_rankings(tournament_played_by_player)
        player_stats = next((stats for p, stats in rankings if p == player), None)
        player_rankings.append({'tournament': tournament, 'stats': player_stats})
    player_rankings = player_rankings[:5]
    total_games = total_games_played(player)
    wins = total_wins(player)
    losses = total_losses(player)
    wr = winrate(player)
    context = {
        'games_history': games_history,
        'player_rankings': player_rankings,
        'total_games': total_games,
        'wins': wins,
        'losses': losses,
        'winrate': wr
    }
    return render(request, 'games-history.html', context)
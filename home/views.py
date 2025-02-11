from authentication.models import User
from django.contrib import messages
from django.shortcuts import render
from .forms import ProfileForm, MyPasswordChangeForm
from pong.models import PongGame
from django.contrib.auth import login
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie
from pong.pong_functions import total_games_played, total_wins, total_losses, winrate

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
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    return render(request, 'settings.html', {'user': request.user, 'access_token': access_token, 'refresh_token': refresh_token})

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
    games_history = PongGame.objects.filter(player1=player, player2=player)
    total_games = total_games_played(player)
    wins = total_wins(player)
    losses = total_losses(player)
    wr = winrate(player)
    context = {
        'games_history': games_history,
        'total_games': total_games,
        'wins': wins,
        'losses': losses,
        'winrate': wr
    }
    return render(request, 'games-history.html', context)
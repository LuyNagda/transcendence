from authentication.models import User
from django.contrib import messages
from django.shortcuts import render
from .forms import ProfileForm, MyPasswordChangeForm
from pong.models import PongGame, Tournament, PongRoom, Match
from django.contrib.auth import login
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie
from pong.pong_functions import total_games_played, total_wins, total_losses, winrate, calculate_rankings, total_tournies_played, total_wins_tournies, total_losses_tournies, winrate_tourny
from django.http import JsonResponse
from django.db import models
from django.shortcuts import get_object_or_404
import logging
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

logger = logging.getLogger(__name__)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticatedWithCookie])
@csrf_exempt
def profile(request):
    user = request.user

    if request.method == "POST":
        field_name = request.POST.get("field")
        field_value = request.POST.get("value")

        try:
            if field_name == "email":
                if User.objects.filter(email=field_value).exclude(username=user.username).exists():
                    return JsonResponse({"success": False, "error": "Email is already in use."}, status=400)
                user.email = field_value

            elif field_name == "nick_name":
                user.nick_name = field_value

            elif field_name == "date_of_birth":
                try:
                    dob = timezone.datetime.strptime(field_value, "%Y-%m-%d").date()
                    if dob > timezone.now().date():
                        return JsonResponse({"success": False, "error": "Date of birth cannot be in the future."}, status=400)
                    if dob > timezone.now().date() - timezone.timedelta(days=365 * 16):
                        return JsonResponse({"success": False, "error": "You must be at least 16 years old."}, status=400)
                    user.date_of_birth = dob
                except ValueError:
                    return JsonResponse({"success": False, "error": "Invalid date format."}, status=400)

            elif "profile_picture" in request.FILES:
                profile_picture = request.FILES["profile_picture"]
                if profile_picture.size > 512 * 1024:  # 512 KB limit
                    return JsonResponse({"success": False, "error": "Profile picture size cannot exceed 512 KB."}, status=400)
                user.profile_picture = profile_picture

            user.save()

            return JsonResponse({
                "success": True,
                "message": "Profile updated successfully.",
                "profile_picture_url": user.profile_picture.url if user.profile_picture else ""
            })

        except Exception as e:
            return JsonResponse({"success": False, "error": str(e)}, status=400)

    return render(request, "profile.html", {"user": user, "form": ProfileForm(item_id=user.username)})

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def settings_view(request):
    user = User.objects.get(username=request.user.username)
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
    games_history = PongGame.objects.filter(
        models.Q(player1=player) | 
        models.Q(player2=player)
	).order_by('-created_at')[:5]

    # Dynamically creat a list with all of PongGame's attributes, and add the attribute 'player2_is_ai'
    games_history_list = []
    for game in games_history:
        game_dict = {field.name: getattr(game, field.name) for field in PongGame._meta.fields}
        game_dict['player2_is_ai'] = game.player2_is_ai
        games_history_list.append(game_dict)

    tournament_played_by_player = Tournament.objects.filter(status=Tournament.Status.FINISHED).filter(pong_room__players=player)
    player_rankings = []
    total_tournies_player = total_tournies_played(player)
    total_wins_player = total_wins_tournies(player)
    total_losses_player = total_losses_tournies(player)
    wr_tourny = winrate_tourny(player)
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
        'games_history': games_history_list,
        'player_rankings': player_rankings,
        'total_games': total_games,
        'wins': wins,
        'losses': losses,
        'winrate': wr,
        'total_tournies_player': total_tournies_player,
        'total_wins_player': total_wins_player,
        'total_losses_player': total_losses_player,
        'wr_tourny': wr_tourny
    }
    return render(request, 'games-history.html', context)
from django.shortcuts import render
from .models import ChatMessage, BlockedUser
from django.contrib.auth import get_user_model
from django.db import models
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie
from django.core.serializers.json import DjangoJSONEncoder
from django.forms.models import model_to_dict
import logging
from pong.pong_functions import total_games_played, total_wins, total_losses, winrate

User = get_user_model()
logger = logging.getLogger(__name__)

# @api_view(['GET'])
# @permission_classes([IsAuthenticatedWithCookie])
# def chat_view(request):
#     users = User.objects.exclude(id=request.user.id)
#     blocked_users = BlockedUser.objects.filter(user=request.user).values_list('blocked_user_id', flat=True)
#     return render(request, 'chat.html', {
#         'users': users,
#         'blocked_users': blocked_users
#     })

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def message_history(request, recipient_id):
    messages = ChatMessage.objects.filter(
        (models.Q(sender=request.user) & models.Q(recipient_id=recipient_id)) |
        (models.Q(sender_id=recipient_id) & models.Q(recipient=request.user))
    ).order_by('timestamp')

    message_list = []
    for message in messages:
        message_dict = model_to_dict(message, fields=['id', 'content', 'timestamp'])
        message_dict['sender_id'] = str(message.sender.id)
        message_dict['recipient_id'] = str(message.recipient.id)
        message_dict['timestamp'] = int(message.timestamp.timestamp() * 1000)
        message_dict['type'] = 'text'
        message_list.append(message_dict)

    return JsonResponse(message_list, safe=False, encoder=DjangoJSONEncoder)

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def get_blocked_users(request):
    blocked_users = BlockedUser.objects.filter(user=request.user).values_list('blocked_user_id', flat=True)
    return JsonResponse(list(blocked_users), safe=False)

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def block_user(request, user_id):
    # Use get_or_create to ensure atomicity
    _, created = BlockedUser.objects.get_or_create(
        user=request.user,
        blocked_user_id=user_id
    )
    if not created:
        return JsonResponse({'success': False, 'error': 'User already blocked'})
    return JsonResponse({'success': True})

@api_view(['DELETE'])
@permission_classes([IsAuthenticatedWithCookie])
def unblock_user(request, user_id):
    if not BlockedUser.objects.filter(user=request.user, blocked_user_id=user_id).exists():
        return JsonResponse({'success': False, 'error': 'User not blocked'})
    BlockedUser.objects.filter(user=request.user, blocked_user_id=user_id).delete()
    return JsonResponse({'success': True})

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def get_users(request):
    users = User.objects.exclude(id=request.user.id)
    friends = request.user.friends.all()
    blocked_users = BlockedUser.objects.filter(user=request.user).values_list('blocked_user_id', flat=True)
    user_list = []
    for user in friends:
        user_data = user.chat_user
        user_data.update({'total_games': total_games_played(user)})
        user_data.update({'total_wins': total_wins(user)})
        user_data.update({'total_losses': total_losses(user)})
        user_data.update({'winrate': winrate(user)})
        user_data.update({ 'blocked': user.id in blocked_users })
        user_list.append(user_data)

    return JsonResponse(user_list, safe=False)

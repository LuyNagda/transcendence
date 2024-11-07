from django.shortcuts import render
from .models import ChatMessage, BlockedUser
from django.contrib.auth import get_user_model
from django.db import models
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie
from django.core.serializers.json import DjangoJSONEncoder
from django.forms.models import model_to_dict

User = get_user_model()

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def chat_view(request):
    users = User.objects.exclude(id=request.user.id)
    blocked_users = BlockedUser.objects.filter(user=request.user).values_list('blocked_user_id', flat=True)
    return render(request, 'chat/chat.html', {
        'users': users,
        'blocked_users': blocked_users
    })

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def message_history(request, recipient_id):
    messages = ChatMessage.objects.filter(
        (models.Q(sender=request.user) & models.Q(recipient_id=recipient_id)) |
        (models.Q(sender_id=recipient_id) & models.Q(recipient=request.user))
    ).order_by('timestamp')

    message_list = []
    for message in messages:
        message_dict = model_to_dict(message, fields=['content', 'timestamp'])
        message_dict['sender_id'] = message.sender.id
        message_dict['recipient_id'] = message.recipient.id
        message_dict['timestamp'] = message.timestamp.isoformat()
        message_list.append(message_dict)

    return JsonResponse(message_list, safe=False, encoder=DjangoJSONEncoder)

@api_view(['POST'])
@permission_classes([IsAuthenticatedWithCookie])
def block_user(request, user_id):
    BlockedUser.objects.create(user=request.user, blocked_user_id=user_id)
    return JsonResponse({'success': True})

@api_view(['DELETE'])
@permission_classes([IsAuthenticatedWithCookie])
def unblock_user(request, user_id):
    BlockedUser.objects.filter(user=request.user, blocked_user_id=user_id).delete()
    return JsonResponse({'success': True})

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def get_user_status(request, user_id):
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    user = User.objects.get(id=user_id)
    return JsonResponse({'status': 'online' if user.online else 'offline', 'access_token': access_token, 'refresh_token': refresh_token})

@api_view(['GET'])
@permission_classes([IsAuthenticatedWithCookie])
def get_users(request):
    users = User.objects.exclude(id=request.user.id)
    user_list = []
    for user in users:
        user_list.append({
            'id': user.id,
            'username': user.username,
            'name': getattr(user, 'name', ''),
            'profile_picture': user.profile_picture.url if hasattr(user, 'profile_picture') and user.profile_picture else '',
            'online': user.online
        })
    return JsonResponse(user_list, safe=False)

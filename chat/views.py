from django.shortcuts import render
from .models import ChatMessage, BlockedUser
from django.contrib.auth import get_user_model
from django.db import models
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from authentication.decorators import IsAuthenticatedWithCookie

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
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    messages = ChatMessage.objects.filter(
        (models.Q(sender=request.user) & models.Q(recipient_id=recipient_id)) |
        (models.Q(sender_id=recipient_id) & models.Q(recipient=request.user))
    ).order_by('timestamp')
    return render(request, 'chat/messages.html', {'messages': messages, 'access_token': access_token, 'refresh_token': refresh_token})

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

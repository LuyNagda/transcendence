from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from .models import ChatMessage, BlockedUser
from django.contrib.auth import get_user_model
from django.db import models
from django.http import JsonResponse

User = get_user_model()

@login_required
def chat_view(request):
    users = User.objects.exclude(id=request.user.id)
    blocked_users = BlockedUser.objects.filter(user=request.user).values_list('blocked_user', flat=True)
    return render(request, 'chat/chat.html', {'users': users, 'blocked_users': blocked_users})

@login_required
def message_history(request, recipient_id):
    messages = ChatMessage.objects.filter(
        (models.Q(sender=request.user) & models.Q(recipient_id=recipient_id)) |
        (models.Q(sender_id=recipient_id) & models.Q(recipient=request.user))
    ).order_by('timestamp')
    return render(request, 'chat/messages.html', {'messages': messages})

@login_required
def block_user(request, user_id):
    BlockedUser.objects.create(user=request.user, blocked_user_id=user_id)
    return JsonResponse({'success': True})

@login_required
def unblock_user(request, user_id):
    BlockedUser.objects.filter(user=request.user, blocked_user_id=user_id).delete()
    return JsonResponse({'success': True})

@login_required
def get_user_status(request, user_id):
    user = User.objects.get(id=user_id)
    return JsonResponse({'status': 'online' if user.online else 'offline'})

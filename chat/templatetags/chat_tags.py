from django import template
from django.template.loader import render_to_string
from chat.models import BlockedUser
from django.contrib.auth import get_user_model

register = template.Library()
User = get_user_model()

@register.simple_tag(takes_context=True)
def render_chat(context):
    request = context['request']
    users = User.objects.exclude(id=request.user.id)
    if request.user.is_authenticated:
        blocked_users = BlockedUser.objects.filter(user=request.user).values_list('blocked_user_id', flat=True)
    else:
        blocked_users = []
    chat_context = {
        'users': users,
        'blocked_users': blocked_users,
        'request': request,
        'user': request.user,
    }
    
    return render_to_string('chat.html', chat_context)
from django.conf import settings

def global_context(request):
    return {
        'user_id': request.user.id if request.user.is_authenticated else None,
        'log_level': getattr(settings, 'LOG_LEVEL', 'DEBUG'),
        'debug': settings.DEBUG,
    }
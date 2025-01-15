from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def global_context(request):
    return {
        # Core settings
        'config': {
            'debug': getattr(settings, 'DEBUG', False),
            'logLevel': getattr(settings, 'LOG_LEVEL', 'DEBUG'),
            'userId': request.user.id if request.user.is_authenticated else None,
            
            # WebRTC config
            'rtc': {
                'stunUrl': getattr(settings, 'RTC_STUN_URL', ''),
                'turnUrl1': getattr(settings, 'RTC_TURN_URL_1', ''),
                'turnUrl2': getattr(settings, 'RTC_TURN_URL_2', ''),
                'turnUsername': getattr(settings, 'RTC_TURN_USERNAME', ''),
                'turnCredential': getattr(settings, 'RTC_TURN_CREDENTIAL', ''),
            },
            
            # Add other global configs here
            'api': {
                'baseUrl': getattr(settings, 'API_BASE_URL', ''),
                'timeout': getattr(settings, 'API_TIMEOUT', 5000),
            },
        }
    }
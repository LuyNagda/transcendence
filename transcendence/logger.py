import logging
import json

class ColoredOptionalUserFormatter(logging.Formatter):
    COLORS = {
        'DEBUG': '\033[94m',    # Blue
        'INFO': '\033[92m',     # Green
        'WARNING': '\033[93m',  # Yellow
        'ERROR': '\033[91m',    # Red
        'CRITICAL': '\033[95m', # Magenta
    }
    RESET = '\033[0m'

    def format(self, record):
        if hasattr(record, 'user_id'):
            record.user_id_str = f" [user {record.user_id}]"
        else:
            record.user_id_str = ""

        if hasattr(record, 'data'):
            try:
                record.data = json.loads(record.data)
            except json.JSONDecodeError:
                record.data = {}
        
        levelname = record.levelname
        if levelname in self.COLORS:
            color = self.COLORS[levelname]
            formatted_message = super().format(record)
            return f"{color}{formatted_message}{self.RESET}"
        
        return super().format(record)

def get_logging_config(log_level):
    return {
        'version': 1,
        'disable_existing_loggers': False,
        'formatters': {
            'verbose': {
                '()': ColoredOptionalUserFormatter,
                'format': '[{asctime}] [{levelname}]{user_id_str} {message}',
                'style': '{',
            },
        },
        'filters': {
            'require_debug_true': {
                '()': 'django.utils.log.RequireDebugTrue',
            },
        },
        'handlers': {
            'console': {
                'level': log_level,
                'filters': ['require_debug_true'],
                'class': 'logging.StreamHandler',
                'formatter': 'verbose',
            },
        },
        'loggers': {
            'django': {
                'handlers': ['console'],
                'level': 'INFO',
            },
            'django.db.backends': {
                'handlers': ['console'],
                'level': 'WARNING',
            },
            'channels': {
                'handlers': ['console'],
                'level': log_level,
            },
            'authentication': {
                'handlers': ['console'],
                'level': log_level,
                'propagate': False,
            },
            'chat': {
                'handlers': ['console'],
                'level': log_level,
                'propagate': False,
            },
            'transcendence': {
                'handlers': ['console'],
                'level': log_level,
                'propagate': False,
            },
            'pong': {
                'handlers': ['console'],
                'level': log_level,
                'propagate': False,
            },
        },
        'root': {
            'handlers': ['console'],
            'level': 'WARNING',
        },
    }

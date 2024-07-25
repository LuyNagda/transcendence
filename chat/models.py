from django.db import models
from django.conf import settings

class ChatMessage(models.Model):
    sender = models.ForeignKey('authentication.User', related_name='sent_messages', on_delete=models.CASCADE)
    recipient = models.ForeignKey('authentication.User', related_name='received_messages', on_delete=models.CASCADE)
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ['-timestamp']
        
class BlockedUser(models.Model):
    user = models.ForeignKey('authentication.User', related_name='blocking', on_delete=models.CASCADE)
    blocked_user = models.ForeignKey('authentication.User', related_name='blocked_by', on_delete=models.CASCADE)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'blocked_user')
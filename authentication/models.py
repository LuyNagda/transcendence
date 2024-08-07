from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings

# Create your models here.

class User(AbstractUser):
    name = models.CharField(max_length=30)
    nick_name = models.CharField(max_length=10, blank=True, null=True, default=None)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=128, blank=True, null=True, default=None)
    date_of_birth = models.DateField(blank=True, null=True, default=None)
    bio = models.TextField(max_length=500, blank=True, null=True, default=None)
    profile_picture = models.ImageField(upload_to='profile_pictures/', default='profile_pictures/user.png')
    otp = models.CharField(max_length=8, blank=True, null=True, default=None)
    online = models.BooleanField(default=False)

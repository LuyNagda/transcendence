from django.contrib.auth.models import AbstractUser
from django.db import models

# Create your models here.

class User(AbstractUser):
    name = models.CharField(max_length=30)
    nick_name = models.CharField(max_length=10)
    email = models.EmailField(unique=True)
    password = models.CharField(max_length=20)

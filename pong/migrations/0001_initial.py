# Generated by Django 4.2.16 on 2024-09-12 11:16

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PongGame',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='PongRoom',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('room_id', models.CharField(max_length=10, unique=True)),
                ('max_players', models.IntegerField(default=2)),
                ('mode', models.CharField(choices=[('ai', 'Ai'), ('classic', 'Classic'), ('ranked', 'Ranked'), ('tournament', 'Tournament')], default='classic', max_length=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('players', models.ManyToManyField(related_name='pong_room_users', to=settings.AUTH_USER_MODEL)),
            ],
        ),
    ]
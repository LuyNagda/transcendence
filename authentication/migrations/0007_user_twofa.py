# Generated by Django 5.1.6 on 2025-02-14 15:01

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0006_alter_user_friendrequests_alter_user_friends'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='twofa',
            field=models.BooleanField(default=False),
        ),
    ]

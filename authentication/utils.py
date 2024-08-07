import math, random
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.contrib.sites.shortcuts import get_current_site
from django.conf import settings

def generate_otp():
    string = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
    OTP = ""
    length = len(string)
    for i in range(8) :
        OTP += string[math.floor(random.random() * length)]
 
    return OTP

def send_otp(request, user):
    site_name = get_current_site(request).name
    OTP = generate_otp()
    user.otp = OTP
    subject = render_to_string(f'OTP from {site_name}', {'site_name': site_name})
    message = render_to_string('password-reset-email.html', {
        'user': user,
        'otp': OTP,
    })
    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])

def get_refresh_token(request):
    try:
        refresh_token = request.COOKIES['refresh_token']
    except:
        refresh_token = "NULL"
    
    return refresh_token

def get_access_token(request):
    try:
        access_token = request.COOKIES['access_token']
    except:
        access_token = "NULL"

    return access_token
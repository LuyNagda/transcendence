from django.contrib.auth.tokens import default_token_generator
from django.contrib.sites.shortcuts import get_current_site
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.core.mail import send_mail
from django.conf import settings
from django.contrib.auth import authenticate, login, logout as django_logout
from django.shortcuts import render, redirect
from .forms import CustomUserCreationForm, LoginForm, ForgotPasswordForm, ResetPasswordForm, OTPForm, TWOFAForm
from django.contrib import messages
from .models import User
from .utils import generate_otp
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework.views import APIView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework import status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
import logging
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken

logger = logging.getLogger(__name__)

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def register(request):
    """
    Render registration form and handle registration.
    """
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, 'Registration successful. You can now log in.')
            return redirect('login')
        else:
            return render(request, 'register.html', {'form': form})
    else:
        form = CustomUserCreationForm()
    return render(request, 'register.html', {'form': form})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def login_view(request):
    """
    Render login form, authenticate user, and return JWT tokens.
    """
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            user = authenticate(request, username=username, password=password)
            if user is not None:
                # Issue JWT tokens
                refresh = RefreshToken.for_user(user)
                access_token = str(refresh.access_token)
                refresh_token = str(refresh)
                # Optionally set tokens in cookies
                response = render(request, 'index.html', {'user': user, 'access_token': access_token, 'refresh_token': refresh_token})
                response.set_cookie('access_token', access_token, samesite='Lax')
                response.set_cookie('refresh_token', refresh_token, samesite='Lax')
                return response
            else:
                messages.error(request, 'Invalid username or password.')
        else:
            messages.error(request, 'Invalid form submission.')

    form = LoginForm()
    return render(request, 'login.html', {'form': form})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def index(request):
    """
    Render a page for authenticated users.
    """
    access_token = request.COOKIES.get('access_token')
    refresh_token = request.COOKIES.get('refresh_token')
    return render(request, 'index.html', {'user': request.user, 'access_token': access_token, 'refresh_token': refresh_token})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    """
    Logout view that handles token invalidation and session management.
    """
    try:
        # Retrieve the refresh token from cookies
        refresh_token = request.COOKIES.get('refresh_token')

        if refresh_token:
            # Blacklist the refresh token
            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info("Refresh token blacklisted successfully.")

        # Perform Django logout to clear session data
        django_logout(request)
        logger.info("Django session cleared successfully.")

        # Create a response and delete the tokens
        response = render(request, 'login.html', {'form': LoginForm()})
        response.delete_cookie('access_token')
        response.delete_cookie('refresh_token')
        
        return response

    except Exception as e:
        logger.error(f"Logout error: {str(e)}")
        return Response({"error": "Logout failed. Please try again."}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    """
    Handle forgot password and send a reset link.
    """
    if request.method == 'POST':
        form = ForgotPasswordForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            users = User.objects.filter(email=email)
            if users.exists():
                for user in users:
                    token = default_token_generator.make_token(user)
                    uid = urlsafe_base64_encode(force_bytes(user.pk))
                    site_name = get_current_site(request).name
                    domain = 'localhost:8000'
                    protocol = 'http'
                    subject = render_to_string('password-reset-subject.txt', {'site_name': site_name})
                    message = render_to_string('password-reset-email.html', {
                        'user': user,
                        'protocol': protocol,
                        'domain': domain,
                        'uid': uid,
                        'token': token,
                    })
                    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
                messages.success(request, 'Password reset link sent.')
            else:
                messages.error(request, 'No user with this email address.')

            return render(request, 'password-reset-done.html')
    else:
        form = ForgotPasswordForm()
    return render(request, 'forgot-password.html', {'form': form})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def reset_password(request, uidb64, token):
    """
    Handle password reset form submission.
    """
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        if request.method == 'POST':
            form = ResetPasswordForm(user, request.POST)
            if form.is_valid():
                form.save()
                messages.success(request, 'Password has been reset.')
                return redirect('login')
        else:
            form = ResetPasswordForm(user)
        return render(request, 'password-reset-confirm.html', {'form': form, 'uid': uidb64, 'token': token})
    else:
        messages.error(request, 'Invalid password reset link.')
        return render(request, 'password-reset-confirm.html', {'form': form, 'uid': uidb64, 'token': token})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny])
def otp(request):
    """
    Handle OTP verification and sending.
    """
    if request.method == 'POST':
        if 'otp' in request.POST:
            form = OTPForm(request.POST)
            if form.is_valid():
                otp = form.cleaned_data['otp']
                try:
                    user = User.objects.get(otp=otp)
                    user.otp = None
                    user.save()
                    refresh = RefreshToken.for_user(user)
                    access_token = str(refresh.access_token)
                    refresh_token = str(refresh)
                    response = render(request, 'index.html', {'user': user, 'access_token': access_token, 'refresh_token': refresh_token})
                    response.set_cookie('access_token', access_token, httponly=True, samesite='Lax')
                    response.set_cookie('refresh_token', refresh_token, httponly=True, samesite='Lax')
                    return response
                except User.DoesNotExist:
                    messages.error(request, 'Invalid OTP.')
            return render(request, 'login-2fa.html', {'form': form})
        elif 'email' in request.POST:
            form = TWOFAForm(request.POST)
            if form.is_valid():
                email = form.cleaned_data['email']
                try:
                    user = User.objects.get(email=email)
                    otp = generate_otp()
                    user.otp = otp
                    user.save()
                    subject = f'OTP from {get_current_site(request).name}'
                    message = render_to_string('user-2fa-email.html', {'user': user, 'otp': otp})
                    send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email])
                    return render(request, 'login-2fa.html', {'form': OTPForm()})
                except User.DoesNotExist:
                    messages.error(request, 'Invalid email.')
            return render(request, 'login-2fa.html', {'form': form})
    else:
        form = TWOFAForm()
    return render(request, 'login-2fa.html', {'form': form})

from django.contrib.auth.decorators import login_required
from authentication.decorators import custom_login_required
from authentication.models import User
from django.contrib import messages
from django.shortcuts import render, redirect
from .forms import ProfileForm

@custom_login_required
def profile(request):
    user = request.user
    if request.method == 'POST':
        form = ProfileForm(request.POST, request.FILES, item_id=user.username)
        if form.is_valid():
            form.save()
            messages.success(request, 'Profile updated successfully.')
            return redirect('profile')
        else:
            messages.error(request, 'Profile not updated. Please correct the errors below.')
    else:
        form = ProfileForm(item_id=user.username)
    context = {'user': user, 'form': form, 'profile_picture': user.profile_picture.url if user.profile_picture else None}
    return render(request, 'profile.html', context)
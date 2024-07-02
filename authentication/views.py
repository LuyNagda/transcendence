from django.shortcuts import render, redirect
from django.http import HttpResponse
from .forms import CustomUserCreationForm

def register(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            form.save()
            if request.htmx:
                return HttpResponse('<div>Registration successful! <a href="#" hx-get="{% url "login" %}" hx-target="#content" hx-swap="innerHTML">Login</a></div>')
            return redirect('login')
    else:
        form = CustomUserCreationForm()

    context = {'form': form}

    if request.htmx:
        return render(request, 'registration/register.html', context)

    return render(request, 'base.html', context)

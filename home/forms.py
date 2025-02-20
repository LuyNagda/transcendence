from django import forms
from authentication.models import User
from django.contrib.auth.forms import PasswordChangeForm

class ProfileForm(forms.Form):
    name = forms.CharField(max_length=30, widget=forms.TextInput(attrs={'class': 'form-control', 'readonly': 'readonly', 'placeholder': 'user'}))
    nick_name = forms.CharField(max_length=10, label='Tournament Alias', widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'name'}))
    email = forms.EmailField(widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'email'}))
    date_of_birth = forms.DateField(widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date', 'placeholder': 'YYYY-MM-DD'}), input_formats=['%Y-%m-%d'], required=False)
    bio = forms.CharField(max_length=500, widget=forms.Textarea(attrs={'class': 'form-control', 'placeholder': 'bio'}), required=False)
    profile_picture = forms.ImageField(widget=forms.FileInput(attrs={'class': 'form-control', 'placeholder': 'profile-picture'}), required=False)

    def __init__(self, *args, **kwargs):
        item_id = kwargs.pop('item_id')
        super(ProfileForm, self).__init__(*args, **kwargs)
        user = User.objects.get(username=item_id)
        self.fields['name'].initial = user.username
        self.fields['nick_name'].initial = user.nick_name 
        self.fields['email'].initial = user.email
        self.fields['date_of_birth'].initial = user.date_of_birth
        self.fields['bio'].initial = user.bio

    def save(self, commit=True):
        user = User.objects.get(username=self.cleaned_data['name'])
        user.username = self.cleaned_data['name']
        user.email = self.cleaned_data['email']
        user.nick_name = self.cleaned_data['nick_name']
        user.date_of_birth = self.cleaned_data['date_of_birth']
        user.bio = self.cleaned_data['bio']
        if self.cleaned_data.get('profile_picture'):
            user.profile_picture = self.cleaned_data['profile_picture']
        if commit:
            user.save()
        return user

class MyPasswordChangeForm(PasswordChangeForm):
    def __init__(self, *args, **kwargs):
        super(MyPasswordChangeForm, self).__init__(*args, **kwargs)
        for fieldname in ['old_password', 'new_password1', 'new_password2']:
            self.fields[fieldname].widget.attrs.update({'class': 'form-control', 'placeholder': 'password'})
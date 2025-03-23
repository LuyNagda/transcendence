from django import forms
from authentication.models import User
from django.contrib.auth.forms import PasswordChangeForm
from django.core.exceptions import ValidationError

class ProfileForm(forms.Form):
    name = forms.CharField(max_length=30, widget=forms.TextInput(attrs={'class': 'form-control', 'readonly': 'readonly', 'placeholder': 'user', 'autocomplete': 'username'}))
    nick_name = forms.CharField(max_length=10, label='Tournament Alias', widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'name', 'autocomplete': 'nickname'}))
    email = forms.EmailField(widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'email', 'autocomplete': 'email'}))
    date_of_birth = forms.DateField(widget=forms.DateInput(attrs={'class': 'form-control', 'type': 'date', 'placeholder': 'YYYY-MM-DD'}), input_formats=['%Y-%m-%d'], required=False)
    bio = forms.CharField(max_length=500, widget=forms.Textarea(attrs={'class': 'form-control', 'placeholder': 'bio'}), required=False)
    profile_picture = forms.ImageField(widget=forms.FileInput(attrs={'class': 'form-control', 'placeholder': 'profile-picture'}), required=False)

    def __init__(self, *args, **kwargs):
        item_id = kwargs.pop('item_id')
        super(ProfileForm, self).__init__(*args, **kwargs)
        user = User.objects.get(username=item_id)
        self.instance = user
        self.fields['name'].initial = user.username
        self.fields['nick_name'].initial = user.nick_name 
        self.fields['email'].initial = user.email
        self.fields['date_of_birth'].initial = user.date_of_birth
        self.fields['bio'].initial = user.bio

    def clean_name(self):
        if self.cleaned_data['name'] != self.instance.username:
            raise forms.ValidationError("Cannot change username.")
        return self.cleaned_data['name']

    def clean_profile_picture(self):
        profile_picture = self.cleaned_data.get('profile_picture')
        if profile_picture and profile_picture.size > 512 * 1024:  # 512 KB limit
            raise ValidationError("Profile picture size cannot exceed 512 KB.")
        return profile_picture

    def save(self, commit=True):
        if not self.instance:
            raise ValueError("Cannot save without a valid user instance.")

        self.instance.email = self.cleaned_data['email']
        self.instance.nick_name = self.cleaned_data['nick_name']
        self.instance.date_of_birth = self.cleaned_data['date_of_birth']
        self.instance.bio = self.cleaned_data['bio']

        if self.cleaned_data.get('profile_picture'):
            self.instance.profile_picture = self.cleaned_data['profile_picture']

        if commit:
            self.instance.save()
        return self.instance

class MyPasswordChangeForm(PasswordChangeForm):
    def __init__(self, *args, **kwargs):
        super(MyPasswordChangeForm, self).__init__(*args, **kwargs)
        for fieldname in ['old_password', 'new_password1', 'new_password2']:
            self.fields[fieldname].widget.attrs.update({'class': 'form-control', 'placeholder': 'password'})
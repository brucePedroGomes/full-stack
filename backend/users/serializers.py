from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from rest_framework import serializers


class UserSerializer(serializers.ModelSerializer[User]):
    """Return basic account details without exposing passwords."""

    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email']
        read_only_fields = fields

from django.contrib.auth import get_user_model
from django.contrib.auth.models import User
from rest_framework import serializers


class UserSummarySerializer(serializers.ModelSerializer[User]):
    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'first_name', 'last_name']
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer[User]):
    """Return basic account details without exposing passwords."""

    class Meta:
        model = get_user_model()
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = fields

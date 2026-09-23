from django.contrib.auth import get_user_model
from rest_framework import serializers


class UserSerializer(serializers.ModelSerializer):
    """Return basic account details without exposing passwords."""

    # DRF supports this Meta class; Pyright treats it as an incompatible override.
    class Meta:  # pyright: ignore[reportIncompatibleVariableOverride]
        model = get_user_model()
        fields = ['id', 'username', 'email']
        read_only_fields = fields

from typing import cast

from django.contrib.auth.models import User
from rest_framework.generics import RetrieveAPIView

from .serializers import UserSerializer


class UserMeView(RetrieveAPIView[User]):
    """Return the logged-in user's account details."""

    serializer_class = UserSerializer

    def get_object(self) -> User:
        """Use the authenticated user instead of an ID from the URL."""
        return cast(User, self.request.user)

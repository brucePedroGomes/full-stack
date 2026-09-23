from rest_framework.generics import RetrieveAPIView

from .serializers import UserSerializer


class UserMeView(RetrieveAPIView):
    """Return the logged-in user's account details."""

    serializer_class = UserSerializer

    def get_object(self):
        """Use the authenticated user instead of an ID from the URL."""
        return self.request.user

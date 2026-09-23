from typing import cast

from django.contrib.auth.models import User
from rest_framework.filters import SearchFilter
from rest_framework.generics import ListAPIView, RetrieveAPIView

from .pagination import UserPagination
from .serializers import UserSerializer, UserSummarySerializer


class UserListView(ListAPIView[User]):
    queryset = User.objects.order_by('username')
    serializer_class = UserSummarySerializer
    pagination_class = UserPagination
    filter_backends = [SearchFilter]
    search_fields = ['first_name', 'last_name', 'username']


class UserMeView(RetrieveAPIView[User]):
    """Return the logged-in user's account details."""

    serializer_class = UserSerializer

    def get_object(self) -> User:
        """Use the authenticated user instead of an ID from the URL."""
        return cast(User, self.request.user)

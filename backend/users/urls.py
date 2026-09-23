from django.urls import path

from .views import UserListView, UserMeView

app_name = 'users'

urlpatterns = [
    path('', UserListView.as_view(), name='list'),
    path('me/', UserMeView.as_view(), name='me'),
]

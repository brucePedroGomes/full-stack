from django.urls import path

from .views import TaskCompleteView, TaskDetailView, TaskListCreateView

app_name = 'tasks'

urlpatterns = [
    path('', TaskListCreateView.as_view(), name='list'),
    path('<int:pk>/', TaskDetailView.as_view(), name='detail'),
    path('<int:pk>/complete/', TaskCompleteView.as_view(), name='complete'),
]

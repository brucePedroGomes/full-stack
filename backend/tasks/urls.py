from django.urls import path

from .views import TaskDetailView, TaskListCreateView, TaskStatusView

app_name = 'tasks'

urlpatterns = [
    path('', TaskListCreateView.as_view(), name='list'),
    path('<int:pk>/', TaskDetailView.as_view(), name='detail'),
    path('<int:pk>/status/', TaskStatusView.as_view(), name='status'),
]

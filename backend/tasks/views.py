from django.db.models import Model
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.serializers import BaseSerializer

from .filters import TaskFilter
from .models import Task
from .pagination import TaskPagination
from .serializers import TaskSerializer, TaskStatusSerializer


class TaskListCreateView(generics.ListCreateAPIView[Task]):
    queryset = Task.objects.select_related('assigned_to')
    serializer_class = TaskSerializer
    pagination_class = TaskPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_class = TaskFilter
    search_fields = ['title', 'description']
    ordering_fields = ['id']

    def perform_create[ModelT: Model](
        self, serializer: BaseSerializer[ModelT]
    ) -> None:
        """Set the creator from the request, not from client input."""
        serializer.save(created_by=self.request.user)


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView[Task]):
    queryset = Task.objects.select_related('assigned_to')
    serializer_class = TaskSerializer


class TaskStatusView(generics.UpdateAPIView[Task]):
    queryset = Task.objects.all()
    serializer_class = TaskStatusSerializer
    http_method_names = ['patch', 'options']

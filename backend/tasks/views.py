from django.db.models import Model
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import generics
from rest_framework.serializers import BaseSerializer

from .filters import TaskFilter
from .models import Task
from .pagination import TaskPagination
from .serializers import TaskSerializer, TaskStatusSerializer


class TaskListCreateView(generics.ListCreateAPIView[Task]):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    pagination_class = TaskPagination
    filter_backends = [DjangoFilterBackend]
    filterset_class = TaskFilter

    def perform_create[ModelT: Model](
        self, serializer: BaseSerializer[ModelT]
    ) -> None:
        serializer.save(created_by=self.request.user)


class TaskDetailView(generics.RetrieveUpdateDestroyAPIView[Task]):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer


class TaskStatusView(generics.UpdateAPIView[Task]):
    queryset = Task.objects.all()
    serializer_class = TaskStatusSerializer
    http_method_names = ['patch', 'options']

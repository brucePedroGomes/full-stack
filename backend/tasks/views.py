from rest_framework import generics, status
from rest_framework.response import Response

from .models import Task
from .pagination import TaskPagination
from .serializers import TaskFilterSerializer, TaskSerializer


class TaskListCreateView(generics.GenericAPIView):
    serializer_class = TaskSerializer
    pagination_class = TaskPagination

    def get_queryset(self):
        queryset = Task.objects.all()
        filters = TaskFilterSerializer(data=self.request.query_params)
        filters.is_valid(raise_exception=True)
        values = filters.validated_data
        if 'status' in values:
            queryset = queryset.filter(status=values['status'])
        if 'due_date' in values:
            queryset = queryset.filter(due_date=values['due_date'])
        if 'due_before' in values:
            queryset = queryset.filter(due_date__lte=values['due_before'])
        if 'due_after' in values:
            queryset = queryset.filter(due_date__gte=values['due_after'])
        return queryset

    def get(self, request):
        page = self.paginate_queryset(self.get_queryset())
        serializer = self.get_serializer(page, many=True)
        return self.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(created_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TaskDetailView(generics.GenericAPIView):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

    def get(self, request, pk):
        return Response(self.get_serializer(self.get_object()).data)

    def put(self, request, pk):
        return self.update_task(request, partial=False)

    def patch(self, request, pk):
        return self.update_task(request, partial=True)

    def update_task(self, request, partial):
        serializer = self.get_serializer(
            self.get_object(), data=request.data, partial=partial
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        self.get_object().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TaskCompleteView(generics.GenericAPIView):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer

    def post(self, request, *args, **kwargs):
        task = self.get_object()
        if task.status != Task.Status.COMPLETED:
            task.mark_completed()
        return Response(self.get_serializer(task).data, status=status.HTTP_200_OK)

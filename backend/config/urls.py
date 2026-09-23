"""Routes for health checks, admin, and local static files."""

from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path

from .health import HealthView

urlpatterns = [
    path('api/users/', include('users.urls')),
    path('health/live/', HealthView.as_view(), name='health-live'),
    path('health/ready/', HealthView.as_view(), name='health-ready'),
    path('admin/', admin.site.urls),
]

# Serve local admin files; disabled when debug is off.
urlpatterns += staticfiles_urlpatterns()

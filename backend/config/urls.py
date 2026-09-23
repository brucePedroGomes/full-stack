"""Routes for the API, health checks, admin, and development tools."""

from django.conf import settings
from django.contrib import admin
from django.contrib.staticfiles.urls import staticfiles_urlpatterns
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .health import HealthView

urlpatterns = [
    path('api/auth/token/', TokenObtainPairView.as_view(), name='token-obtain'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('api/tasks/', include('tasks.urls')),
    path('api/users/', include('users.urls')),
    path('health/live/', HealthView.as_view(), name='health-live'),
    path('health/ready/', HealthView.as_view(), name='health-ready'),
    path('admin/', admin.site.urls),
]

if settings.ENABLE_API_DOCS:
    urlpatterns += [
        path('api/schema/', SpectacularAPIView.as_view(), name='api-schema'),
        path('api/docs/', SpectacularSwaggerView.as_view(url_name='api-schema'), name='api-docs'),
    ]

# Serve local static files; disabled when debug is off.
urlpatterns += staticfiles_urlpatterns()

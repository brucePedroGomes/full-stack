from django.core.cache import cache
from django.db import DatabaseError, connection
from django.http import HttpRequest, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.cache import never_cache
from opentelemetry.instrumentation.utils import suppress_instrumentation
from redis.exceptions import RedisError


@method_decorator(never_cache, name='dispatch')
class HealthView(View):
    http_method_names = ['get', 'head']

    def get(self, request: HttpRequest) -> JsonResponse:
        """Report that Django responds, without checking the database."""
        return JsonResponse({'status': 'ok'})


class ReadyView(HealthView):
    def get(self, request: HttpRequest) -> JsonResponse:
        """Report ready only when the database and Redis answer."""
        try:
            with suppress_instrumentation():
                with connection.cursor() as cursor:
                    cursor.execute('SELECT 1')
                cache.get('health-check')
        except (DatabaseError, RedisError):
            return JsonResponse({'status': 'unavailable'}, status=503)
        return JsonResponse({'status': 'ok'})

from django.http import HttpRequest, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.cache import never_cache


@method_decorator(never_cache, name='dispatch')
class HealthView(View):
    http_method_names = ['get', 'head']

    def get(self, request: HttpRequest) -> JsonResponse:
        """Report that Django responds without checking the database."""
        return JsonResponse({'status': 'ok'})

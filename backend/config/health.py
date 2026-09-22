from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.cache import never_cache


@method_decorator(never_cache, name='dispatch')
class HealthView(View):
    """Report whether Django responds, without checking shared services.

    Both health URLs use this check. EKS decides what to do after failures:
    readiness stops traffic to the pod; liveness restarts the container.

    AWS advises keeping both checks independent of shared services like RDS.
    Trade-off: a 200 response does not prove the database works.
    Source: https://docs.aws.amazon.com/eks/latest/best-practices/application.html
    """

    # Django reads this list to allow GET and HEAD only.
    http_method_names = ['get', 'head']

    def get(self, request, *args, **kwargs):
        """Return status only; Django also uses this method for HEAD requests."""
        return JsonResponse({'status': 'ok'})

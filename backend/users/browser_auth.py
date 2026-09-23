"""Browser session endpoints for the React app."""

from django.contrib.auth import login, logout
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.forms import AuthenticationForm
from django.http import HttpRequest, HttpResponse, JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from django.views.decorators.debug import sensitive_post_parameters
from rest_framework_simplejwt.tokens import AccessToken


@method_decorator(ensure_csrf_cookie, name='dispatch')
class BrowserCsrfView(View):
    http_method_names = ['get']

    def get(self, request: HttpRequest) -> JsonResponse:
        return JsonResponse({})


@method_decorator(
    [sensitive_post_parameters(), csrf_protect, never_cache], name='dispatch'
)
class BrowserLoginView(View):
    http_method_names = ['post']

    def post(self, request: HttpRequest) -> JsonResponse:
        form = AuthenticationForm(request, data=request.POST)
        if not form.is_valid():
            return JsonResponse({'detail': 'Invalid credentials.'}, status=401)

        user = form.get_user()
        login(request, user)
        return JsonResponse({'access': str(AccessToken.for_user(user))})


@method_decorator([csrf_protect, never_cache], name='dispatch')
class BrowserTokenView(View):
    http_method_names = ['post']

    def post(self, request: HttpRequest) -> JsonResponse:
        user = request.user
        if not isinstance(user, AbstractBaseUser) or not user.is_authenticated:
            return JsonResponse({'detail': 'Not signed in.'}, status=401)

        return JsonResponse({'access': str(AccessToken.for_user(user))})


@method_decorator(csrf_protect, name='dispatch')
class BrowserLogoutView(View):
    http_method_names = ['post']

    def post(self, request: HttpRequest) -> HttpResponse:
        logout(request)
        return HttpResponse(status=204)

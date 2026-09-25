API documentation: drf-spectacular

I chose [drf-spectacular](https://drf-spectacular.readthedocs.io/en/latest/) because [Django REST framework recommends it](https://www.django-rest-framework.org/topics/documenting-your-api/). It builds an OpenAPI 3 schema from my API and shows it with Swagger UI. This lets people read the endpoints, check the inputs, and try requests in the browser.\

The exercise names [drf-yasg](https://drf-yasg.readthedocs.io/en/stable/readme.html), which generates OpenAPI 2 documentation. I chose drf-spectacular for OpenAPI 3 and its support for Simple JWT and django-filter.

The Swagger page is at http://localhost:8000/api/docs/ and the schema is at http://localhost:8000/api/schema/. Both are available when `DJANGO_ENABLE_API_DOCS=true`. Tests check that the schema includes task routes, due date filters, and JWT authentication.

- [DRF recommends drf-spectacular](https://www.django-rest-framework.org/topics/documenting-your-api/#drf-spectacular): DRF says it is "the recommended way" to generate and show OpenAPI schemas.
- [DRF's built-in OpenAPI support is deprecated](https://www.django-rest-framework.org/api-guide/schemas/): The deprecation notice recommends drf-spectacular as the replacement.

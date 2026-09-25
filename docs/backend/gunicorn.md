Gunicorn on EKS

> **Partly a plan.** Gunicorn runs today in local Docker. The EKS parts are a plan, not built yet.

I chose [Gunicorn](https://docs.djangoproject.com/en/6.1/howto/deployment/wsgi/) to serve my Django app in production. It starts workers that handle web requests. It also restarts failed workers. I can keep my WSGI app code and test the server locally with Docker before using it on EKS.\
Without Gunicorn, I would lose its worker management and need another production server.

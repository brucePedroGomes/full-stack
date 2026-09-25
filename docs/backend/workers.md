Workers and threads

I chose [2 workers with 4 threads each](https://gunicorn.org/design/) so my app can answer 8 requests at once. A worker is a separate process with its own copy of Django. A thread is a helper inside a worker. When one thread waits for the database, another thread can work. This keeps the board fast when many people use the app.\
Without this setup, my app would answer one request at a time, and people would wait in a line.

- [Workers](https://gunicorn.org/reference/settings/#workers): Each worker is a process. Workers run at the same time on different CPU cores.

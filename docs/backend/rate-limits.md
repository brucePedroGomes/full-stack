Rate limits

> **Partly a plan.** The DRF limits work today. The AWS WAF part is a plan, not built yet.

I limit how many requests a client can send. [AWS WAF](https://repost.aws/knowledge-center/waf-prevent-brute-force-attacks) handles security in front of the app, and [DRF throttling](https://www.django-rest-framework.org/api-guide/throttling/) handles fair use inside it. [Django](https://docs.djangoproject.com/en/6.1/topics/security/) does not throttle logins, and DRF says its throttling is not a security tool.\
Without this, a bot could try thousands of passwords or flood the app.

## DRF limits

In `DEFAULT_THROTTLE_RATES` in `config/settings.py`. Over a limit, the client gets `429`.

| Requests | Limit |
|---|---|
| Not signed in, per IP | 60 per minute |
| Signed in, per user | 120 per minute |
| Login (JWT, browser, and admin), per IP | 10 per minute |
| CSRF route and admin login page, per IP | 60 per minute |

Behind proxies, set `DJANGO_NUM_PROXIES` to the number of proxies, so DRF sees the real IP.

## AWS WAF plan

- A rate rule per IP, against floods.
- A stricter rate rule for login `POST`s.
- The Amazon IP reputation list.
- The ATP rule group for the login.
- Only CloudFront can reach the ALB. See [AWS setup](setup.md).

The WAF is not exact. It usually reacts within 30 seconds.

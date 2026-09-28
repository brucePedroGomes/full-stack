AWS setup

> **A plan.** Nothing is built on AWS yet.

```
Users
  → CloudFront + WAF      (security: floods, password guessing, bad IPs)
  → ALB                   (only CloudFront can reach it)
  → EKS pods: Gunicorn + Django   (fair-use limits: DRF throttling)
  → ElastiCache Redis + RDS PostgreSQL
```


- Django + Gunicorn: EKS, or ECS Fargate, which is simpler
- Celery worker + beat: same cluster, as separate services.
- Redis: ElastiCache.
- Frontend: S3 + CloudFront. It's a static Vite build.
- Secrets: Secrets Manager
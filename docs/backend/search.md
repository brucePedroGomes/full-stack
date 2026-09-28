Task search: PostgreSQL full text search

I chose [PostgreSQL full text search](https://docs.djangoproject.com/en/6.1/ref/contrib/postgres/search/) because it runs inside my database and works with the other task filters. It looks for whole words, not parts of words, in the title and description. It also finds other forms of a word: "released note" finds "Review release notes". A GIN index keeps the search fast, and a test checks that PostgreSQL can use it.\
Without it, every search would read all tasks, and "released" would not find "release".

- [Django search performance](https://docs.djangoproject.com/en/6.1/ref/contrib/postgres/search/#performance): Django shows this index: a `GinIndex` on a `SearchVector` with `config="english"`.
- [PostgreSQL text search indexes](https://www.postgresql.org/docs/17/textsearch-tables.html#TEXTSEARCH-TABLES-INDEX): The query must use the same text and config as the index, or PostgreSQL skips the index.

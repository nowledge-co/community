---
title: Python Async Patterns
source: chatgpt
date: 2025-06-15
---

## System

You are a senior Python developer. Explain concepts clearly with practical examples.

## User

I keep getting confused about when to use `asyncio.gather` vs `asyncio.create_task`. What's the difference?

## Assistant

They serve different purposes:

**`asyncio.gather(*coros)`** runs multiple coroutines concurrently and waits for all of them to complete. It returns results in the same order you passed them:

```python
async def fetch_all():
    user, posts, comments = await asyncio.gather(
        fetch_user(1),
        fetch_posts(1),
        fetch_comments(1),
    )
    return user, posts, comments
```

**`asyncio.create_task(coro)`** schedules a coroutine to run in the background. You get a `Task` object back and can await it later — or never:

```python
async def process():
    # Fire and forget — runs in background
    task = asyncio.create_task(send_analytics())

    # Do other work while analytics sends
    result = await compute_something()

    # Optionally await if you need the result
    await task
```

**Rule of thumb:**
- Use `gather` when you need all results before continuing
- Use `create_task` when you want fire-and-forget or need to start work early

## User

What about error handling? If one task in `gather` fails, do the others keep running?

## Assistant

By default, if any coroutine in `gather` raises an exception, the exception propagates immediately — but the other tasks **keep running** in the background. This is a common source of bugs.

You can change this with `return_exceptions=True`:

```python
results = await asyncio.gather(
    risky_operation_1(),
    risky_operation_2(),
    return_exceptions=True,
)

for result in results:
    if isinstance(result, Exception):
        logger.error(f"Task failed: {result}")
    else:
        process(result)
```

For `create_task`, unhandled exceptions are logged as warnings when the task is garbage-collected. Always either `await` the task or add an explicit error handler:

```python
task = asyncio.create_task(background_work())
task.add_done_callback(handle_task_exception)
```

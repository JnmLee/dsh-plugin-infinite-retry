# Infinite Retry

**Author: Tokenav** · A DeepSeek Harness plugin that removes the model-request retry cap.

When enabled, every failed model-request attempt is retried again after exponential backoff (1s, 2s, 4s … capped at 60s). The handler is registered on the root context, so it also covers subagent requests. Cancelling the turn stops the retry loop immediately.

## Install

### From npm

```bash
dsh plugin add dsh-plugin-infinite-retry
```

Or paste `dsh-plugin-infinite-retry` into **Settings → Plugins → Add plugin**.

### From GitHub

```bash
dsh plugin add github:JnmLee/dsh-plugin-infinite-retry
```

Or paste `https://github.com/JnmLee/dsh-plugin-infinite-retry` into the Add plugin dialog.

### From a local checkout

```bash
dsh plugin add ./infinite-retry
```

## Where the switch is

**Settings → Infinite retry**. The setting is global and persisted at `$DSH_HOME/infinite-retry/settings.json`; it survives restarts.

## Behavior

- Disabled (default): the provider's normal retry policy applies, including its maximum retry count.
- Enabled: the plugin returns `{ kind: 'retry' }` for every `agent/request-error`, without delegating to the default policy. It waits before retrying, honors `providerRetryAfterMs` when present, and caps every wait at 60 seconds.
- Turn cancellation is respected: an aborted turn is never retried.
- The per-agent backoff counter resets when the agent becomes idle.

## Warning

Permanent errors (authentication, invalid request, unavailable model) are retried forever too. A turn can wait for a long time and keep hitting the provider. Cancel the turn to stop. Use this only when you want a run to survive transient upstream failures.

## License

MIT © Tokenav

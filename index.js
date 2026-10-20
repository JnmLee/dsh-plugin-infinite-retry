/**
 * Infinite Retry — Host half.
 *
 * When enabled, every failed model-request attempt is retried forever with
 * exponential backoff, regardless of the provider's default retry cap. The
 * listener is registered on the root context, so scoped dispatches for
 * subagents reach it too. Cancelling the turn (the payload signal) stops the
 * loop immediately.
 *
 * Author: Tokenav
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

const STORE_VERSION = 1
const MIN_DELAY_MS = 250
const MAX_DELAY_MS = 60_000
const MAX_BODY = 64 * 1024

function defaultState() {
  return { version: STORE_VERSION, enabled: false }
}

function normalizeState(raw) {
  return { version: STORE_VERSION, enabled: raw?.enabled === true }
}

class SettingsStore {
  constructor(ctx) {
    this.ctx = ctx
    this.file = join(
      process.env.DSH_HOME || join(homedir(), '.dsh'),
      'infinite-retry',
      'settings.json',
    )
    this.state = defaultState()
    this.loading = null
    this.queue = Promise.resolve()
  }

  async ensure() {
    if (!this.loading) this.loading = this.load()
    return this.loading
  }

  async load() {
    try {
      const raw = await readFile(this.file, 'utf8')
      this.state = normalizeState(JSON.parse(raw))
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.warn(`[infinite-retry] cannot read ${this.file}:`, error?.message ?? error)
      }
      this.state = defaultState()
      try {
        await this.write(this.state)
      } catch (writeError) {
        console.warn(`[infinite-retry] cannot create ${this.file}:`, writeError?.message ?? writeError)
      }
    }
    return this.state
  }

  async setEnabled(enabled) {
    const run = async () => {
      const next = normalizeState({ enabled })
      await this.write(next)
      this.state = next
      return next
    }
    const result = this.queue.then(run, run)
    this.queue = result.catch(() => {})
    return result
  }

  async write(state) {
    const body = `${JSON.stringify(state, null, 2)}\n`
    await mkdir(dirname(this.file), { recursive: true })
    const temporary = `${this.file}.${process.pid}.tmp`
    await writeFile(temporary, body, 'utf8')
    await rename(temporary, this.file)
  }
}

/**
 * Exponential backoff with jitter. A provider Retry-After hint wins, but is
 * still capped: an infinite retry policy must not sleep for hours.
 */
function computeDelay(failure, policy, attempt) {
  const initialValue = Number(policy?.initialDelayMs)
  const initial = Math.max(
    MIN_DELAY_MS,
    Number.isFinite(initialValue) && initialValue > 0 ? initialValue : 1000,
  )
  const maxValue = Number(policy?.maxDelayMs)
  const max = Math.max(
    initial,
    Number.isFinite(maxValue) && maxValue > 0 ? maxValue : MAX_DELAY_MS,
  )
  const jitterValue = Number(policy?.jitterRatio)
  const jitter = Number.isFinite(jitterValue) ? Math.min(1, Math.max(0, jitterValue)) : 0.2
  const retryAfter = Number(failure?.providerRetryAfterMs)
  const exponential = Math.min(initial * 2 ** Math.min(Math.max(attempt, 1) - 1, 12), max)
  const base = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, max) : exponential
  const jittered = base * (1 + (Math.random() * 2 - 1) * jitter)
  return Math.max(MIN_DELAY_MS, Math.min(max, Math.round(jittered)))
}

function sleep(ms, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve()
      return
    }
    let timer
    const onAbort = () => {
      clearTimeout(timer)
      resolve()
    }
    timer = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort)
      resolve()
    }, ms)
    signal?.addEventListener?.('abort', onAbort, { once: true })
  })
}

class RpcError extends Error {
  constructor(code, message, status = 400) {
    super(message)
    this.code = code
    this.status = status
  }
}

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'x-infinite-retry-version': '1.0.0',
  })
  res.end(JSON.stringify(body))
}

async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY) throw new RpcError('BODY_TOO_LARGE', '请求体过大。', 413)
    chunks.push(chunk)
  }
  if (size === 0) throw new RpcError('EMPTY_BODY', '请求体为空。', 400)
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new RpcError('INVALID_JSON', '请求体不是合法 JSON。', 400)
  }
}

async function dispatchRpc(body, store) {
  const method = typeof body?.method === 'string' ? body.method : ''
  const params = body?.params && typeof body.params === 'object' ? body.params : {}

  switch (method) {
    case 'state': {
      const state = await store.ensure()
      return { enabled: state.enabled }
    }
    case 'setEnabled': {
      const state = await store.setEnabled(params.enabled === true)
      return { enabled: state.enabled }
    }
    default:
      throw new RpcError('UNKNOWN_METHOD', `未知方法：${method || '(empty)'}`, 404)
  }
}

async function handleRoute(req, res, deps) {
  try {
    if (req.method !== 'POST') {
      json(res, 405, { ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Only POST is accepted.' } })
      return
    }
    const rejection = await deps.connection.requestRejection({ headers: req.headers })
    if (rejection) {
      json(res, rejection, {
        ok: false,
        error: {
          code: rejection === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
          message: '请求未通过本机页面认证。',
        },
      })
      return
    }
    const body = await readJsonBody(req)
    const value = await dispatchRpc(body, deps.store)
    json(res, 200, { ok: true, value })
  } catch (error) {
    const status = error instanceof RpcError ? error.status : 500
    if (status >= 500) console.warn('[infinite-retry] request failed:', error?.stack ?? error)
    json(res, status, {
      ok: false,
      error: {
        code: error instanceof RpcError ? error.code : 'INTERNAL',
        message: error?.message ?? '内部错误。',
      },
    })
  }
}

export function apply(ctx) {
  const store = new SettingsStore(ctx)
  const failures = new Map()

  void store.ensure().catch((error) => {
    console.warn('[infinite-retry] initial load failed:', error?.message ?? error)
  })

  ctx.on('agent/status', ({ agent, status }) => {
    if (status === 'idle') failures.delete(agent.id)
  })

  ctx.on('agent/disposed', ({ agent }) => {
    failures.delete(agent.id)
  })

  ctx.on(
    'agent/request-error',
    async (payload, next) => {
      if (!store.state.enabled) return next()
      if (payload.signal?.aborted) return next()

      const key = payload.agent?.id ?? 'unknown'
      const attempt = (failures.get(key) ?? 0) + 1
      failures.set(key, attempt)

      const delay = computeDelay(payload.failure, payload.retryPolicy, attempt)
      await sleep(delay, payload.signal)

      if (!store.state.enabled) return next()
      if (payload.signal?.aborted) return next()
      return { kind: 'retry' }
    },
    { prepend: true },
  )

  ctx.inject(['webServer', 'connection'], (webCtx) => {
    const connection = webCtx.connection
    webCtx.effect(() =>
      webCtx.webServer.register({
        kind: 'exact',
        path: '/infinite-retry/rpc',
        handler: (req, res) => {
          void handleRoute(req, res, { store, connection })
        },
      }),
    )
  })
}

export const __test = {
  computeDelay,
  defaultState,
  normalizeState,
  sleep,
}

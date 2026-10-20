/**
 * Infinite Retry — Client half.
 *
 * One global preference row in Settings: when enabled, the Host retries every
 * failed model request forever (with backoff), including subagent requests.
 *
 * Author: Tokenav
 */
window.__ModuleLoader__.load({
  id: 'dsh-plugin-infinite-retry',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const EN = {
      navLabel: 'Infinite retry',
      title: 'Infinite retry',
      subtitle: 'Keep retrying failed model requests, for the main session and every subagent.',
      scopeBadge: 'Global',
      cardTitle: 'Retry model errors forever',
      cardDesc: 'Ignore the default retry cap. After a failure, wait with exponential backoff and try again; the wait is capped at 60 seconds.',
      switchLabel: 'Infinite retry',
      statusOn: 'Enabled — failures will be retried indefinitely',
      statusOff: 'Disabled — the default retry policy applies',
      loading: 'Loading…',
      unavailable: 'Cannot reach the plugin host service',
      retry: 'Retry',
      warningTitle: 'Use with care',
      warningBody: 'Permanent errors (authentication, invalid request, unavailable model) are retried forever too. A turn can wait for a long time and keep hitting the provider. Cancel the turn to stop.',
      subagentNote: 'Applies to the main session and every subagent.',
      backoffNote: 'Backoff: 1 s → 2 s → 4 s … capped at 60 s.',
      persistNote: 'Global setting; persisted across restarts.',
      applyNote: 'Changes are saved immediately and apply to the next failed request.',
      networkFailed: 'Cannot reach the Infinite Retry host service.',
      crash: 'This settings page failed to render.',
    }

    const ZH = {
      navLabel: '无限重试',
      title: '无限重试',
      subtitle: '模型请求失败时持续重试，对主会话和所有子代理生效。',
      scopeBadge: '全局',
      cardTitle: '模型错误无限重试',
      cardDesc: '忽略默认的最大重试次数。失败后按指数退避等待并再次请求，单次最长等待 60 秒。',
      switchLabel: '无限重试',
      statusOn: '已启用 —— 失败会一直重试',
      statusOff: '已关闭 —— 使用默认重试策略',
      loading: '读取中…',
      unavailable: '无法连接插件宿主服务',
      retry: '重试',
      warningTitle: '注意',
      warningBody: '永久性错误（鉴权失败、请求格式错误、模型不可用）也会被一直重试，可能让回合长时间等待并持续请求服务商。取消当前回合即可停止。',
      subagentNote: '对主会话和所有子代理生效。',
      backoffNote: '退避：1 秒 → 2 秒 → 4 秒 … 最长 60 秒。',
      persistNote: '全局设置，重启后保留。',
      applyNote: '修改会立即保存，并在下一次请求失败时生效。',
      networkFailed: '无法连接无限重试宿主服务。',
      crash: '这个设置页渲染失败了。',
    }

    const CSS = `
.rtu-root{box-sizing:border-box;--rtu-text:var(--dsw-alias-label-primary);--rtu-muted:var(--dsw-alias-label-secondary);--rtu-line:var(--dsw-alias-border-l1);--rtu-line-strong:var(--dsw-alias-border-l2);--rtu-surface:var(--dsw-alias-bg-layer-1);--rtu-surface-2:var(--dsw-alias-bg-layer-2);--rtu-accent:var(--dsw-alias-brand-primary);--rtu-error:var(--dsw-alias-state-error-primary);--rtu-warn:var(--dsw-alias-state-warn-primary);color:var(--rtu-text);font-family:inherit}
.rtu-root *,.rtu-root *::before,.rtu-root *::after{box-sizing:border-box}
.rtu-page{min-height:100%;background:transparent}
.rtu-inner{width:100%;max-width:820px;margin:0 auto;padding:28px 28px 64px}
.rtu-hero{display:flex;align-items:flex-start;gap:14px;margin-bottom:22px}
.rtu-mark{display:grid;place-items:center;flex:none;width:46px;height:46px;border:1px solid var(--rtu-line);border-radius:14px;background:var(--rtu-surface-2);color:var(--rtu-text)}
.rtu-hero-copy{min-width:0;flex:1}
.rtu-title{margin:0;font-size:22px;line-height:1.2;font-weight:650;letter-spacing:-.02em}
.rtu-subtitle{margin:6px 0 0;color:var(--rtu-muted);font-size:13px;line-height:1.55;max-width:62ch}
.rtu-badge{flex:none;display:inline-flex;align-items:center;height:24px;padding:0 9px;border:1px solid var(--rtu-line);border-radius:999px;background:var(--rtu-surface);color:var(--rtu-muted);font-size:10.5px;font-weight:600;letter-spacing:.03em}
.rtu-card{border:1px solid var(--rtu-line);background:var(--rtu-surface);border-radius:14px;padding:18px}
.rtu-card-row{display:flex;align-items:flex-start;gap:18px}
.rtu-card-copy{flex:1;min-width:0}
.rtu-h2{margin:0;font-size:14px;font-weight:650;letter-spacing:-.01em}
.rtu-desc{margin:6px 0 0;color:var(--rtu-muted);font-size:12px;line-height:1.6}
.rtu-status{display:flex;align-items:center;gap:7px;margin-top:14px;color:var(--rtu-muted);font-size:11.5px;line-height:1.5}
.rtu-dot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--rtu-muted)}
.rtu-dot.on{background:var(--rtu-text);box-shadow:0 0 0 3px color-mix(in srgb,var(--rtu-text) 12%,transparent)}
.rtu-switch{position:relative;flex:none;width:40px;height:22px;padding:0;border:1px solid var(--rtu-line-strong);border-radius:999px;background:transparent;cursor:pointer;transition:background .16s ease,border-color .16s ease}
.rtu-switch:disabled{opacity:.45;cursor:not-allowed}
.rtu-switch-thumb{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--rtu-muted);transition:transform .16s ease,background .16s ease}
.rtu-switch.on{background:var(--rtu-accent);border-color:transparent}
.rtu-switch.on .rtu-switch-thumb{transform:translateX(18px);background:var(--dsw-alias-bg-base)}
.rtu-switch:focus-visible{outline:2px solid color-mix(in srgb,var(--rtu-accent) 55%,transparent);outline-offset:2px}
.rtu-warning{margin-top:16px;padding:12px 14px;border:1px solid var(--rtu-line);border-left:3px solid var(--rtu-warn);border-radius:12px;background:var(--rtu-surface-2);color:var(--rtu-muted);font-size:11.5px;line-height:1.6}
.rtu-warning-title{display:block;font-size:12px;margin-bottom:3px;color:var(--rtu-text)}
.rtu-warning-body{margin:0}
.rtu-notes{display:flex;flex-direction:column;gap:7px;margin-top:16px}
.rtu-note{display:flex;align-items:flex-start;gap:8px;color:var(--rtu-muted);font-size:11.5px;line-height:1.55}
.rtu-note-dot{flex:none;width:4px;height:4px;margin-top:7px;border-radius:50%;background:var(--rtu-muted)}
.rtu-footnote{margin:16px 2px 0;color:var(--rtu-muted);font-size:10.5px;line-height:1.55}
.rtu-error{margin-top:14px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--rtu-error) 40%,var(--rtu-line));border-radius:10px;background:color-mix(in srgb,var(--rtu-error) 7%,transparent);color:var(--rtu-error);font-size:11.5px;line-height:1.55;overflow-wrap:anywhere}
.rtu-btn{display:inline-flex;align-items:center;justify-content:center;height:30px;margin-top:12px;padding:0 12px;border:1px solid var(--rtu-line);border-radius:8px;background:var(--rtu-surface-2);color:var(--rtu-text);font:inherit;font-size:12px;font-weight:550;cursor:pointer}
.rtu-btn:hover{border-color:var(--rtu-line-strong)}
.rtu-crash{padding:24px;color:var(--rtu-text)}
.rtu-crash pre{margin-top:10px;padding:10px;border:1px solid var(--rtu-line);border-radius:8px;background:var(--rtu-surface-2);white-space:pre-wrap;font-size:11px}
@media (max-width:600px){.rtu-inner{padding:20px 16px 48px}.rtu-hero{flex-wrap:wrap}.rtu-badge{margin-left:60px}.rtu-card-row{flex-direction:column}.rtu-switch{align-self:flex-start}}
`

    function createRpc(t) {
      return async function rpc(method, params) {
        let response
        try {
          response = await fetch('infinite-retry/rpc', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ method, params: params ?? {} }),
          })
        } catch {
          throw new Error(t('networkFailed'))
        }
        let payload = null
        try {
          payload = await response.json()
        } catch {
          // Fall through to the status-based error.
        }
        if (!response.ok || !payload || payload.ok !== true) {
          throw new Error(payload?.error?.message || `${response.status} ${response.statusText}`)
        }
        return payload.value
      }
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        const t = ctx.locale.bind('infinite-retry')
        for (const locale of ['en', 'en-US']) {
          ctx.effect(() => ctx.locale.register('infinite-retry', locale, EN))
        }
        for (const locale of ['zh', 'zh-CN', 'zh-Hans']) {
          ctx.effect(() => ctx.locale.register('infinite-retry', locale, ZH))
        }

        const rpc = createRpc(t)

        function useLocaleTick() {
          const [, force] = React.useState(0)
          React.useEffect(() => ctx.locale.subscribe(() => force((value) => value + 1)), [])
        }

        function Styles() {
          return h('style', { 'data-infinite-retry': '', dangerouslySetInnerHTML: { __html: CSS } })
        }

        function RetryGlyph({ size = 22 }) {
          return h(
            'svg',
            {
              width: size,
              height: size,
              viewBox: '0 0 24 24',
              fill: 'none',
              stroke: 'currentColor',
              strokeWidth: 1.8,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              'aria-hidden': 'true',
            },
            h('path', { d: 'M20 12a8 8 0 1 1-2.34-5.66' }),
            h('path', { d: 'M20 4v6h-6' }),
            h('path', { d: 'M12 8v4l2.5 1.5', opacity: 0.55 }),
          )
        }

        function Switch({ checked, onChange, disabled, label }) {
          return h(
            'button',
            {
              type: 'button',
              role: 'switch',
              'aria-checked': checked ? 'true' : 'false',
              'aria-label': label,
              title: label,
              disabled: Boolean(disabled),
              className: `rtu-switch${checked ? ' on' : ''}`,
              onClick: () => onChange(!checked),
            },
            h('span', { className: 'rtu-switch-thumb' }),
          )
        }

        class Boundary extends React.Component {
          constructor(props) {
            super(props)
            this.state = { error: null }
          }
          static getDerivedStateFromError(error) {
            return { error }
          }
          render() {
            if (this.state.error) {
              return h(
                'div',
                { className: 'rtu-root rtu-crash' },
                h('strong', null, t('crash')),
                h('pre', null, String(this.state.error?.message ?? this.state.error)),
              )
            }
            return this.props.children
          }
        }

        function Page() {
          useLocaleTick()
          const [data, setData] = React.useState(null)
          const [loading, setLoading] = React.useState(true)
          const [busy, setBusy] = React.useState(false)
          const [error, setError] = React.useState(null)

          async function load() {
            setLoading(true)
            setError(null)
            try {
              const value = await rpc('state')
              setData(value)
            } catch (value) {
              setError(value?.message ?? t('networkFailed'))
            } finally {
              setLoading(false)
            }
          }

          React.useEffect(() => {
            void load()
          }, [])

          async function toggle(next) {
            setBusy(true)
            setError(null)
            try {
              const value = await rpc('setEnabled', { enabled: next })
              setData(value)
            } catch (value) {
              setError(value?.message ?? t('networkFailed'))
            } finally {
              setBusy(false)
            }
          }

          const enabled = data?.enabled === true

          return h(
            'div',
            { className: 'rtu-root rtu-page' },
            h(Styles),
            h(
              'div',
              { className: 'rtu-inner' },
              h(
                'header',
                { className: 'rtu-hero' },
                h('span', { className: 'rtu-mark' }, h(RetryGlyph, { size: 22 })),
                h(
                  'div',
                  { className: 'rtu-hero-copy' },
                  h('h1', { className: 'rtu-title' }, t('title')),
                  h('p', { className: 'rtu-subtitle' }, t('subtitle')),
                ),
                h('span', { className: 'rtu-badge' }, t('scopeBadge')),
              ),
              h(
                'section',
                { className: 'rtu-card' },
                h(
                  'div',
                  { className: 'rtu-card-row' },
                  h(
                    'div',
                    { className: 'rtu-card-copy' },
                    h('h2', { className: 'rtu-h2' }, t('cardTitle')),
                    h('p', { className: 'rtu-desc' }, t('cardDesc')),
                  ),
                  h(Switch, {
                    checked: enabled,
                    disabled: busy || !data,
                    label: t('switchLabel'),
                    onChange: (value) => void toggle(value),
                  }),
                ),
                h(
                  'div',
                  { className: 'rtu-status' },
                  h('span', { className: `rtu-dot${enabled ? ' on' : ''}` }),
                  h('span', null, data ? (enabled ? t('statusOn') : t('statusOff')) : loading ? t('loading') : t('unavailable')),
                ),
                error ? h('div', { className: 'rtu-error' }, error) : null,
                !data && !loading
                  ? h('button', { type: 'button', className: 'rtu-btn', onClick: () => void load() }, t('retry'))
                  : null,
              ),
              h(
                'section',
                { className: 'rtu-warning' },
                h('strong', { className: 'rtu-warning-title' }, t('warningTitle')),
                h('p', { className: 'rtu-warning-body' }, t('warningBody')),
              ),
              h(
                'div',
                { className: 'rtu-notes' },
                h('div', { className: 'rtu-note' }, h('span', { className: 'rtu-note-dot' }), t('subagentNote')),
                h('div', { className: 'rtu-note' }, h('span', { className: 'rtu-note-dot' }), t('backoffNote')),
                h('div', { className: 'rtu-note' }, h('span', { className: 'rtu-note-dot' }), t('persistNote')),
              ),
              h('p', { className: 'rtu-footnote' }, t('applyNote')),
            ),
          )
        }

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'infinite-retry',
              order: 30,
              label: () => t('navLabel'),
            },
            () => h(Boundary, null, h(Page)),
          ),
        )
      },
    }
  },
})

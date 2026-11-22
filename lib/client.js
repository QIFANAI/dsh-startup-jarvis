window.__ModuleLoader__.load({ id: 'dsh-startup-jarvis', factory: function (require) {
  var module = { exports: {} }; var exports = module.exports;
  var React = require('react');
  var h = React.createElement;
  var BASE = '/api/dsh-jarvis';

  /* ── 设置页（0.3.8）：一页分组 + 草稿保存 + 保存后即时生效 ──────────────────
   * 分组：启动动画 / JARVIS 皮肤 / 侧栏与布局 / 诊断与关于
   * 契约（E2E 用）：根 [data-dj-settings]，组 [data-dj-group]，行 [data-dj-field]，
   *                控件 [data-dj-input]（按钮带 data-value），动作 [data-dj-action]，
   *                状态 [data-dj-status][data-kind]，脏标记根属性 data-dj-dirty。
   * 旧 theme（accent/scanlines/intensity）不再出现在 UI，仅保留为内部兼容字段。 */

  var STARTUP_KEYS = ['enabled', 'mode', 'allowSkip', 'reducedMotion', 'sound', 'volume', 'handoffAt'];
  var ACCENTS = [
    ['#ffc46b', '赤金'], ['#5fd7e6', '冷青'], ['#ff6b5a', '赤红'], ['#cfd8e3', '银白'], ['#b58cff', '紫罗兰']
  ];
  var TIERS = [
    ['accent', '极简', '只保留配色，去掉背景视频/毛玻璃/装饰'],
    ['full', '标准', '保留 HUD 装饰与静态海报，去掉视频与模糊'],
    ['glass', '全效', '视频背景 + 毛玻璃 + 完整 HUD（默认）']
  ];

  var CSS = [
    '.djset{max-width:760px;display:flex;flex-direction:column;gap:12px;font-size:13px;color:var(--dsw-alias-label-primary);--dj:var(--dsw-alias-state-business-primary,#e9a13b)}',
    '.djhead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
    '.djtitle{margin:0;font:600 16px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.06em}',
    '.djtitle b{color:var(--dj)}',
    '.djsub{margin:3px 0 0;color:var(--dsw-alias-label-tertiary);font-size:11.5px}',
    '.djhead-r{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.djver{font:500 10.5px ui-monospace,monospace;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);border:1px solid var(--dsw-alias-border-l2);border-radius:999px;padding:2px 9px;white-space:nowrap}',
    '.djgroup{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:11px 14px 6px;background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 82%,transparent)}',
    '.djgt{font:600 10px/1.4 ui-monospace,monospace;letter-spacing:.16em;color:var(--dsw-alias-label-tertiary);text-transform:uppercase;display:flex;align-items:center;gap:8px;margin:1px 0 4px}',
    '.djgt:after{content:"";flex:1;height:1px;background:linear-gradient(90deg,var(--dsw-alias-border-l2),transparent)}',
    '.djrow{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:7px 0;border-bottom:1px dashed var(--dsw-alias-border-l1,#ffffff14)}',
    '.djrow:last-child{border-bottom:0}',
    '.djrow .t{flex:1;min-width:0}',
    '.djrow .t b{display:block;font-weight:500;font-size:12.5px;line-height:1.4}',
    '.djrow .t small{display:block;margin-top:1px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.5}',
    '.djctl{display:flex;align-items:center;gap:8px;flex-shrink:0}',
    '.djseg{display:inline-flex;border:1px solid var(--dsw-alias-border-l2);border-radius:7px;overflow:hidden;background:var(--dsw-alias-bg-layer-3)}',
    '.djseg button{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);padding:4px 9px;font:500 11.5px inherit;cursor:pointer;white-space:nowrap}',
    '.djseg button[data-on="1"]{background:var(--dj);color:#171207}',
    '.djseg button:not([data-on="1"]):hover{color:var(--dsw-alias-label-primary)}',
    '.djsw{display:flex;gap:6px;align-items:center}',
    '.djswatch{width:22px;height:22px;border-radius:50%;border:1px solid var(--dsw-alias-border-l3,#ffffff26);cursor:pointer;padding:0;box-sizing:border-box}',
    '.djswatch[data-on="1"]{box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1),0 0 0 3.5px currentColor}',
    '.djswatch:hover{transform:scale(1.08)}',
    '.djrange{width:168px;accent-color:var(--dj);margin:0}',
    '.djrange:disabled{opacity:.42}',
    '.djread{font:500 10.5px ui-monospace,monospace;color:var(--dsw-alias-label-tertiary);min-width:42px;text-align:right;white-space:nowrap}',
    '.djcheck{width:34px;height:19px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);position:relative;cursor:pointer;flex-shrink:0;padding:0}',
    '.djcheck:after{content:"";position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:var(--dsw-alias-label-tertiary);transition:transform .16s ease,background .16s ease}',
    '.djcheck[data-on="1"]{background:var(--dj);border-color:var(--dj)}',
    '.djcheck[data-on="1"]:after{transform:translateX(15px);background:#171207}',
    '.djtiers{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:2px 0 8px}',
    '.djtier{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px 10px;cursor:pointer;background:var(--dsw-alias-bg-layer-2);display:flex;flex-direction:column;gap:2px;text-align:left;color:inherit;font:inherit;min-height:64px}',
    '.djtier[data-on="1"]{border-color:var(--dj);box-shadow:inset 0 0 0 1px var(--dj)}',
    '.djtier b{font-size:12px;font-weight:600}',
    '.djtier small{font-size:10.5px;line-height:1.45;color:var(--dsw-alias-label-tertiary)}',
    '.djkv{display:grid;grid-template-columns:92px 1fr;gap:5px 12px;font:500 11.5px ui-monospace,monospace;padding:2px 0 8px}',
    '.djkv span:nth-child(odd){color:var(--dsw-alias-label-tertiary)}',
    '.djkv span:nth-child(even){word-break:break-all}',
    '.djfoot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 0 7px;position:sticky;bottom:0;background:var(--dsw-alias-bg-layer-1);box-shadow:0 -10px 22px color-mix(in srgb,var(--dsw-alias-bg-layer-1) 88%,transparent),inset 0 1px 0 var(--dsw-alias-border-l2);z-index:3}',
    '.djbtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:7px;padding:5px 13px;font:500 12px inherit;cursor:pointer;white-space:nowrap}',
    '.djbtn:hover:not(:disabled){border-color:var(--dj);color:var(--dj)}',
    '.djbtn.primary{background:var(--dj);border-color:var(--dj);color:#171207}',
    '.djbtn.primary:hover:not(:disabled){color:#171207;filter:brightness(1.06)}',
    '.djbtn:disabled{opacity:.5;cursor:default}',
    '.djmsg{font:500 11px ui-monospace,monospace;color:var(--dsw-alias-label-tertiary);min-height:15px;flex:1;min-width:150px}',
    '.djmsg.ok{color:var(--dsw-alias-state-success-primary,#61c47a)}',
    '.djmsg.err{color:var(--dsw-alias-state-error-primary,#e0655a)}',
    '.djdirty{font:600 10px ui-monospace,monospace;letter-spacing:.08em;color:var(--dj);border:1px solid var(--dj);border-radius:999px;padding:1px 8px}',
    '.djempty{padding:18px 0;color:var(--dsw-alias-label-tertiary);font-size:12px}'
  ].join('');
  if (typeof document !== 'undefined' && !document.getElementById('djset-style')) {
    var st0 = document.createElement('style'); st0.id = 'djset-style'; st0.textContent = CSS;
    (document.head || document.documentElement).appendChild(st0);
  }

  function beacon(msg) { try { fetch(BASE + '/beacon?msg=' + encodeURIComponent(msg), { cache: 'no-store' }) } catch (e) {} }
  function getCfg() { return fetch(BASE + '/config', { cache: 'no-store' }).then(function (r) { return r.json() }) }
  function postCfg(body) {
    return fetch(BASE + '/config', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json() })
  }
  function clone(v) { try { return JSON.parse(JSON.stringify(v)) } catch (e) { return v } }
  function num(v, d) { var n = Number(v); return isFinite(n) ? n : d }
  function round1(v) { return Math.round(num(v, 0) * 10) / 10 }
  function applySkin(skin) {
    try {
      var api = window.__DSH_JARVIS_SKIN__;
      if (api && typeof api.apply === 'function') api.apply(skin);
    } catch (e) { beacon('apply-skin-failed:' + (e && e.message)) }
  }
  function readLayout() {
    var out = { width: 0, collapsed: false, hasSidebar: false };
    try {
      var side = document.querySelector('[class*="sidebarCol" i]');
      if (side) { out.width = Math.round(side.getBoundingClientRect().width); out.hasSidebar = true; }
      out.collapsed = !!document.querySelector('[data-sidebar-collapsed]');
    } catch (e) { /* noop */ }
    return out;
  }
  function snapshot(cfg) {
    var out = {};
    for (var i = 0; i < STARTUP_KEYS.length; i += 1) {
      var k = STARTUP_KEYS[i];
      out[k] = cfg ? cfg[k] : undefined;
    }
    out.skin = cfg && cfg.skin ? cfg.skin : {};
    return out;
  }
  function isDirty(draft, saved) {
    if (!draft || !saved) return false;
    return JSON.stringify(snapshot(draft)) !== JSON.stringify(snapshot(saved));
  }

  /* ── 小部件 ─────────────────────────────────────────────────────────── */
  function Row(props) {
    return h('div', { className: 'djrow', 'data-dj-field': props.field || undefined },
      h('div', { className: 't' }, h('b', null, props.title), props.hint ? h('small', null, props.hint) : null),
      h('div', { className: 'djctl', 'data-dj-input': props.field || undefined }, props.children))
  }
  function Switch(props) {
    return h('button', {
      type: 'button', className: 'djcheck', role: 'switch',
      'aria-checked': props.value ? 'true' : 'false',
      'data-on': props.value ? '1' : '0',
      disabled: !!props.disabled,
      onClick: function () { if (!props.disabled) props.onChange(!props.value) }
    })
  }
  function Seg(props) {
    return h('div', { className: 'djseg' }, props.options.map(function (o) {
      return h('button', {
        key: o[0], type: 'button', 'data-value': o[0], 'data-on': props.value === o[0] ? '1' : '0',
        disabled: !!props.disabled,
        onClick: function () { if (!props.disabled) props.onChange(o[0]) }
      }, o[1])
    }))
  }
  function Range(props) {
    var v = num(props.value, props.min)
    return h(React.Fragment, null,
      h('input', {
        className: 'djrange', type: 'range', min: props.min, max: props.max, step: props.step || 1,
        value: v, disabled: !!props.disabled,
        onChange: function (ev) { props.onChange(Number(ev.target.value)) }
      }),
      h('span', { className: 'djread' }, props.display == null ? String(v) : props.display))
  }
  function TierGrid(props) {
    return h('div', { className: 'djtiers' }, TIERS.map(function (t) {
      return h('button', {
        key: t[0], type: 'button', className: 'djtier', 'data-value': t[0],
        'data-on': props.value === t[0] ? '1' : '0',
        onClick: function () { props.onChange(t[0]) }
      }, h('b', null, t[1]), h('small', null, t[2]))
    }))
  }
  function Group(props) {
    return h('div', { className: 'djgroup', 'data-dj-group': props.id },
      h('div', { className: 'djgt' }, props.title),
      props.children)
  }

  /* ── 设置面板 ───────────────────────────────────────────────────────── */
  function Panel() {
    var state = React.useState({
      saved: null, draft: null, defaults: null, meta: null,
      busy: false, notice: '', error: '', layout: readLayout()
    });
    var s = state[0]; var setState = state[1];
    function patch(next) { setState(function (cur) { return Object.assign({}, cur, next) }) }

    function load(silent) {
      patch({ error: '', busy: true })
      getCfg().then(function (r) {
        if (!r || !r.config) throw new Error('读取配置失败')
        patch({
          saved: clone(r.config), draft: clone(r.config), defaults: clone(r.defaults || {}),
          meta: { version: r.version, file: r.file, facts: r.facts || {}, defaults: r.defaults || {} },
          busy: false, notice: silent ? '' : '已重新读取配置', error: ''
        })
        applySkin(r.config.skin)
      }).catch(function (x) {
        patch({ busy: false, error: '读取配置失败：' + String((x && x.message) || x) })
      })
    }

    React.useEffect(function () {
      load(true)
      var timer = setInterval(function () { patch({ layout: readLayout() }) }, 1500)
      return function () { clearInterval(timer) }
    }, [])

    function setTop(key, value) {
      var d = clone(s.draft) || {}
      d[key] = value
      patch({ draft: d, notice: '', error: '' })
    }
    function setSkin(key, value) {
      var d = clone(s.draft) || {}
      d.skin = Object.assign({}, d.skin || {}, {})
      d.skin[key] = value
      patch({ draft: d, notice: '', error: '' })
    }

    function doSave() {
      if (!s.draft || s.busy) return
      patch({ busy: true, notice: '', error: '' })
      var payload = {
        enabled: s.draft.enabled, mode: s.draft.mode, allowSkip: s.draft.allowSkip,
        reducedMotion: s.draft.reducedMotion, sound: s.draft.sound,
        volume: s.draft.volume, handoffAt: s.draft.handoffAt, skin: s.draft.skin
      }
      postCfg(payload).then(function (r) {
        if (!r || r.ok !== true || !r.config) throw new Error((r && r.error) || '保存失败')
        patch({ saved: clone(r.config), draft: clone(r.config), busy: false, notice: '已保存：皮肤即时生效；启动动画点「重播」按新配置预览', error: '' })
        applySkin(r.config.skin)
      }).catch(function (x) {
        patch({ busy: false, error: '保存失败：' + String((x && x.message) || x) })
      })
    }

    function doReset() {
      if (s.busy) return
      patch({ busy: true, notice: '', error: '' })
      postCfg({ action: 'reset' }).then(function (r) {
        if (!r || r.ok !== true || !r.config) throw new Error((r && r.error) || '恢复默认失败')
        patch({ saved: clone(r.config), draft: clone(r.config), busy: false, notice: '已恢复默认并即时生效', error: '' })
        applySkin(r.config.skin)
      }).catch(function (x) {
        patch({ busy: false, error: '恢复默认失败：' + String((x && x.message) || x) })
      })
    }

    function doDiscard() {
      if (s.busy) return
      load(false)
    }

    function doReplay() {
      if (s.busy) return
      if (!s.saved) return
      if (isDirty(s.draft, s.saved)) { patch({ error: '有未保存修改：先「保存」再点「重播」', notice: '' }); return }
      if (s.saved.enabled === false) { patch({ error: '启动动画已关闭：打开「启用启动动画」并保存后再重播', notice: '' }); return }
      // 启动层与设置页可能来自不同代版本（例如刚装完新包、宿主 boot 注入还没重启刷新）：
      // 旧 splash 的 replay 不会复位 handoffStarted，硬播会把遮罩卡在界面上，这里直接拒绝。
      var api = null
      try { api = window.__DSH_JARVIS_API__ } catch (e) { api = null }
      if (!api || typeof api.replay !== 'function' || typeof api.state !== 'function') {
        patch({ error: '启动层仍是旧版本：请完全退出 DSH 重开后再点「重播」', notice: '' })
        return
      }
      var ok = false
      try { ok = !!api.replay(s.saved) } catch (e) { ok = false }
      if (ok) patch({ notice: '已重播启动动画（按保存的配置，约 ' + round1(num(s.saved.handoffAt, 30.2)) + 's 处交接）', error: '' })
      else patch({ error: '重播失败：启动层未就绪（正在播放时不能重播）', notice: '' })
    }

    function toggleSidebar() {
      try {
        var b = document.querySelector('[data-sidebar-toggle]')
        if (b && typeof b.click === 'function') b.click()
        setTimeout(function () { patch({ layout: readLayout() }) }, 700)
      } catch (e) { /* noop */ }
    }

    var d = s.draft
    var meta = s.meta || {}
    var head = h('div', { className: 'djhead' },
      h('div', null,
        h('h3', { className: 'djtitle' }, 'JARVIS ', h('b', null, '// CONTROL')),
        h('p', { className: 'djsub' }, '启动动画 · UI 皮肤 · 侧栏与诊断（保存后皮肤即时生效）')),
      h('div', { className: 'djhead-r' },
        isDirty(s.draft, s.saved) ? h('span', { className: 'djdirty' }, '未保存') : null,
        h('span', { className: 'djver' }, 'v' + String(meta.version || '')),
        h('button', { className: 'djbtn', type: 'button', 'data-dj-action': 'replay', disabled: s.busy, onClick: doReplay }, '重播启动动画')))

    if (!d) {
      return h('div', { className: 'djset', 'data-dj-settings': '1', 'data-dj-dirty': '0' },
        head,
        h('div', { className: 'djempty' }, s.error ? s.error : '读取配置中…'),
        s.error ? h('button', { className: 'djbtn', type: 'button', onClick: function () { load(true) } }, '重试') : null)
    }

    var skin = d.skin || {}
    var facts = meta.facts || {}
    var layout = s.layout || { width: 0, collapsed: false }
    var tier = ['accent', 'full', 'glass'].indexOf(skin.level) >= 0 ? skin.level : 'glass'
    var motion = ['full', 'reduced', 'off'].indexOf(skin.motion) >= 0 ? skin.motion : 'full'
    var accentList = ACCENTS.slice()
    var curAccent = String(skin.accent || '#ffc46b')
    var hasCurAccent = accentList.some(function (a) { return a[0].toLowerCase() === curAccent.toLowerCase() })
    if (!hasCurAccent) accentList.push([curAccent, '当前'])

    var startupBody = [
      h(Row, { key: 'enabled', field: 'enabled', title: '启用启动动画', hint: '关闭后 DSH 直接进入工作区，遮罩不会创建' },
        h(Switch, { value: d.enabled !== false, onChange: function (v) { setTop('enabled', v) } })),
      h(Row, { key: 'mode', field: 'mode', title: '播放时机', hint: '每个浏览器会话一次 / 每天一次 / 每次打开都播放' },
        h(Seg, { value: d.mode || 'session', options: [['session', '每会话'], ['daily', '每天'], ['always', '每次']], onChange: function (v) { setTop('mode', v) } })),
      h(Row, { key: 'sound', field: 'sound', title: '播放启动音', hint: '启动片原声；自动播放被策略拦截时先静音，点一下开声' },
        h(Switch, { value: d.sound !== false, onChange: function (v) { setTop('sound', v) } })),
      h(Row, { key: 'volume', field: 'volume', title: '音量', hint: '启动动画原声音轨，0 为静音' },
        h(Range, { value: num(d.volume, 65), min: 0, max: 100, step: 1, display: num(d.volume, 65) + '%', disabled: d.sound === false, onChange: function (v) { setTop('volume', v) } })),
      h(Row, { key: 'handoffAt', field: 'handoffAt', title: '交接时点', hint: '30.2s = 片尾交接；提前会让画面未播完就交接（5–30.2s）' },
        h(Range, { value: round1(num(d.handoffAt, 30.2)), min: 5, max: 30.2, step: 0.1, display: round1(num(d.handoffAt, 30.2)) + 's', onChange: function (v) { setTop('handoffAt', v) } })),
      h(Row, { key: 'allowSkip', field: 'allowSkip', title: '允许跳过', hint: 'Esc 或点击画面立即进入工作区' },
        h(Switch, { value: d.allowSkip !== false, onChange: function (v) { setTop('allowSkip', v) } })),
      h(Row, { key: 'reducedMotion', field: 'reducedMotion', title: '减弱动态', hint: '跳过金红扫描与暖白闪，300ms 直接淡出（无障碍）' },
        h(Switch, { value: d.reducedMotion === true, onChange: function (v) { setTop('reducedMotion', v) } }))
    ]

    var skinBody = [
      h(Row, { key: 'skin.enabled', field: 'skin.enabled', title: '启用 JARVIS 皮肤', hint: '关闭 = 保留启动动画、界面回宿主原样（立即生效）' },
        h(Switch, { value: skin.enabled !== false, onChange: function (v) { setSkin('enabled', v) } })),
      h('div', { className: 'djtiers', 'data-dj-input': 'skin.level' }, TIERS.map(function (t) {
        return h('button', {
          key: t[0], type: 'button', className: 'djtier', 'data-value': t[0], 'data-on': tier === t[0] ? '1' : '0',
          disabled: skin.enabled === false,
          onClick: function () { setSkin('level', t[0]) }
        }, h('b', null, t[1]), h('small', null, t[2]))
      })),
      h(Row, { key: 'skin.preset', field: 'skin.preset', title: '主题预设', hint: '装饰色系：赤金 HUD / 冷青终端 / 暗夜单色（主色仍由下方「主色」控制）' },
        h(Seg, { value: skin.preset || 'mark7', disabled: skin.enabled === false, options: [['mark7', '赤金'], ['hud', '冷青'], ['noir', '单色']], onChange: function (v) { setSkin('preset', v) } })),
      h(Row, { key: 'skin.background', field: 'skin.background', title: '背景模式', hint: '清晰 HUD（原片）/ 氛围（预模糊）/ 静态海报 / 关闭' },
        h(Seg, { value: skin.background || 'hud', disabled: skin.enabled === false, options: [['hud', '清晰'], ['ambient', '氛围'], ['poster', '海报'], ['off', '关闭']], onChange: function (v) { setSkin('background', v) } })),
      h(Row, { key: 'skin.bgOpacity', field: 'skin.bgOpacity', title: '背景不透明度', hint: '视频背景的可见度，越大越「活」；0 = 只剩海报' },
        h(Range, { value: num(skin.bgOpacity, 86), min: 0, max: 100, step: 1, display: num(skin.bgOpacity, 86) + '%', disabled: skin.enabled === false, onChange: function (v) { setSkin('bgOpacity', v) } })),
      h(Row, { key: 'skin.brightness', field: 'skin.brightness', title: '背景亮度', hint: '背景层的整体亮度（20–160%）' },
        h(Range, { value: num(skin.brightness, 70), min: 20, max: 160, step: 1, display: num(skin.brightness, 70) + '%', disabled: skin.enabled === false, onChange: function (v) { setSkin('brightness', v) } })),
      h(Row, { key: 'skin.motion', field: 'skin.motion', title: '动效档位', hint: '全效 / 减弱（静态金边）/ 关闭（全停）' },
        h(Seg, { value: motion, disabled: skin.enabled === false, options: [['full', '全效'], ['reduced', '减弱'], ['off', '关闭']], onChange: function (v) { setSkin('motion', v) } })),
      h(Row, { key: 'skin.accent', field: 'skin.accent', title: '主色', hint: 'HUD 边环、焦点与强调色；只改配色不改布局' },
        h('div', { className: 'djsw', 'data-dj-input': 'skin.accent' }, accentList.map(function (a) {
          return h('button', {
            key: a[0], type: 'button', className: 'djswatch', title: a[1], 'data-value': a[0],
            'data-on': curAccent.toLowerCase() === a[0].toLowerCase() ? '1' : '0',
            style: { background: a[0], color: a[0] }, disabled: skin.enabled === false,
            onClick: function () { setSkin('accent', a[0]) }
          })
        }))),
      h(Row, { key: 'skin.grain', field: 'skin.grain', title: '颗粒', hint: '背景噪点强度，0 为关闭' },
        h(Range, { value: num(skin.grain, 28), min: 0, max: 100, step: 1, display: num(skin.grain, 28), disabled: skin.enabled === false, onChange: function (v) { setSkin('grain', v) } })),
      h(Row, { key: 'skin.scanlines', field: 'skin.scanlines', title: '扫描线', hint: 'CRT 扫描线强度，0 为关闭' },
        h(Range, { value: num(skin.scanlines, 35), min: 0, max: 100, step: 1, display: num(skin.scanlines, 35), disabled: skin.enabled === false, onChange: function (v) { setSkin('scanlines', v) } })),
      h(Row, { key: 'skin.parallax', field: 'skin.parallax', title: '背景视差', hint: '鼠标轻微位移背景（仅动效=全效时启用）' },
        h(Switch, { value: skin.parallax !== false, disabled: skin.enabled === false, onChange: function (v) { setSkin('parallax', v) } })),
      h(Row, { key: 'skin.focusDim', field: 'skin.focusDim', title: '焦点压暗', hint: '输入时把背景再压暗一档，保证阅读对比度' },
        h(Switch, { value: skin.focusDim !== false, disabled: skin.enabled === false, onChange: function (v) { setSkin('focusDim', v) } })),
      h(Row, { key: 'skin.hudCorners', field: 'skin.hudCorners', title: 'HUD 角标', hint: '四角金色枢轴与状态铭牌' },
        h(Switch, { value: skin.hudCorners !== false, disabled: skin.enabled === false, onChange: function (v) { setSkin('hudCorners', v) } })),
      h(Row, { key: 'skin.lightMode', field: 'skin.lightMode', title: '浅色宿主', hint: '昼面 = 跟随浅色主题给白色玻璃；暗面 = 始终维持 JARVIS 暗色' },
        h(Seg, { value: skin.lightMode || 'porcelain', disabled: skin.enabled === false, options: [['porcelain', '昼面'], ['off', '暗面']], onChange: function (v) { setSkin('lightMode', v) } }))
    ]

    var layoutBody = [
      h(Row, { key: 'layout.width', field: 'layout.width', title: '当前侧栏宽度', hint: '宽度完全交给宿主拖拽（264–420px）；皮肤跟随真实列宽，MK VII 只在 ≥330px 显示' },
        h('div', { className: 'djctl' },
          h('span', { className: 'djread', style: { minWidth: '86px' } }, (layout.hasSidebar ? layout.width + 'px' : '—') + (layout.collapsed ? ' · 收起' : ' · 展开')),
          h('button', { className: 'djbtn', type: 'button', 'data-dj-action': 'toggle-sidebar', onClick: toggleSidebar }, layout.collapsed ? '展开侧栏' : '收起侧栏')))
    ]

    var aboutBody = [
      h('div', { className: 'djkv' },
        h('span', null, '插件版本'), h('span', null, 'dsh-startup-jarvis v' + String(meta.version || '')),
        h('span', null, '配置文件'), h('span', null, String(meta.file || '~/.dsh/dsh-startup-jarvis.json')),
        h('span', null, '日志文件'), h('span', null, '~/.dsh/dsh-startup-jarvis.log'),
        h('span', null, '启动片'), h('span', null, 'jarvis-boot.mp4 · 1920×1080 · 30.2s · AAC'),
        h('span', null, '背景层'), h('span', null, String(skin.background || 'hud') + ' · ' + String(skin.motion || 'full') + ' · ' + tier),
        h('span', null, '宿主画像'), h('span', null, String(facts.profile || 'desktop') + ' / ' + String(facts.model || 'deepseek-flash') + ' / bundles ' + String(facts.bundles == null ? '?' : facts.bundles) + ' / skills ' + String(facts.skills == null ? '?' : facts.skills)),
        h('span', null, '启动层'), h('span', null, 'window.__DSH_JARVIS_API__.replay() 可重播；皮肤 API window.__DSH_JARVIS_SKIN__.apply()')),
      h('div', { className: 'djctl', style: { padding: '2px 0 8px' } },
        h('button', { className: 'djbtn', type: 'button', 'data-dj-action': 'reload', disabled: s.busy, onClick: function () { load(false) } }, '重新读取'),
        h('button', { className: 'djbtn', type: 'button', 'data-dj-action': 'discard2', disabled: s.busy || !isDirty(s.draft, s.saved), onClick: doDiscard }, '放弃修改'))
    ]

    var dirty = isDirty(s.draft, s.saved)

    return h('div', { className: 'djset', 'data-dj-settings': '1', 'data-dj-dirty': dirty ? '1' : '0' },
      head,
      h(Group, { id: 'startup', title: '启动动画' }, startupBody),
      h(Group, { id: 'skin', title: 'JARVIS 皮肤' }, skinBody),
      h(Group, { id: 'layout', title: '侧栏与布局' }, layoutBody),
      h(Group, { id: 'about', title: '诊断与关于' }, aboutBody),
      h('div', { className: 'djfoot', 'data-dj-foot': '1' },
        h('button', { className: 'djbtn primary', type: 'button', 'data-dj-action': 'save', disabled: s.busy || !dirty, onClick: doSave }, s.busy ? '处理中…' : '保存'),
        h('button', { className: 'djbtn', type: 'button', 'data-dj-action': 'reset', disabled: s.busy, onClick: doReset }, '恢复默认'),
        h('button', { className: 'djbtn', type: 'button', 'data-dj-action': 'discard', disabled: s.busy || !dirty, onClick: doDiscard }, '放弃修改'),
        h('span', { className: 'djmsg ' + (s.error ? 'err' : (s.notice ? 'ok' : '')), 'data-dj-status': '1', 'data-kind': s.error ? 'err' : (s.notice ? 'ok' : 'idle') }, s.error || s.notice || (dirty ? '有未保存修改' : '所有改动已保存')))
    )
  }

  /* ── 工具调用卡 ─────────────────────────────────────────────────────── */
  function ToolCard(props) {
    try {
      var phase = props && props.phase
      var block = (props && props.block) || {}
      var name = (props && props.toolName) || block.name || 'tool'
      var raw = phase === 'result' ? ((block.call && block.call.argsRaw) || '') : (block.argsRaw || '')
      var parsed = null
      try { parsed = JSON.parse(raw || '{}') } catch (e) { parsed = null }
      var summary = ''
      if (parsed) summary = parsed.command || parsed.cmd || parsed.script || parsed.path || parsed.file_path || parsed.pattern || ''
      if (!summary) summary = String(raw || '').replace(/\s+/g, ' ').slice(0, 160)
      var output = ''
      if (phase === 'result' && Array.isArray(block.content)) {
        output = block.content.map(function (b) { return b && typeof b.text === 'string' ? b.text : '' }).filter(Boolean).join('\n')
      }
      var headerSummary = summary ? (name === 'pwsh' ? '运行命令' : summary) : ''
      var state = phase === 'result' ? (block.isError ? 'error' : 'done') : (phase === 'start' ? 'running' : 'preparing')
      var stateLabel = { done: 'DONE', error: 'ERROR', running: 'RUNNING', preparing: 'PREPARING' }[state]
      return h('div', { className: 'dj-tcard', 'data-dj-state': state },
        h('div', { className: 'dj-tcard-head' },
          h('span', { className: 'dj-tcard-ic' }, '>_'),
          h('b', { className: 'dj-tcard-name' }, String(name)),
          h('span', { className: 'dj-tcard-sum' }, headerSummary.slice(0, 140)),
          h('span', { className: 'dj-tcard-st' }, stateLabel)),
        summary ? h('div', { className: 'dj-tcard-body' }, h('code', { className: 'dj-tcard-cmd' }, summary.slice(0, 500))) : null,
        output ? h('pre', { className: 'dj-tcard-out' }, output.slice(0, 6000)) : null)
    } catch (e) {
      return h('div', { className: 'dj-tcard', 'data-dj-state': 'error' }, 'tool call')
    }
  }

  /* ── hero 03 查看插件 ────────────────────────────────────────────────── */
  function openPlugins() {
    try {
      var scopes = [document.querySelector('[class*="sidebarCol" i]'), document]
      for (var s = 0; s < scopes.length; s++) {
        if (!scopes[s]) continue
        var list = scopes[s].querySelectorAll('button, [role="treeitem"], [role="button"]')
        for (var i = 0; i < list.length; i++) {
          var b = list[i]
          if (String(b.innerText || '').trim() === '插件') { b.click(); return }
        }
      }
    } catch (e) { /* noop */ }
  }

  function PluginsChip() {
    return h('button', {
      type: 'button',
      className: 'dj-hero-plugins',
      title: '查看插件',
      onClick: openPlugins
    },
    h('span', { className: 'dj-hero-plugins-num' }, '03'),
    h('svg', { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, 'aria-hidden': 'true' },
      h('path', { d: 'M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0V7Z' }),
      h('path', { d: 'M12 16v5' })),
    h('span', { className: 'dj-hero-plugins-label' }, '查看插件'),
    h('span', { className: 'dj-hero-plugins-chev' }, '›'))
  }

  function apply(ctx) {
    try {
      ctx.effect(function () { return ctx.slots.inject('settings.section', function () { return ctx.slots.register({ name: 'settings.section', id: 'jarvis', order: 16, label: function () { return 'JARVIS 控制台' }, children: {} }, Panel) }) })
      try {
        ctx.effect(function () {
          return ctx.slots.inject('tool.call.toolview', function () {
            return ctx.slots.register({ name: 'tool.call.toolview', key: 'pwsh' }, ToolCard)
          })
        })
        beacon('toolview-registered')
      } catch (e3) { beacon('toolview-failed:' + (e3 && e3.message)) }
      try {
        ctx.effect(function () {
          return ctx.slots.inject('conversation.hero.options', function () {
            return ctx.slots.register({ name: 'conversation.hero.options', id: 'jarvis-plugins', order: 20 }, PluginsChip)
          })
        })
        beacon('hero-plugins-registered')
      } catch (e4) { beacon('hero-plugins-failed:' + (e4 && e4.message)) }
      beacon('settings-registered')
    } catch (e2) { beacon('settings-failed:' + (e2 && e2.message)) }
  }
  var inject = ['slots'];
  exports.apply = apply; exports.inject = inject;
  return module.exports;
}});

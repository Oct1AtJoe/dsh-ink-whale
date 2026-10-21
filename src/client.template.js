/*
 * dsh-ink-whale — 浏览器半（模板）。
 *
 * 构建脚本把两个占位注释分别换成笔画 / 鲸鱼 / 字标数据和 src/engine.js，
 * 再输出 client.js。这里只做三件事：
 *   1. 在 shell.overlay 里播放一次开屏（每页一次，可跳过）；
 *   2. 在 设置 → 插件 里提供「开屏」页：字体、文字、深浅、总开关；
 *   3. 把配置经 ctx.configForms 写回 Host（设置服务不可用时退回 localStorage）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-ink-whale',
  factory(require) {
    'use strict';
    var React = require('react');
    var h = React.createElement;

    /* @@DATA@@ */

    /* @@ENGINE@@ */

    var FONT_KEYS = Object.keys(DSHIW_FONTS);
    var ENTRY_ID_CANDIDATES = ['ink-whale', 'include:ink-whale'];
    var STORAGE_KEY = 'dsh-ink-whale:config';
    var SPLASH_ORDER = 200;
    var SETTINGS_ORDER = 50;
    var HOLD_SECONDS = 1.8;

    /* 设置页底部的 Star 入口；跟着 package.json 的 repository 走。 */
    var REPO_URL = 'https://github.com/w-j-y-wjy/dsh-ink-whale';

    var DEFAULT_CONFIG = {
      enabled: true,
      font: FONT_KEYS[0],
      name: 'DeepSeek',
      greeting: '{name}',
      caption: '探索未至之境',
      theme: 'auto',
      skipWhale: false,
      speed: 1
    };

    var FONT_LABEL = {};
    for (var fi = 0; fi < FONT_KEYS.length; fi++) FONT_LABEL[FONT_KEYS[fi]] = DSHIW_FONTS[FONT_KEYS[fi]].n;

    var THEME_OPTIONS = ['auto', 'dark', 'light'];
    var THEME_LABEL = { auto: '跟随 DSH', dark: '深色', light: '浅色' };

    var SPEED_OPTIONS = [0.5, 1, 1.5, 2, 3];

    /* ---------------- 配置校验 ---------------- */
    function textOr(value, fallback, max) {
      if (typeof value !== 'string') return fallback;
      var v = value.replace(/\s+/g, ' ').trim();
      if (v.length > max) v = v.slice(0, max);
      return v;
    }
    function coerceConfig(raw) {
      var src = (raw && typeof raw === 'object') ? raw : {};
      return {
        enabled: src.enabled !== false,
        font: DSHIW_FONTS[src.font] ? src.font : DEFAULT_CONFIG.font,
        name: textOr(src.name, DEFAULT_CONFIG.name, 48),
        greeting: textOr(src.greeting, DEFAULT_CONFIG.greeting, 80),
        caption: textOr(src.caption, DEFAULT_CONFIG.caption, 60),
        theme: THEME_OPTIONS.indexOf(src.theme) >= 0 ? src.theme : 'auto',
        skipWhale: src.skipWhale === true,
        speed: SPEED_OPTIONS.indexOf(src.speed) >= 0 ? src.speed : 1
      };
    }

    /** 把「称呼 + 问候语模板」变成真正要写的那一行字。 */
    function resolveWrittenText(name, greeting) {
      var n = String(name == null ? '' : name).replace(/\s+/g, ' ').trim();
      var t = String(greeting == null ? '' : greeting).replace(/\s+/g, ' ').trim();
      var out;
      if (!t) out = n;
      else if (t.indexOf('{name}') >= 0) out = t.split('{name}').join(n);
      else out = n && t === '{name}' ? n : t;
      out = out.replace(/\s+/g, ' ').trim();
      return out || DEFAULT_CONFIG.name;
    }

    /* ---------------- 最小外部 store ---------------- */
    function createStore(initial) {
      var value = initial;
      var listeners = [];
      return {
        get: function () { return value; },
        set: function (next) {
          if (Object.is(next, value)) return;
          value = next;
          var copy = listeners.slice();
          for (var i = 0; i < copy.length; i++) copy[i]();
        },
        subscribe: function (listener) {
          if (listeners.indexOf(listener) < 0) listeners.push(listener);
          return function () {
            var i = listeners.indexOf(listener);
            if (i >= 0) listeners.splice(i, 1);
          };
        }
      };
    }

    /* ---------------- 本机缓存 ---------------- */
    function readCache() {
      try {
        var raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return undefined;
        return coerceConfig(JSON.parse(raw));
      } catch (e) {
        return undefined;
      }
    }
    function writeCache(value) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
      } catch (e) { /* 隐私模式 / 存储被禁用 */ }
    }

    /* Host 半往 index.html 里注入的首屏遮罩：主界面挂上、开屏还没画出来的空档
       靠它盖住。开屏第一帧画完（或确认不播）就摘掉，避免主界面闪一下。 */
    function dropBootCover() {
      try {
        var api = window.__dshiwBootCover;
        if (api && typeof api.drop === 'function') api.drop();
      } catch (e) { /* 遮罩脚本没注入时忽略 */ }
    }

    /* ---------------- 主题 ---------------- */
    function detectTheme() {
      try {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
      } catch (e) { /* ignore */ }
      return 'light';
    }
    var appThemeStore = createStore(detectTheme());
    function resolveTheme(pref) {
      if (pref === 'dark' || pref === 'light') return pref;
      return appThemeStore.get() || detectTheme();
    }

    /* ---------------- 配置状态 ---------------- */
    var settingsStore = createStore(readCache());
    var sourceStore = createStore('local');
    var writeStatusStore = createStore('');
    var boundNs = null;
    var activeForm = null;
    var unbindForm = null;
    var unbindDescribe = null;

    function resolveNamespace(describe) {
      var view;
      try {
        view = describe.getSnapshot().view;
      } catch (e) {
        view = undefined;
      }
      var namespaces = (view && view.namespaces) || [];
      var i, j;
      for (i = 0; i < ENTRY_ID_CANDIDATES.length; i++) {
        for (j = 0; j < namespaces.length; j++) {
          if (namespaces[j].ns === ENTRY_ID_CANDIDATES[i]) return namespaces[j].ns;
        }
      }
      for (j = 0; j < namespaces.length; j++) {
        var value = namespaces[j].value;
        if (!value || typeof value !== 'object') continue;
        if ('greeting' in value || 'caption' in value) return namespaces[j].ns;
      }
      return null;
    }

    function bindHostSettings(configCtx) {
      var forms = configCtx.configForms;
      if (!forms || typeof forms.get !== 'function' || typeof forms.describe !== 'function') return;
      var describe = forms.describe();
      function sync() {
        var ns = null;
        try { ns = resolveNamespace(describe); } catch (e) { ns = null; }
        if (!ns || ns === boundNs) return;
        if (unbindForm) { unbindForm(); unbindForm = null; }
        boundNs = ns;
        activeForm = forms.get(ns);
        function pull() {
          var snap;
          try { snap = activeForm.getSnapshot(); } catch (e) { return; }
          if (!snap) return;
          var next = coerceConfig(snap.value);
          settingsStore.set(next);
          writeCache(next);
          sourceStore.set('host');
        }
        pull();
        unbindForm = activeForm.subscribe(function () { pull(); });
      }
      try { unbindDescribe = describe.subscribe(sync); } catch (e) { unbindDescribe = null; }
      if (typeof describe.ensure === 'function') {
        try { describe.ensure().catch(function () { }); } catch (e) { /* ignore */ }
      }
      sync();
    }

    function commit(field, value) {
      var base = settingsStore.get() || DEFAULT_CONFIG;
      var patch = {};
      patch[field] = value;
      var merged = {};
      for (var k in base) merged[k] = base[k];
      for (var p in patch) merged[p] = patch[p];
      var next = coerceConfig(merged);
      settingsStore.set(next);
      writeCache(next);
      if (activeForm) {
        writeStatusStore.set('保存中…');
        var pending;
        try { pending = activeForm.set(field, next[field]); } catch (e) { pending = Promise.reject(e); }
        pending.then(function (accepted) {
          writeStatusStore.set(accepted ? '已保存' : 'Host 拒绝了这次修改');
        }, function (error) {
          writeStatusStore.set('保存失败：' + (error && error.message ? error.message : String(error)));
        });
      } else {
        writeStatusStore.set('已保存到本机浏览器');
      }
    }

    function resetDefaults() {
      for (var i = 0; i < 6; i++) {
        var key = ['enabled', 'font', 'name', 'greeting', 'caption', 'theme'][i];
        commit(key, DEFAULT_CONFIG[key]);
      }
      writeStatusStore.set('已恢复默认值');
    }

    /* ---------------- 预览通道 ---------------- */
    var previewHandler = null;
    function playPreview(config) {
      if (previewHandler) previewHandler(coerceConfig(config));
    }

    /* ---------------- 全屏开屏 ---------------- */
    function SplashLayer(props) {
      var mountRef = React.useRef(null);
      React.useEffect(function () {
        var el = mountRef.current;
        var config = props.config;
        var engine;
        try {
          engine = dshiwCreateSplash(el, {
            text: resolveWrittenText(config.name, config.greeting),
            font: config.font,
            theme: resolveTheme(config.theme),
            caption: config.caption,
            hold: HOLD_SECONDS,
            skipWhale: config.skipWhale,
            speed: config.speed,
            skipLabel: '点击或按任意键跳过',
            onDone: props.onDone
          });
          engine.start();
        } catch (e) {
          dropBootCover();
          throw e;
        }
        /* 第一帧已经画进 overlay，这时才摘首屏遮罩，不会露出主界面 */
        dropBootCover();
        return function () { engine.destroy(); };
        /* 一个 key 只播一次；配置在播放中变化不重启动画 */
      }, []);
      return h('div', { ref: mountRef, className: 'dshiw-mount' });
    }

    function SplashHost() {
      var state = React.useState(null);
      var job = state[0], setJob = state[1];
      var seq = React.useRef(0);

      React.useEffect(function () {
        var stopped = false;
        var timer = 0;
        var unsub = null;

        function launch(config) {
          if (stopped || !config) return;
          if (!config.enabled) { dropBootCover(); return; }
          seq.current += 1;
          setJob({ config: config, key: seq.current });
        }
        function check() {
          var v = settingsStore.get();
          if (v === undefined) return false;
          launch(v);
          return true;
        }

        if (!check()) {
          unsub = settingsStore.subscribe(function () {
            if (check() && unsub) { unsub(); unsub = null; clearTimeout(timer); }
          });
          timer = setTimeout(function () {
            if (unsub) { unsub(); unsub = null; }
            if (settingsStore.get() === undefined) settingsStore.set(coerceConfig(undefined));
            check();
          }, 1400);
        }
        return function () {
          stopped = true;
          if (unsub) unsub();
          clearTimeout(timer);
        };
      }, []);

      React.useEffect(function () {
        previewHandler = function (config) {
          seq.current += 1;
          setJob({ config: config, key: seq.current });
        };
        return function () { previewHandler = null; };
      }, []);

      if (!job) return null;
      return h(SplashLayer, {
        key: job.key,
        config: job.config,
        onDone: function () { setJob(null); }
      });
    }

    /* ---------------- 设置页小组件 ---------------- */
    function CanvasSample(props) {
      var ref = React.useRef(null);
      React.useEffect(function () {
        var el = ref.current;
        if (!el) return;
        dshiwDrawSample(el, props.text, props.font, props.px || 0, props.color, props.fitW, props.fitH);
      }, [props.text, props.font, props.color, props.fitW, props.fitH, props.px]);
      return h('canvas', {
        ref: ref,
        width: props.width || 1040,
        height: props.height || 140,
        className: props.className || 'dshiw-set__sample',
        'aria-hidden': 'true'
      });
    }

    function FontChip(props) {
      var ref = React.useRef(null);
      React.useEffect(function () {
        var el = ref.current;
        if (!el) return;
        dshiwDrawSample(el, FONT_LABEL[props.fontKey], props.fontKey, 0, props.color, 330, 46);
      }, [props.fontKey, props.color]);
      return h('button', {
        type: 'button',
        className: 'dshiw-chip' + (props.selected ? ' is-on' : ''),
        title: FONT_LABEL[props.fontKey],
        'aria-pressed': props.selected ? 'true' : 'false',
        onClick: props.onPick
      }, h('canvas', { ref: ref, width: 360, height: 56, 'aria-hidden': 'true' }));
    }

    /* 设置页里的内嵌预览：16:9 小舞台，按真实时间轴播一遍。
       设置面板盖在 shell.overlay 之上，所以这里不能再用全屏预览。 */
    function InlinePreview(props) {
      var mountRef = React.useRef(null);
      React.useEffect(function () {
        var config = props.config;
        var engine = dshiwCreateSplash(mountRef.current, {
          text: resolveWrittenText(config.name, config.greeting),
          font: config.font,
          theme: resolveTheme(config.theme),
          caption: config.caption,
          hold: 1.2,
          skipWhale: config.skipWhale,
          speed: config.speed,
          inline: true,
          skipLabel: '',
          onDone: props.onDone
        });
        engine.start();
        return function () { engine.destroy(); };
      }, []);
      return h('div', { ref: mountRef, className: 'dshiw-set__stage' });
    }

    function SettingsCard() {
      var value = React.useSyncExternalStore(settingsStore.subscribe, settingsStore.get);
      var source = React.useSyncExternalStore(sourceStore.subscribe, sourceStore.get);
      var status = React.useSyncExternalStore(writeStatusStore.subscribe, writeStatusStore.get);
      var hostTheme = React.useSyncExternalStore(appThemeStore.subscribe, appThemeStore.get);
      var draftState = React.useState({});
      var drafts = draftState[0], setDrafts = draftState[1];
      var timers = React.useRef({});
      var previewState = React.useState(0);
      var previewKey = previewState[0], setPreviewKey = previewState[1];

      var config = value || DEFAULT_CONFIG;
      var shown = {};
      var k;
      for (k in config) shown[k] = config[k];
      for (k in drafts) shown[k] = drafts[k];

      var splashTheme = resolveTheme(shown.theme);
      var sampleColor = hostTheme === 'dark' ? '#EAF0FF' : '#283142';

      /* store 接受了某个值后，把对应草稿清掉，输入框回到真实配置 */
      React.useEffect(function () {
        setDrafts(function (current) {
          var next = {};
          var changed = false;
          for (var key in current) {
            if (String(config[key]) === String(current[key])) changed = true;
            else next[key] = current[key];
          }
          return changed ? next : current;
        });
      }, [config]);

      function editText(field, next) {
        setDrafts(function (d) {
          var copy = {};
          for (var key in d) copy[key] = d[key];
          copy[field] = next;
          return copy;
        });
        clearTimeout(timers.current[field]);
        timers.current[field] = setTimeout(function () { commit(field, next); }, 650);
      }

      function field(label, key, hint) {
        return h('label', { className: 'dshiw-set__field', key: key },
          h('span', { className: 'dshiw-set__label' }, label),
          h('input', {
            type: 'text',
            value: shown[key],
            spellCheck: false,
            maxLength: key === 'name' ? 48 : key === 'caption' ? 60 : 80,
            onChange: function (event) { editText(key, event.target.value); },
            onBlur: function () {
              clearTimeout(timers.current[key]);
              if (String(shown[key]) !== String(config[key])) commit(key, shown[key]);
            }
          }),
          hint ? h('span', { className: 'dshiw-set__note' }, hint) : null
        );
      }

      var written = resolveWrittenText(shown.name, shown.greeting);
      var where = source === 'host'
        ? '配置来源：DSH 设置（已持久化，重启后保留）'
        : '配置来源：本机浏览器（设置服务未连接时使用）';

      return h('div', { className: 'dshiw-set' },
        h('div', { className: 'dshiw-set__intro' },
          h('div', { className: 'dshiw-set__lead' }, '启动时按真实笔顺写出你的文字，收在鲸鱼锁标上。'),
          h('div', { className: 'dshiw-set__status' }, where + (status ? ' · ' + status : ''))
        ),

        h('div', { className: 'dshiw-set__preview' },
          h('div', {
            className: 'dshiw-set__frame',
            style: { background: splashTheme === 'dark' ? '#000' : '#fff' }
          },
            previewKey > 0
              ? h(InlinePreview, {
                  key: previewKey,
                  config: shown,
                  onDone: function () { setPreviewKey(0); }
                })
              : h(React.Fragment, null,
                  h(CanvasSample, {
                    text: written,
                    font: shown.font,
                    color: splashTheme === 'dark' ? '#EAF0FF' : '#283142',
                    fitW: 620,
                    fitH: 120,
                    className: 'dshiw-set__sample'
                  }),
                  h('button', {
                    type: 'button',
                    className: 'dshiw-set__play',
                    onClick: function () { setPreviewKey(Date.now()); }
                  }, '▶ 播放预览')
                )
          ),
          h('div', { className: 'dshiw-set__actions' },
            h('button', {
              type: 'button',
              className: 'dshiw-set__primary',
              onClick: function () { setPreviewKey(Date.now()); }
            }, previewKey > 0 ? '重新播放' : '播放预览'),
            h('span', { className: 'dshiw-set__note' },
              previewKey > 0 ? '点击画面可跳过' : '内嵌播放完整时间轴（受倍速与鲸鱼开关影响）'
            )
          )
        ),

        h('section', { className: 'dshiw-set__group' },
          h('div', { className: 'dshiw-set__title' }, '文字内容'),
          field('称呼', 'name', '会被写出来的名字。'),
          field('问候语', 'greeting', '支持 {name}：写「Hello {name}」就会写出 Hello 加称呼。'),
          field('副标题', 'caption', '鲸鱼锁标下面的那行小字；留空则不显示。'),
          h('div', { className: 'dshiw-set__note' }, '当前会写：' + written)
        ),

        h('section', { className: 'dshiw-set__group' },
          h('div', { className: 'dshiw-set__title' }, '字体样式'),
          h('div', { className: 'dshiw-set__chips' }, FONT_KEYS.map(function (key) {
            return h(FontChip, {
              key: key,
              fontKey: key,
              selected: shown.font === key,
              color: shown.font === key ? (hostTheme === 'dark' ? '#FFFFFF' : '#3964FE') : sampleColor,
              onPick: function () { commit('font', key); }
            });
          })),
          h('div', { className: 'dshiw-set__note' }, '8 套手写笔画数据内嵌在插件里，不联网、不装字体。')
        ),

        h('section', { className: 'dshiw-set__group' },
          h('div', { className: 'dshiw-set__title' }, '深浅色'),
          h('div', { className: 'dshiw-set__seg' }, THEME_OPTIONS.map(function (option) {
            return h('button', {
              key: option,
              type: 'button',
              className: 'dshiw-set__segBtn' + (shown.theme === option ? ' is-on' : ''),
              onClick: function () { commit('theme', option); }
            }, THEME_LABEL[option]);
          })),
          h('div', { className: 'dshiw-set__note' },
            '「跟随 DSH」会在每次启动时读取当前界面主题；深色用黑底冷光墨迹，浅色用白底官方蓝。'
          )
        ),

        h('section', { className: 'dshiw-set__group' },
          h('div', { className: 'dshiw-set__title' }, '播放节奏'),
          h('div', { className: 'dshiw-set__row' },
            h('span', { className: 'dshiw-set__rowText' },
              h('span', { className: 'dshiw-set__label' }, '关闭后续鲸鱼动画'),
              h('span', { className: 'dshiw-set__note' }, '贴着写完就直接淡出进主界面，不再描鲸鱼、不显示字标与副标题。')
            ),
            h('input', {
              type: 'checkbox',
              className: 'dshiw-set__switch',
              checked: shown.skipWhale,
              'aria-label': '关闭后续鲸鱼动画',
              onChange: function (event) { commit('skipWhale', event.target.checked); }
            })
          ),
          h('div', { className: 'dshiw-set__field' },
            h('span', { className: 'dshiw-set__label' }, '手写播放倍速'),
            h('div', { className: 'dshiw-set__seg' }, SPEED_OPTIONS.map(function (option) {
              return h('button', {
                key: String(option),
                type: 'button',
                className: 'dshiw-set__segBtn' + (shown.speed === option ? ' is-on' : ''),
                onClick: function () { commit('speed', option); }
              }, option === 1 ? '1x' : option + 'x');
            })),
            h('div', { className: 'dshiw-set__note' },
              '整段开屏按倍数压缩，字迹与收尾一起变快；1x 约 14 秒，3x 约 5 秒。'
            )
          )
        ),

        h('section', { className: 'dshiw-set__group' },
          h('div', { className: 'dshiw-set__row' },
            h('span', { className: 'dshiw-set__rowText' },
              h('span', { className: 'dshiw-set__label' }, '启动时播放开屏'),
              h('span', { className: 'dshiw-set__note' }, '关掉后只有上面的「播放预览」会显示。')
            ),
            h('input', {
              type: 'checkbox',
              className: 'dshiw-set__switch',
              checked: shown.enabled,
              'aria-label': '启动时播放开屏',
              onChange: function (event) { commit('enabled', event.target.checked); }
            })
          ),
          h('div', { className: 'dshiw-set__actions' },
            h('button', { type: 'button', onClick: resetDefaults }, '恢复默认'),
            h('span', { className: 'dshiw-set__note' }, '只重置这几项配置。')
          )
        ),

        /* 底部 Star 入口：一个外链，不加额外文案噪音。 */
        h('div', { className: 'dshiw-set__foot' },
          h('a', {
            className: 'dshiw-star',
            href: REPO_URL,
            target: '_blank',
            rel: 'noopener noreferrer',
            title: REPO_URL,
            'aria-label': '在 GitHub 上给 dsh-ink-whale 点 Star'
          },
            h('span', { className: 'dshiw-star__glyph', 'aria-hidden': 'true' }, '★'),
            h('span', null, '喜欢的话，去 GitHub 给个 Star'),
            h('span', { className: 'dshiw-star__arrow', 'aria-hidden': 'true' }, '↗')
          )
        )
      );
    }

    /* ---------------- 样式 ---------------- */
    var SETTINGS_CSS = [
      '.dshiw-set{display:flex;flex-direction:column;gap:16px;max-width:720px;min-width:0;font-size:12px;',
      'color:var(--dsw-alias-label-primary,inherit);line-height:1.5}',
      '.dshiw-set__intro{display:flex;flex-direction:column;gap:5px}',
      '.dshiw-set__lead{font-size:13px}',
      '.dshiw-set__status{font-size:11px;color:var(--dsw-alias-label-secondary,#7f8287)}',
      '.dshiw-set__preview{display:flex;flex-direction:column;gap:10px}',
      '.dshiw-set__frame{position:relative;width:100%;aspect-ratio:16/9;overflow:hidden;border-radius:14px;',
      'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));display:flex;align-items:center;justify-content:center}',
      '.dshiw-set__stage{position:absolute;inset:0}',
      '.dshiw-set__sample{display:block;width:86%;max-width:620px;height:auto}',
      '.dshiw-set__play{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);padding:6px 14px;border-radius:999px;',
      'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.35));background:rgba(20,20,24,.66);color:#fff;font:inherit;',
      'font-size:11px;letter-spacing:.08em;cursor:pointer}',
      '.dshiw-set__play:hover{background:rgba(20,20,24,.86)}',
      '.dshiw-set__group{display:flex;flex-direction:column;gap:11px;padding:14px 16px;border-radius:14px;',
      'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.22));background:var(--dsw-alias-bg-layer-1,rgba(127,127,127,.05))}',
      '.dshiw-set__title{font-size:12px;font-weight:600;letter-spacing:.02em}',
      '.dshiw-set__row{display:flex;align-items:center;justify-content:space-between;gap:14px}',
      '.dshiw-set__rowText{display:flex;flex-direction:column;gap:3px;min-width:0}',
      '.dshiw-set__label{font-size:12px}',
      '.dshiw-set__note{font-size:11px;color:var(--dsw-alias-label-secondary,#7f8287)}',
      '.dshiw-set__field{display:flex;flex-direction:column;gap:5px;min-width:0}',
      '.dshiw-set input[type=text]{box-sizing:border-box;width:100%;padding:7px 9px;border-radius:9px;font:inherit;font-size:12px;',
      'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.08));',
      'color:var(--dsw-alias-label-primary,inherit);outline:none}',
      '.dshiw-set input[type=text]:focus{border-color:var(--dsw-alias-brand-primary,#4090ff)}',
      '.dshiw-set__chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}',
      '.dshiw-chip{display:flex;align-items:center;justify-content:center;height:44px;padding:0 10px;border-radius:10px;cursor:pointer;',
      'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));background:transparent;color:inherit}',
      '.dshiw-chip canvas{display:block;height:28px;width:auto;max-width:100%}',
      '.dshiw-chip:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12))}',
      '.dshiw-chip.is-on{border-color:var(--dsw-alias-brand-primary,#3964fe);background:var(--dsw-alias-interactive-bg-hover-accent,rgba(57,100,254,.1))}',
      '.dshiw-set__seg{display:inline-flex;gap:0;padding:2px;border-radius:10px;width:max-content;',
      'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.06))}',
      '.dshiw-set__segBtn{padding:5px 14px;border:0;border-radius:8px;background:transparent;color:inherit;font:inherit;font-size:11px;cursor:pointer}',
      '.dshiw-set__segBtn.is-on{background:var(--dsw-alias-bg-base,#fff);color:var(--dsw-alias-brand-primary,#3964fe);',
      'box-shadow:0 1px 3px rgba(0,0,0,.14)}',
      '.dshiw-set__actions{display:flex;flex-wrap:wrap;gap:10px;align-items:center}',
      '.dshiw-set button{padding:7px 13px;border-radius:9px;cursor:pointer;font:inherit;font-size:12px;color:inherit;',
      'border:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.3));background:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.1))}',
      '.dshiw-set button:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.2))}',
      '.dshiw-set__primary{border-color:transparent!important;background:var(--dsw-alias-button-primary-fill,#3964fe)!important;',
      'color:var(--dsw-alias-button-primary-foreground,#fff)!important}',
      '.dshiw-set__switch{appearance:none;-webkit-appearance:none;flex:0 0 auto;width:36px;height:20px;margin:0;border-radius:999px;',
      'background:rgba(127,127,127,.32);position:relative;cursor:pointer;transition:background .18s ease}',
      '.dshiw-set__switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;',
      'box-shadow:0 1px 3px rgba(0,0,0,.3);transition:transform .18s ease}',
      '.dshiw-set__switch:checked{background:var(--dsw-alias-brand-primary,#3964fe)}',
      '.dshiw-set__switch:checked::after{transform:translateX(16px)}',
      /* 底部 Star：克制的单行外链，悬停才有一点反馈 */
      '.dshiw-set__foot{display:flex;justify-content:center;padding:2px 0 6px}',
      '.dshiw-star{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:11px;',
      'color:var(--dsw-alias-label-secondary,#7f8287);text-decoration:none;border:1px solid transparent;',
      'transition:color .16s ease,border-color .16s ease,background .16s ease}',
      '.dshiw-star:hover{color:var(--dsw-alias-label-primary,#e8e8ea);background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.12));',
      'border-color:var(--dsw-alias-border-l1,rgba(127,127,127,.28))}',
      '.dshiw-star:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-brand-primary,#3964fe));outline-offset:2px}',
      '.dshiw-star__glyph{font-size:13px;line-height:1;color:#E8A33D}',
      '.dshiw-star__arrow{font-size:10px;opacity:.7}'
    ].join('');

    var ALL_CSS = DSHIW_CSS + SETTINGS_CSS;

    function installStyles() {
      var existing = document.head.querySelector('style[data-dsh-ink-whale-styles]');
      if (existing) {
        if (existing.textContent !== ALL_CSS) existing.textContent = ALL_CSS;
        return function () { };
      }
      var style = document.createElement('style');
      style.setAttribute('data-dsh-ink-whale-styles', '');
      style.textContent = ALL_CSS;
      document.head.appendChild(style);
      return function () { style.remove(); };
    }

    /* ---------------- 插件入口 ---------------- */
    function apply(ctx) {
      if (typeof document === 'undefined' || typeof window === 'undefined') return;

      /* 缓存里已经明确关掉开屏：不必再遮，直接放行主界面 */
      var cached = settingsStore.get();
      if (cached && cached.enabled === false) dropBootCover();

      ctx.effect(function () {
        var removeStyles = installStyles();
        window.__inkWhale = {
          config: function () { return settingsStore.get(); },
          source: function () { return sourceStore.get(); },
          play: function (patch) {
            var base = settingsStore.get() || DEFAULT_CONFIG;
            var merged = {};
            for (var key in base) merged[key] = base[key];
            for (var p in (patch || {})) merged[p] = patch[p];
            playPreview(coerceConfig(merged));
          },
          resolveWrittenText: resolveWrittenText,
          fonts: FONT_KEYS.slice()
        };
        return function () {
          delete window.__inkWhale;
          if (unbindForm) { unbindForm(); unbindForm = null; }
          if (unbindDescribe) { unbindDescribe(); unbindDescribe = null; }
          removeStyles();
        };
      }, 'dsh-ink-whale: styles and debug hook');

      ctx.inject(['theme'], function (themeCtx) {
        try {
          var snapshot = themeCtx.theme.getTheme();
          if (snapshot && snapshot.active) appThemeStore.set(snapshot.active.colorScheme === 'dark' ? 'dark' : 'light');
        } catch (e) { /* 没有主题服务时按系统偏好 */ }
        themeCtx.on('theme/change', function (snapshot) {
          if (snapshot && snapshot.active) appThemeStore.set(snapshot.active.colorScheme === 'dark' ? 'dark' : 'light');
        });
      });

      ctx.inject(['configForms'], function (configCtx) {
        bindHostSettings(configCtx);
      });

      ctx.inject(['slots'], function (slotsCtx) {
        var slots = slotsCtx.slots;
        if (!slots) return;
        slots.inject('shell.overlay', function () {
          return slots.register({
            name: 'shell.overlay',
            id: 'ink-whale',
            order: SPLASH_ORDER,
            label: function () { return '开屏'; }
          }, SplashHost);
        });
        slots.inject('settings.plugins.tab', function () {
          return slots.register({
            name: 'settings.plugins.tab',
            id: 'ink-whale',
            order: SETTINGS_ORDER,
            label: function () { return '开屏'; }
          }, SettingsCard);
        });
      });
    }

    return { name: 'dsh-ink-whale', inject: [], apply: apply };
  }
});

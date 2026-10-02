(function () {
  'use strict';

  var S = window.SMM;
  var app = document.getElementById('app');
  var STORAGE_KEY = 'smm-strategy:v1';

  // ---------- Утилиты ----------

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function nl2br(s) {
    return esc(s).replace(/\n/g, '<br>');
  }

  function formatDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  var toastTimer;
  function toast(text) {
    var el = document.getElementById('toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  // ---------- Аналитика (PRD раздел 6) ----------

  function initAnalytics() {
    var c = S.config;
    if (c.yandexMetrikaId) {
      /* eslint-disable */
      (function (m, e, t, r, i, k, a) { m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); }; m[i].l = 1 * new Date(); k = e.createElement(t), a = e.getElementsByTagName(t)[0], k.async = 1, k.src = r, a.parentNode.insertBefore(k, a); })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
      /* eslint-enable */
      window.ym(c.yandexMetrikaId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true });
    }
    if (c.gaMeasurementId) {
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(c.gaMeasurementId);
      document.head.appendChild(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', c.gaMeasurementId);
    }
  }

  // События воронки: diagnostic_start, diagnostic_step, diagnostic_complete, plan_step_done и т.д.
  function track(event, params) {
    try {
      if (window.ym && S.config.yandexMetrikaId) window.ym(S.config.yandexMetrikaId, 'reachGoal', event, params);
      if (window.gtag && S.config.gaMeasurementId) window.gtag('event', event, params || {});
    } catch (e) { /* аналитика не должна ломать сайт */ }
  }

  // ---------- Состояние ----------
  // Хранится в браузере: результат доступен без регистрации (F6.1),
  // а незаконченная диагностика продолжается с того же места (F1.3).

  var state = {
    answers: {},
    qIndex: 0,
    completed: false,
    done: {},
    stepFeedback: {},
    saved: false
  };

  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch (e) { /* хранилище недоступно — работаем в памяти */ }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function strategy() {
    return state.completed ? S.buildStrategy(state.answers) : null;
  }

  function isAnswered(q) {
    var v = state.answers[q.id];
    if (q.type === 'multi') return Array.isArray(v) && v.length > 0;
    if (q.type === 'text') return typeof v === 'string' && v.trim().length > 1;
    return !!v;
  }

  // ---------- Общие куски разметки ----------

  function emptyState(title, text) {
    return '<section class="page narrow center">' +
      '<div class="empty-illustration" aria-hidden="true">🧭</div>' +
      '<h1>' + esc(title) + '</h1>' +
      '<p class="lead">' + esc(text) + '</p>' +
      '<a class="btn btn-large" href="#/start">Пройти диагностику — 3 минуты</a>' +
      '</section>';
  }

  function progressBar(value, label) {
    var pct = Math.round(value * 100);
    return '<div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(label) + '">' +
      '<div class="progress-fill" style="width:' + pct + '%"></div></div>';
  }

  // ---------- Главная ----------

  function viewHome() {
    var st = strategy();
    var cta = st
      ? '<a class="btn btn-large" href="#/plan">Продолжить мой план</a><a class="btn btn-ghost btn-large" href="#/strategy">Моя стратегия</a>'
      : '<a class="btn btn-large" href="#/start">Получить мою стратегию</a><a class="btn btn-ghost btn-large" href="#/learn">Сначала почитать</a>';

    var nicheList = Object.keys(S.niches).filter(function (k) { return k !== 'other'; })
      .map(function (k) { return '<li>' + esc(S.niches[k].label) + '</li>'; }).join('');

    return '<section class="hero">' +
      '<div class="hero-text">' +
      '<p class="eyebrow">SMM без воды и сложных слов</p>' +
      '<h1>Ответь на 10 вопросов и получи свою SMM-стратегию с планом на 30 дней</h1>' +
      '<p class="lead">Не очередная статья «про SMM вообще», а понятные шаги именно для твоего бизнеса: что делать сегодня, завтра и через неделю.</p>' +
      '<div class="cta-row">' + cta + '</div>' +
      '<p class="muted small">Бесплатно · без регистрации · 3–5 минут</p>' +
      '</div>' +
      '<div class="hero-visual" aria-hidden="true"><div class="hero-card">' +
      '<div class="mock-head"><span class="dot"></span>План на 30 дней</div>' +
      '<div class="mock-progress"><div style="width:38%"></div></div>' +
      '<ul class="mock-steps">' +
      '<li class="is-done">Опиши своего клиента</li>' +
      '<li class="is-done">Сформулируй позиционирование</li>' +
      '<li class="is-current">Оформи шапку профиля</li>' +
      '<li>Подготовь «витрину»</li>' +
      '</ul>' +
      '<div class="mock-cheer">Отлично, ты уже сделал первый шаг! 🎉</div>' +
      '</div>' +
      '</div>' +
      '</section>' +

      '<section class="section">' +
      '<h2>Как это работает</h2>' +
      '<ol class="how-grid">' +
      '<li><span class="how-num">1</span><h3>Диагностика</h3><p>10 простых вопросов о бизнесе: ниша, цель, бюджет, время. По одному на экране.</p></li>' +
      '<li><span class="how-num">2</span><h3>Стратегия</h3><p>Позиционирование, аудитория и её боли, рубрики контента, площадки и метрики.</p></li>' +
      '<li><span class="how-num">3</span><h3>План на 30 дней</h3><p>Шаги по неделям: что сделать, зачем, пример и какой результат ждать.</p></li>' +
      '<li><span class="how-num">4</span><h3>Шаблоны</h3><p>Контент-план, сценарии Reels и Stories, шаблоны постов — копируй и используй.</p></li>' +
      '</ol>' +
      '</section>' +

      '<section class="section split">' +
      '<div>' +
      '<h2>Что ты получишь</h2>' +
      '<ul class="check-list">' +
      '<li>Одна основная площадка вместо четырёх заброшенных</li>' +
      '<li>Готовый контент-план под твою нишу и твоё время</li>' +
      '<li>Каждый термин объяснён одной фразой</li>' +
      '<li>Конкретное задание «сделай сегодня» в каждом шаге</li>' +
      '<li>Маленькие победы и прогресс, который видно</li>' +
      '</ul>' +
      '</div>' +
      '<div class="card soft">' +
      '<h3>Шаблоны, проверенные практиками, для ниш:</h3>' +
      '<ul class="pill-list">' + nicheList + '</ul>' +
      '<p class="muted">Методологию пишут и проверяют практикующие SMM-специалисты. Мы персонализируем экспертные шаблоны, а не генерируем советы «из воздуха».</p>' +
      '</div>' +
      '</section>' +

      '<section class="section card pro-teaser">' +
      '<div><h2>Ты SMM-специалист?</h2><p>Быстрый старт с новым клиентом: стратегия, которую не стыдно показать, бриф, отчёт и структура презентации.</p></div>' +
      '<a class="btn btn-ghost" href="#/pro">Для специалистов</a>' +
      '</section>';
  }

  // ---------- Диагностика ----------

  function viewStart(params) {
    if (params[0] === 'pro' && !state.answers.role) {
      state.answers.role = 'pro';
      persist();
    }
    var qs = S.questions;
    if (state.qIndex === 0 && !Object.keys(state.answers).length) track('diagnostic_start');
    var i = Math.min(Math.max(state.qIndex, 0), qs.length - 1);
    var q = qs[i];
    var val = state.answers[q.id];
    var input;

    if (q.type === 'text') {
      input = '<div class="field"><label class="sr-only" for="q-text">' + esc(q.title) + '</label>' +
        '<textarea id="q-text" name="q" rows="3" maxlength="' + q.maxLength + '" placeholder="' + esc(q.placeholder) + '">' + esc(val || '') + '</textarea>' +
        '<div class="counter muted small"><span data-counter>' + (val || '').length + '</span> / ' + q.maxLength + '</div></div>';
    } else {
      var isMulti = q.type === 'multi';
      input = '<fieldset class="options' + (q.options.length > 4 ? ' options-grid' : '') + '"><legend class="sr-only">' + esc(q.title) + '</legend>' +
        q.options.map(function (o) {
          var checked = isMulti ? (val || []).indexOf(o.value) !== -1 : val === o.value;
          return '<label class="option">' +
            '<input type="' + (isMulti ? 'checkbox' : 'radio') + '" name="q" value="' + esc(o.value) + '"' + (checked ? ' checked' : '') + (o.exclusive ? ' data-exclusive' : '') + '>' +
            '<span class="option-body"><span class="option-label">' + esc(o.label) + '</span>' +
            (o.desc ? '<span class="option-desc">' + esc(o.desc) + '</span>' : '') + '</span></label>';
        }).join('') + '</fieldset>';
    }

    var cheer = S.cheers[i] ? '<p class="cheer">' + esc(S.cheers[i]) + '</p>' : '';
    var last = i === qs.length - 1;

    return '<section class="page narrow diag">' +
      '<div class="diag-top"><span class="muted">Вопрос ' + (i + 1) + ' из ' + qs.length + '</span>' +
      (Object.keys(state.answers).length ? '<button type="button" class="link-btn" data-action="reset">Начать заново</button>' : '') + '</div>' +
      progressBar((i + 1) / qs.length, 'Прогресс диагностики') +
      cheer +
      '<form data-form="question" novalidate>' +
      '<h1 class="q-title" tabindex="-1">' + esc(q.title) + '</h1>' +
      (q.hint ? '<p class="muted">' + esc(q.hint) + '</p>' : '') +
      input +
      '<div class="diag-nav">' +
      '<button type="button" class="btn btn-ghost" data-action="prev"' + (i === 0 ? ' disabled' : '') + '>← Назад</button>' +
      '<button type="submit" class="btn" data-next' + (isAnswered(q) ? '' : ' disabled') + '>' + (last ? 'Получить стратегию' : 'Далее →') + '</button>' +
      '</div>' +
      '</form>' +
      '</section>';
  }

  function onQuestionInput(target) {
    var q = S.questions[state.qIndex];
    if (q.type === 'text') {
      state.answers[q.id] = target.value;
      var counter = app.querySelector('[data-counter]');
      if (counter) counter.textContent = target.value.length;
    } else if (q.type === 'multi') {
      var boxes = app.querySelectorAll('input[name="q"]');
      if (target.checked && target.hasAttribute('data-exclusive')) {
        boxes.forEach(function (b) { if (b !== target) b.checked = false; });
      } else if (target.checked) {
        boxes.forEach(function (b) { if (b.hasAttribute('data-exclusive')) b.checked = false; });
      }
      state.answers[q.id] = Array.prototype.filter.call(boxes, function (b) { return b.checked; }).map(function (b) { return b.value; });
    } else {
      state.answers[q.id] = target.value;
    }
    persist();
    var next = app.querySelector('[data-next]');
    if (next) next.disabled = !isAnswered(q);
  }

  function nextQuestion() {
    var q = S.questions[state.qIndex];
    if (!isAnswered(q)) return;
    track('diagnostic_step', { step: state.qIndex + 1, question: q.id });
    if (state.qIndex >= S.questions.length - 1) {
      state.completed = true;
      state.qIndex = 0; // при повторном прохождении начинаем сначала, ответы подставятся
      persist();
      track('diagnostic_complete', { niche: state.answers.niche, goal: state.answers.goal });
      location.hash = '#/strategy';
      return;
    }
    state.qIndex++;
    persist();
    render();
  }

  // ---------- Стратегия ----------

  function viewStrategy() {
    var st = strategy();
    if (!st) return emptyState('Стратегии пока нет', 'Ответь на 10 вопросов — и здесь появится твоя персональная SMM-стратегия.');

    var platforms = st.platforms.map(function (p) {
      return '<div class="card platform' + (p.main ? ' is-main' : '') + '">' +
        '<span class="badge">' + (p.main ? 'Основная' : 'Дополнительная') + '</span>' +
        '<h3>' + esc(p.label) + '</h3><p>' + esc(p.why) + '</p>' +
        '<p class="muted small">Форматы: ' + esc(p.formats) + '</p></div>';
    }).join('');

    var dropped = st.droppedPlatforms.length
      ? '<p class="note">Пока поставь на паузу: ' + esc(st.droppedPlatforms.join(', ')) + '. Это не навсегда — лучше хорошо вести одну-две площадки, чем все сразу понемногу.</p>'
      : '';

    var rubrics = st.rubrics.map(function (r) {
      return '<li class="rubric"><div class="rubric-head"><strong>' + esc(r.name) + '</strong><span>' + r.share + '%</span></div>' +
        '<div class="bar"><div style="width:' + r.share + '%"></div></div>' +
        '<p class="muted small">' + esc(r.about) + ' Например: ' + esc(r.ideas.slice(0, 2).join('; ')) + '.</p></li>';
    }).join('');

    var f = st.frequency;
    var videoLine = f.videos ? ', из них ' + f.videos + ' ' + plural(f.videos, 'видео', 'видео', 'видео') : '';

    var metrics = st.metrics.map(function (m, idx) {
      return '<li><strong>' + esc(m.name) + (idx === 0 ? ' <span class="badge">главная</span>' : '') + '</strong><span>' + esc(m.how) + '</span></li>';
    }).join('');

    var who = st.isPro ? 'ответы о клиенте' : 'твои ответы';

    return '<article class="page strategy">' +
      '<header class="page-head">' +
      '<p class="eyebrow">' + (st.isPro ? 'Стратегия для клиента' : 'Твоя стратегия') + ' · ' + esc(st.niche.label) + '</p>' +
      '<h1>SMM-стратегия: ' + esc(st.goalLabel) + '</h1>' +
      '<p class="lead">Мы взяли экспертный шаблон для ниши «' + esc(st.niche.label) + '» и подстроили его под ' + who + '. Ниже — всё, что нужно на первый месяц.</p>' +
      '<div class="cta-row no-print">' +
      '<a class="btn" href="#/plan">Открыть план на 30 дней</a>' +
      '<button type="button" class="btn btn-ghost" data-action="print">Скачать PDF / распечатать</button>' +
      (state.saved ? '' : '<button type="button" class="btn btn-ghost" data-action="save">Сохранить</button>') +
      '</div>' +
      '</header>' +

      '<section class="section"><h2><span class="sec-num">1</span>Позиционирование</h2>' +
      '<p class="muted">Позиционирование — короткий ответ на вопрос «почему выбирают тебя, а не других».</p>' +
      '<div class="card quote"><p class="big">' + esc(st.positioning.formula) + '</p>' +
      '<p>Допиши своё отличие — конкретное и проверяемое. Например: <em>' + esc('«' + st.positioning.diffExamples.join('», «') + '»') + '</em>.</p></div>' +
      '</section>' +

      '<section class="section"><h2><span class="sec-num">2</span>Аудитория и её боли</h2>' +
      '<p>' + esc(st.audience) + '</p>' +
      '<h3>Что их беспокоит перед покупкой</h3>' +
      '<ul class="pain-list">' + st.pains.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' +
      '<p class="note">Каждая боль — готовая тема для поста, который её снимает.</p>' +
      '</section>' +

      '<section class="section"><h2><span class="sec-num">3</span>Площадки</h2>' +
      '<div class="grid-2">' + platforms + '</div>' + dropped +
      '</section>' +

      '<section class="section"><h2><span class="sec-num">4</span>Рубрики контента</h2>' +
      '<p class="muted">Рубрика — повторяющийся тип публикаций. Доли подобраны под цель «' + esc(st.goalLabel) + '».</p>' +
      '<ul class="rubrics">' + rubrics + '</ul>' +
      '</section>' +

      '<section class="section"><h2><span class="sec-num">5</span>Ритм публикаций</h2>' +
      '<div class="stats">' +
      '<div class="stat"><span class="stat-num">' + f.posts + '</span><span>' + plural(f.posts, 'публикация', 'публикации', 'публикаций') + ' в неделю' + esc(videoLine) + '</span></div>' +
      '<div class="stat"><span class="stat-num">Stories</span><span>' + esc(f.stories) + '</span></div>' +
      '<div class="stat"><span class="stat-num">⏱</span><span>' + esc(f.hours) + '</span></div>' +
      '</div>' +
      (st.video === 'no' ? '<p class="note">Без видео: делаем ставку на карусели и полезные посты — их сохраняют и пересылают.</p>' : '') +
      '</section>' +

      '<section class="section"><h2><span class="sec-num">6</span>Реклама</h2><p>' + esc(st.budgetAdvice) + '</p></section>' +

      '<section class="section"><h2><span class="sec-num">7</span>Метрики: как понять, что работает</h2>' +
      '<ul class="metric-list">' + metrics + '</ul>' +
      '<p class="muted small">Записывай цифры раз в неделю. Подробнее — в статье <a href="#/learn/metrics-beginner">«Какие метрики смотреть новичку»</a>.</p>' +
      '</section>' +

      '<section class="section card today no-print"><h2>Сделай сегодня</h2>' +
      '<p>Первый шаг плана: опиши своего клиента. Это 15 минут, и всё остальное станет проще.</p>' +
      '<a class="btn" href="#/plan">Перейти к первому шагу</a>' +
      '<button type="button" class="link-btn" data-action="reset-go">Пройти диагностику заново</button></section>' +
      '</article>';
  }

  // ---------- План на 30 дней ----------

  function viewPlan() {
    var st = strategy();
    if (!st) return emptyState('План появится после диагностики', 'Ответь на 10 вопросов, и мы соберём для тебя пошаговый план на 30 дней.');

    var plan = S.buildPlan(st);
    var all = S.planSteps(plan);
    var doneCount = all.filter(function (s) { return state.done[s.id]; }).length;
    var nextStep = all.filter(function (s) { return !state.done[s.id]; })[0];

    var headline = doneCount === 0
      ? 'Начни с первого шага — он займёт около 15 минут.'
      : doneCount === all.length
        ? 'Все шаги пройдены! Ты проделал огромную работу 🎉'
        : 'Сделано ' + doneCount + ' из ' + all.length + '. Так держать!';

    var weeks = plan.map(function (w, wi) {
      var wDone = w.steps.filter(function (s) { return state.done[s.id]; }).length;
      return '<section class="week">' +
        '<header class="week-head"><h2>' + esc(w.title) + '</h2><span class="muted small">' + wDone + '/' + w.steps.length + '</span></header>' +
        '<p class="muted">' + esc(w.goal) + '</p>' +
        w.steps.map(function (s) { return stepCard(s, nextStep && s.id === nextStep.id); }).join('') +
        '</section>';
    }).join('');

    return '<article class="page plan">' +
      '<header class="page-head">' +
      '<p class="eyebrow">План на 30 дней · основная площадка: ' + esc(st.platforms[0].label) + '</p>' +
      '<h1>Твой маршрут</h1>' +
      '<p class="lead" data-plan-headline>' + esc(headline) + '</p>' +
      progressBar(doneCount / all.length, 'Прогресс плана') +
      '</header>' +
      weeks +
      '</article>';
  }

  function stepCard(s, isNext) {
    var done = !!state.done[s.id];
    var fb = state.stepFeedback[s.id];
    var feedback = '';
    if (done) {
      if (!fb) {
        feedback = '<div class="step-feedback"><span>Как прошло?</span>' +
          '<button type="button" class="chip" data-action="feedback" data-step="' + s.id + '" data-value="yes">👍 Получилось</button>' +
          '<button type="button" class="chip" data-action="feedback" data-step="' + s.id + '" data-value="no">🤔 Не очень</button></div>';
      } else if (fb === 'yes') {
        feedback = '<p class="step-feedback ok">Супер! Запомни, что сработало, — это пригодится.</p>';
      } else {
        feedback = '<p class="step-feedback">Не получилось с первого раза? Это нормально. Загляни в <a href="#/learn">статьи</a> или <a href="#/feedback">напиши нам</a> — поможем разобраться.</p>';
      }
    }

    return '<details class="step' + (done ? ' is-done' : '') + (isNext ? ' is-next' : '') + '"' + (isNext ? ' open' : '') + '>' +
      '<summary>' +
      '<span class="step-check" aria-hidden="true"></span>' +
      '<span class="step-title"><span class="muted small">День ' + s.day + (isNext ? ' · <strong class="accent">следующий шаг</strong>' : '') + '</span>' + esc(s.title) + '</span>' +
      '</summary>' +
      '<div class="step-body">' +
      '<div class="step-row"><h4>Что сделать</h4><p>' + esc(s.what) + '</p></div>' +
      '<div class="step-row"><h4>Зачем</h4><p>' + esc(s.why) + '</p></div>' +
      '<div class="step-row example"><h4>Пример</h4><p>' + nl2br(s.example) + '</p></div>' +
      '<div class="step-row"><h4>Результат</h4><p>' + esc(s.result) + '</p></div>' +
      '<label class="done-toggle"><input type="checkbox" data-step-done="' + s.id + '"' + (done ? ' checked' : '') + '> Готово, шаг выполнен</label>' +
      feedback +
      '</div></details>';
  }

  // ---------- Шаблоны ----------

  function copyBlock(id, title, text, meta) {
    return '<div class="card tpl">' +
      '<div class="tpl-head"><h3>' + esc(title) + '</h3>' +
      '<button type="button" class="chip" data-action="copy" data-target="' + id + '">Копировать</button></div>' +
      (meta ? '<p class="muted small">' + esc(meta) + '</p>' : '') +
      '<pre id="' + id + '">' + esc(text) + '</pre></div>';
  }

  function viewTemplates() {
    var st = strategy();
    var T = S.templates;
    var planBlock;

    if (st) {
      var rows = S.buildContentPlan(st);
      planBlock = '<p class="muted">Собран по твоей стратегии: ' + st.frequency.posts + ' ' + plural(st.frequency.posts, 'публикация', 'публикации', 'публикаций') + ' в неделю, площадка — ' + esc(st.platforms[0].label) + '. Темы — подсказки, меняй под себя.</p>' +
        '<div class="table-wrap"><table class="cplan"><thead><tr><th>Неделя</th><th>День</th><th>Рубрика</th><th>Тема</th><th>Формат</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td>' + r.week + '</td><td>' + esc(r.day) + '</td><td>' + esc(r.rubric) + '</td><td>' + esc(r.topic) + '</td><td>' + esc(r.format) + '</td></tr>';
        }).join('') +
        '</tbody></table></div>' +
        '<div class="cta-row"><button type="button" class="btn" data-action="download-plan">Скачать для Excel / Google Таблиц (CSV)</button></div>';
    } else {
      planBlock = '<div class="card soft"><p>Контент-план собирается автоматически под твою нишу, цель и время. <a href="#/start">Пройди диагностику</a> — и он появится здесь.</p></div>';
    }

    var reels = T.reels.map(function (t, i) { return copyBlock('reels-' + i, t.title, t.text, t.when); }).join('');
    var stories = T.stories.map(function (t, i) { return copyBlock('stories-' + i, t.title, t.text); }).join('');
    var posts = T.posts.map(function (t, i) { return copyBlock('post-' + i, t.title, t.text); }).join('');
    var ads = '<ul class="checklist">' + T.adsChecklist.map(function (c, i) {
      return '<li><label><input type="checkbox" data-ads-check="' + i + '"' + ((state.adsChecks || {})[i] ? ' checked' : '') + '> ' + esc(c) + '</label></li>';
    }).join('') + '</ul>';

    return '<article class="page">' +
      '<header class="page-head"><h1>Шаблоны</h1>' +
      '<p class="lead">Копируй, заменяй текст в [квадратных скобках] на свой — и публикуй.</p>' +
      '<nav class="tabs" aria-label="Разделы шаблонов">' +
      '<a href="#/templates" data-scroll="t-plan">Контент-план</a><a href="#/templates" data-scroll="t-reels">Reels</a><a href="#/templates" data-scroll="t-stories">Stories</a><a href="#/templates" data-scroll="t-posts">Посты</a><a href="#/templates" data-scroll="t-ads">Реклама</a>' +
      '</nav></header>' +
      '<section class="section" id="t-plan"><h2>Контент-план на 4 недели</h2>' + planBlock + '</section>' +
      '<section class="section" id="t-reels"><h2>Сценарии Reels и коротких видео</h2><div class="grid-2">' + reels + '</div></section>' +
      '<section class="section" id="t-stories"><h2>Сценарии Stories</h2><div class="grid-2">' + stories + '</div></section>' +
      '<section class="section" id="t-posts"><h2>Шаблоны постов</h2><div class="grid-2">' + posts + '</div></section>' +
      '<section class="section" id="t-ads"><h2>Чек-лист запуска рекламы</h2><p class="muted">Отмечай, что уже готово. Запускай рекламу, когда отмечено всё.</p>' + ads + '</section>' +
      '</article>';
  }

  function downloadPlan() {
    var st = strategy();
    if (!st) return;
    var rows = S.buildContentPlan(st);
    var csvCell = function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; };
    var lines = [['Неделя', 'День', 'Рубрика', 'Тема', 'Формат', 'Готово'].map(csvCell).join(';')]
      .concat(rows.map(function (r) { return [r.week, r.day, r.rubric, r.topic, r.format, ''].map(csvCell).join(';'); }));
    var blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kontent-plan.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    track('template_download', { template: 'content_plan' });
  }

  // ---------- Обучение ----------

  function viewLearn(params) {
    if (params[0]) return viewArticle(params[0]);
    var cards = S.articles.map(function (a) {
      return '<a class="card article-card" href="#/learn/' + a.slug + '">' +
        '<span class="badge">' + esc(a.tag) + '</span>' +
        '<h3>' + esc(a.title) + '</h3>' +
        '<span class="muted small">' + a.minutes + ' мин · обновлено ' + esc(formatDate(a.updated)) + '</span></a>';
    }).join('');
    return '<article class="page">' +
      '<header class="page-head"><h1>Обучение</h1><p class="lead">Короткие статьи простым языком. Каждая заканчивается заданием, которое можно сделать сегодня.</p></header>' +
      '<div class="grid-3">' + cards + '</div></article>';
  }

  function viewArticle(slug) {
    var a = S.articles.filter(function (x) { return x.slug === slug; })[0];
    if (!a) return viewNotFound();
    var idx = S.articles.indexOf(a);
    var next = S.articles[(idx + 1) % S.articles.length];
    return '<article class="page narrow article">' +
      '<a class="back-link" href="#/learn">← Все статьи</a>' +
      '<p class="eyebrow">' + esc(a.tag) + ' · ' + a.minutes + ' мин</p>' +
      '<h1>' + esc(a.title) + '</h1>' +
      '<p class="muted small">Обновлено ' + esc(formatDate(a.updated)) + '</p>' +
      a.body.map(function (p) { return '<p>' + p + '</p>'; }).join('') +
      '<div class="card today"><h2>Сделай сегодня</h2><p>' + esc(a.action) + '</p>' +
      '<div class="example"><h4>Пример</h4><p>' + esc(a.example) + '</p></div></div>' +
      '<a class="card next-article" href="#/learn/' + next.slug + '"><span class="muted small">Следующая статья</span><strong>' + esc(next.title) + ' →</strong></a>' +
      '</article>';
  }

  // ---------- Для специалистов ----------

  function viewPro() {
    var T = S.templates;
    return '<article class="page">' +
      '<header class="page-head"><p class="eyebrow">Для SMM-специалистов</p>' +
      '<h1>Быстрый старт с новым клиентом</h1>' +
      '<p class="lead">Пройди диагностику от лица клиента — получишь стратегию и план, которые можно показать на первой встрече. Плюс бриф, отчёт и структура презентации.</p>' +
      '<div class="cta-row"><a class="btn" href="#/start/pro" data-action="start-pro">Стратегия для клиента</a></div></header>' +
      '<section class="section"><div class="grid-3">' +
      '<div class="card"><h3>Стратегия за 5 минут</h3><p>Позиционирование, аудитория, рубрики, площадки и метрики — по экспертному шаблону ниши.</p></div>' +
      '<div class="card"><h3>Печатная версия</h3><p>На странице стратегии нажми «Скачать PDF» и отправь клиенту.</p></div>' +
      '<div class="card"><h3>Шаблоны документов</h3><p>Бриф, ежемесячный отчёт и структура презентации — ниже.</p></div>' +
      '</div></section>' +
      '<section class="section"><h2>Документы для работы с клиентом</h2><div class="grid-2">' +
      copyBlock('pro-brief', 'Бриф клиента', T.brief) +
      copyBlock('pro-report', 'Отчёт за месяц', T.report) +
      copyBlock('pro-pres', 'Презентация стратегии', T.presentation) +
      '</div></section>' +
      '<section class="section card soft"><h2>Скоро</h2><p>Несколько стратегий в одном кабинете, white-label отчёты и пакеты шаблонов. <a href="#/feedback">Напиши нам</a>, что нужно тебе в первую очередь.</p></section>' +
      '</article>';
  }

  // ---------- FAQ, О нас, Обратная связь, Конфиденциальность ----------

  var FAQ = [
    ['Это правда бесплатно?', 'Да. Диагностика, базовая стратегия, план на 30 дней и статьи — бесплатно. Позже появятся расширенные шаблоны по подписке, но базовая часть останется бесплатной.'],
    ['Нужно ли регистрироваться?', 'Нет. Стратегия и прогресс хранятся в твоём браузере на этом устройстве. Если очистить данные браузера или открыть сайт с другого телефона, их не будет — синхронизация через аккаунт появится в следующей версии.'],
    ['Кто составляет стратегии?', 'Основа — шаблоны, которые пишут и проверяют практикующие SMM-специалисты. Сайт подстраивает их под твои ответы: нишу, цель, время и бюджет.'],
    ['Моей ниши нет в списке. Что делать?', 'Выбери «Другое» — получишь универсальную основу. Мы добавляем новые ниши по запросам, так что напиши нам через форму обратной связи.'],
    ['Как часто обновляются материалы?', 'Раз в квартал пересматриваем всё, что связано с алгоритмами и площадками. Дата обновления указана на каждой статье.'],
    ['Можно ли пройти диагностику заново?', 'Да, в любой момент — кнопка «Пройти диагностику заново» на странице стратегии. Прогресс плана при этом сохранится.']
  ];

  function viewFaq() {
    return '<article class="page narrow">' +
      '<header class="page-head"><h1>Частые вопросы</h1></header>' +
      FAQ.map(function (f) {
        return '<details class="faq"><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>';
      }).join('') +
      '<p class="muted">Не нашёл ответ? <a href="#/feedback">Напиши нам</a>.</p>' +
      '</article>';
  }

  function viewAbout() {
    return '<article class="page narrow">' +
      '<header class="page-head"><h1>О нас</h1>' +
      '<p class="lead">Мы делаем этот сайт, потому что видели, как владельцы малого бизнеса тонут в противоречивых советах про SMM и в итоге либо не начинают, либо бросают через неделю.</p></header>' +
      '<h2>Во что мы верим</h2>' +
      '<ul class="values">' +
      '<li><strong>Действие вместо теории.</strong> Каждый совет заканчивается заданием, которое можно сделать сегодня.</li>' +
      '<li><strong>Один шаг за раз.</strong> Не нужно делать всё сразу. Маленькие победы складываются в результат.</li>' +
      '<li><strong>Простой язык.</strong> Любой термин объясняем одной фразой.</li>' +
      '<li><strong>Экспертиза прежде всего.</strong> Методологию пишут практики. Технологии помогают персонализировать, но не заменяют опыт.</li>' +
      '<li><strong>Поддержка.</strong> Не получилось с первого раза — это нормально.</li>' +
      '</ul></article>';
  }

  function viewFeedback() {
    return '<article class="page narrow">' +
      '<header class="page-head"><h1>Обратная связь</h1>' +
      '<p class="lead">Что-то непонятно, не сработало или хочется новую нишу? Напиши — мы читаем каждое сообщение.</p></header>' +
      '<form class="form card" data-form="feedback">' +
      '<div class="field"><label for="fb-name">Имя <span class="muted">(необязательно)</span></label><input id="fb-name" name="name" autocomplete="given-name"></div>' +
      '<div class="field"><label for="fb-email">Email для ответа <span class="muted">(необязательно)</span></label><input id="fb-email" name="email" type="email" autocomplete="email"></div>' +
      '<div class="field"><label for="fb-topic">Тема</label><select id="fb-topic" name="topic">' +
      '<option>Вопрос по стратегии</option><option>Шаг плана не получился</option><option>Хочу новую нишу</option><option>Идея или ошибка на сайте</option><option>Другое</option></select></div>' +
      '<div class="field"><label for="fb-msg">Сообщение</label><textarea id="fb-msg" name="message" rows="5" required></textarea></div>' +
      '<label class="consent"><input type="checkbox" name="consent" required> Согласен на обработку данных согласно <a href="#/privacy">политике конфиденциальности</a></label>' +
      '<button class="btn" type="submit">Отправить</button>' +
      '<p class="form-status" role="status" aria-live="polite"></p>' +
      '</form></article>';
  }

  function submitFeedback(form) {
    var status = form.querySelector('.form-status');
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    var data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      topic: form.topic.value,
      message: form.message.value.trim(),
      niche: state.answers.niche || null,
      sentAt: new Date().toISOString()
    };
    var done = function () {
      form.reset();
      status.textContent = 'Спасибо! Сообщение получено. Если оставил email — ответим в течение 2 рабочих дней.';
      track('feedback_sent', { topic: data.topic });
    };
    if (S.config.feedbackEndpoint) {
      status.textContent = 'Отправляем…';
      fetch(S.config.feedbackEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      }).then(function (r) {
        if (!r.ok) throw new Error(r.status);
        done();
      }).catch(function () {
        status.textContent = 'Не получилось отправить. Проверь интернет и попробуй ещё раз.';
      });
    } else {
      // Бэкенда пока нет: сохраняем локально, чтобы ничего не потерять при тесте.
      try {
        var box = JSON.parse(localStorage.getItem('smm-feedback') || '[]');
        box.push(data);
        localStorage.setItem('smm-feedback', JSON.stringify(box));
      } catch (e) { /* ignore */ }
      done();
    }
  }

  function viewPrivacy() {
    return '<article class="page narrow">' +
      '<header class="page-head"><h1>Конфиденциальность</h1><p class="lead">Коротко и по-человечески.</p></header>' +
      '<ul class="values">' +
      '<li><strong>Ответы диагностики и прогресс плана</strong> хранятся только в твоём браузере. Мы их не получаем.</li>' +
      '<li><strong>Форма обратной связи</strong> — передаём только то, что ты сам написал. Email нужен, только если хочешь получить ответ.</li>' +
      '<li><strong>Аналитика</strong> — используем обезличенную статистику посещений (Яндекс Метрика, Google Analytics), чтобы понимать, где сайт неудобен.</li>' +
      '<li><strong>Рассылки</strong> — только с твоего явного согласия, отписаться можно в один клик.</li>' +
      '<li><strong>Удалить данные</strong> — нажми кнопку ниже, и всё сохранённое на этом устройстве будет стёрто.</li>' +
      '</ul>' +
      '<button type="button" class="btn btn-ghost" data-action="wipe">Удалить мои данные с этого устройства</button>' +
      '</article>';
  }

  function viewNotFound() {
    return '<section class="page narrow center"><div class="empty-illustration" aria-hidden="true">🌿</div><h1>Такой страницы нет</h1>' +
      '<p class="lead">Возможно, ссылка устарела. Начнём с главной?</p><a class="btn" href="#/">На главную</a></section>';
  }

  // ---------- Роутер ----------

  var routes = {
    '': viewHome,
    start: viewStart,
    strategy: viewStrategy,
    plan: viewPlan,
    templates: viewTemplates,
    learn: viewLearn,
    pro: viewPro,
    faq: viewFaq,
    about: viewAbout,
    feedback: viewFeedback,
    privacy: viewPrivacy
  };

  var currentRoute = null;

  function render() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var name = parts[0];
    var view = routes[name] || viewNotFound;
    var changedPage = currentRoute !== location.hash;
    currentRoute = location.hash;

    app.innerHTML = view(parts.slice(1));

    document.querySelectorAll('[data-nav]').forEach(function (a) {
      if (a.getAttribute('data-nav') === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    closeMenu();

    var h1 = app.querySelector('h1');
    document.title = (h1 && name ? h1.textContent + ' — ' : '') + 'Шаг за шагом — твоя SMM-стратегия';

    if (name === 'start') {
      var focusTarget = app.querySelector('textarea') || app.querySelector('.q-title');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } else if (changedPage) {
      window.scrollTo(0, 0);
      app.focus({ preventScroll: true });
    }
  }

  function closeMenu() {
    document.body.classList.remove('menu-open');
    var t = document.querySelector('.menu-toggle');
    if (t) t.setAttribute('aria-expanded', 'false');
  }

  // ---------- Обработчики ----------

  var actions = {
    'toggle-menu': function (el) {
      var open = document.body.classList.toggle('menu-open');
      el.setAttribute('aria-expanded', String(open));
    },
    prev: function () {
      if (state.qIndex > 0) { state.qIndex--; persist(); render(); }
    },
    reset: function () {
      if (!confirm('Начать диагностику заново? Ответы будут очищены.')) return;
      state.answers = {};
      state.qIndex = 0;
      state.completed = false;
      persist();
      render();
    },
    'reset-go': function () {
      state.qIndex = 0;
      state.completed = false;
      persist();
      location.hash = '#/start';
    },
    print: function () {
      track('strategy_print');
      window.print();
    },
    save: function () {
      state.saved = true;
      persist();
      track('strategy_saved');
      toast('Стратегия сохранена на этом устройстве. Возвращайся в любой момент!');
      render();
    },
    feedback: function (el) {
      state.stepFeedback[el.getAttribute('data-step')] = el.getAttribute('data-value');
      persist();
      track('plan_step_feedback', { step: el.getAttribute('data-step'), value: el.getAttribute('data-value') });
      rerenderKeepingScroll();
    },
    copy: function (el) {
      var pre = document.getElementById(el.getAttribute('data-target'));
      var text = pre ? pre.textContent : '';
      var ok = function () { toast('Скопировано — вставляй и меняй под себя'); };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text); ok(); });
      } else {
        fallbackCopy(text);
        ok();
      }
      track('template_copy', { template: el.getAttribute('data-target') });
    },
    'download-plan': downloadPlan,
    'start-pro': function () {
      if (state.completed || Object.keys(state.answers).length) {
        state.answers = { role: 'pro' };
        state.qIndex = 0;
        state.completed = false;
        persist();
      }
    },
    wipe: function () {
      if (!confirm('Удалить стратегию, ответы и прогресс с этого устройства?')) return;
      try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('smm-feedback');
      } catch (e) { /* ignore */ }
      state = { answers: {}, qIndex: 0, completed: false, done: {}, stepFeedback: {}, saved: false };
      toast('Данные удалены');
      location.hash = '#/';
    }
  };

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }

  function rerenderKeepingScroll() {
    var y = window.scrollY;
    var open = Array.prototype.map.call(app.querySelectorAll('details[open] [data-step-done]'), function (i) {
      return i.getAttribute('data-step-done');
    });
    currentRoute = location.hash;
    app.innerHTML = routes[location.hash.replace(/^#\/?/, '').split('/')[0]]([]);
    open.forEach(function (id) {
      var input = app.querySelector('[data-step-done="' + id + '"]');
      if (input) input.closest('details').open = true;
    });
    window.scrollTo(0, y);
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (el && actions[el.getAttribute('data-action')]) {
      actions[el.getAttribute('data-action')](el, e);
      return;
    }
    var scroll = e.target.closest('[data-scroll]');
    if (scroll) {
      e.preventDefault();
      var target = document.getElementById(scroll.getAttribute('data-scroll'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  app.addEventListener('input', function (e) {
    if (e.target.name === 'q' && e.target.tagName === 'TEXTAREA') onQuestionInput(e.target);
  });

  app.addEventListener('change', function (e) {
    var t = e.target;
    if (t.name === 'q' && t.tagName === 'INPUT') {
      onQuestionInput(t);
    } else if (t.hasAttribute('data-step-done')) {
      var id = t.getAttribute('data-step-done');
      if (t.checked) {
        state.done[id] = true;
        track('plan_step_done', { step: id });
        var count = Object.keys(state.done).length;
        toast(count === 1 ? 'Отлично, ты уже сделал первый шаг!' : count % 5 === 0 ? 'Уже ' + count + ' шагов — это серьёзный прогресс!' : 'Ещё один шаг сделан 💪');
      } else {
        delete state.done[id];
        delete state.stepFeedback[id];
      }
      persist();
      rerenderKeepingScroll();
    } else if (t.hasAttribute('data-ads-check')) {
      state.adsChecks = state.adsChecks || {};
      state.adsChecks[t.getAttribute('data-ads-check')] = t.checked;
      persist();
    }
  });

  app.addEventListener('submit', function (e) {
    var form = e.target;
    var kind = form.getAttribute('data-form');
    if (!kind) return;
    e.preventDefault();
    if (kind === 'question') nextQuestion();
    if (kind === 'feedback') submitFeedback(form);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.body.classList.contains('menu-open')) closeMenu();
  });

  window.addEventListener('hashchange', render);

  initAnalytics();
  render();
})();

// Генератор стратегии (PRD F2.1–F2.2).
// Детерминированно персонализирует экспертный шаблон ниши по ответам диагностики.
// Позже сюда можно подключить ИИ, который переформулирует тексты, но не меняет структуру.
window.SMM = window.SMM || {};

(function () {
  var GOAL_LABELS = {
    leads: 'больше заявок и продаж',
    awareness: 'узнаваемость и охваты',
    community: 'живое сообщество постоянных клиентов',
    launch: 'запуск нового продукта'
  };

  // Как цель смещает доли рубрик (в процентных пунктах).
  var GOAL_SHIFT = {
    leads: { sell: 5, social: 5, value: -5, personal: -5 },
    awareness: { value: 10, proof: 5, sell: -10, social: -5 },
    community: { personal: 10, value: 5, sell: -10, proof: -5 },
    launch: { sell: 10, personal: 5, proof: -10, value: -5 }
  };

  var FREQUENCY = {
    lt2: { posts: 2, videos: 1, stories: '3 дня в неделю', hours: 'около 2 часов в неделю' },
    '2-5': { posts: 3, videos: 1, stories: 'каждый день по 2–3', hours: '3–5 часов в неделю' },
    '5-10': { posts: 4, videos: 2, stories: 'каждый день по 3–5', hours: '5–10 часов в неделю' },
    '10+': { posts: 5, videos: 3, stories: 'каждый день по 5+', hours: 'больше 10 часов в неделю' }
  };

  var METRICS = {
    leads: [
      { name: 'Заявки', how: 'Сколько человек написали или записались из соцсетей за неделю. Главная цифра.' },
      { name: 'Конверсия в заявку', how: 'Заявки ÷ переходы в профиль × 100%. Показывает, убеждает ли профиль.' },
      { name: 'Переходы по ссылке', how: 'Сколько людей нажали на ссылку в профиле.' },
      { name: 'Охват', how: 'Сколько разных людей увидели публикации. Без охвата нет заявок.' }
    ],
    awareness: [
      { name: 'Охват', how: 'Сколько разных людей увидели публикации. Главная цифра.' },
      { name: 'Просмотры видео', how: 'Сколько раз смотрели твои короткие видео.' },
      { name: 'Новые подписчики', how: 'Прирост за неделю — сколько людей решили остаться.' },
      { name: 'Сохранения и репосты', how: 'Показывают, что контент полезен и им делятся.' }
    ],
    community: [
      { name: 'Вовлечённость (ER)', how: '(лайки + комментарии + сохранения) ÷ охват × 100%. Главная цифра.' },
      { name: 'Комментарии и ответы', how: 'Сколько людей с тобой разговаривает.' },
      { name: 'Повторные покупки', how: 'Сколько клиентов вернулись за месяц.' },
      { name: 'Отписки', how: 'Если отписок больше обычного — проверь, что изменилось в контенте.' }
    ],
    launch: [
      { name: 'Лист ожидания', how: 'Сколько человек оставили контакт или написали «хочу». Главная цифра.' },
      { name: 'Предзаказы', how: 'Сколько людей купили до официального старта.' },
      { name: 'Охват анонсов', how: 'Сколько людей увидели посты о запуске.' },
      { name: 'Вопросы о продукте', how: 'Какие вопросы задают — это подсказки для следующих постов.' }
    ]
  };

  var BUDGET_ADVICE = {
    zero: 'Начинаем без рекламы: регулярный контент, коллаборации с соседними бизнесами и сарафанное радио. Это медленнее, но бесплатно и даёт тёплую аудиторию.',
    small: 'Первые 3 недели — без рекламы, чтобы профиль был «упакован» и наполнен. На 4-й неделе — небольшой тест: продвигаем лучший пост и смотрим, сколько стоит одна заявка.',
    medium: 'Реклама подключается на 4-й неделе, когда в профиле есть 9–12 публикаций и отзывы. Сначала тест на 3–5 дней, затем увеличиваем бюджет на то, что приносит заявки.'
  };

  function rubricsFor(niche, goal) {
    var shift = GOAL_SHIFT[goal] || {};
    var list = niche.rubrics.map(function (r) {
      return Object.assign({}, r, { share: Math.max(5, r.share + (shift[r.kind] || 0)) });
    });
    // Нормализуем до 100% с шагом 5.
    var total = list.reduce(function (s, r) { return s + r.share; }, 0);
    list.forEach(function (r) { r.share = Math.round((r.share / total) * 20) * 5; });
    var diff = 100 - list.reduce(function (s, r) { return s + r.share; }, 0);
    list.sort(function (a, b) { return b.share - a.share; });
    list[0].share += diff;
    return list;
  }

  function scorePlatforms(niche, a) {
    var current = a.platforms || [];
    var scores = {};
    Object.keys(SMM.platforms).forEach(function (p) {
      var s = niche.platformWeights[p] || 0;
      if (a.geo === 'local' && (p === 'instagram' || p === 'vk')) s += 1;
      if (a.geo === 'online' && (p === 'telegram' || p === 'youtube')) s += 1;
      if (a.video === 'no' && (p === 'tiktok' || p === 'youtube')) s -= 3;
      if (a.video === 'partial' && (p === 'tiktok' || p === 'youtube')) s -= 1;
      if (a.goal === 'awareness' && p === 'tiktok') s += 1;
      if (a.goal === 'community' && p === 'telegram') s += 1;
      if (a.goal === 'leads' && p === 'instagram') s += 0.5;
      // Уже есть аккаунт — проще продолжить, чем начинать с нуля.
      if (current.indexOf(p) !== -1) s += 1;
      scores[p] = s;
    });
    return Object.keys(scores).sort(function (x, y) { return scores[y] - scores[x]; });
  }

  SMM.buildStrategy = function (a) {
    var niche = SMM.niches[a.niche] || SMM.niches.other;
    var ranked = scorePlatforms(niche, a);
    var count = a.time === 'lt2' ? 1 : 2;
    var chosen = ranked.slice(0, count);
    var freq = Object.assign({}, FREQUENCY[a.time] || FREQUENCY['2-5']);
    if (a.video === 'no') freq.videos = 0;

    var dropped = (a.platforms || []).filter(function (p) {
      return p !== 'none' && chosen.indexOf(p) === -1;
    });

    var product = (a.product || '').trim() || 'твой продукт';

    return {
      isPro: a.role === 'pro',
      niche: niche,
      nicheKey: a.niche in SMM.niches ? a.niche : 'other',
      goal: a.goal,
      goalLabel: GOAL_LABELS[a.goal] || GOAL_LABELS.leads,
      product: product,
      positioning: {
        formula: product + ' — для ' + niche.audienceShort + '.',
        diffExamples: niche.diffExamples
      },
      audience: niche.audience,
      pains: niche.pains,
      rubrics: rubricsFor(niche, a.goal),
      platforms: chosen.map(function (p, i) {
        return Object.assign({ key: p, main: i === 0 }, SMM.platforms[p]);
      }),
      droppedPlatforms: dropped.map(function (p) { return SMM.platforms[p].label; }),
      frequency: freq,
      video: a.video,
      budget: a.budget,
      budgetAdvice: BUDGET_ADVICE[a.budget] || BUDGET_ADVICE.zero,
      metrics: METRICS[a.goal] || METRICS.leads,
      experience: a.experience
    };
  };

  // Распределение рубрик по слотам (плавный взвешенный round-robin).
  SMM.distributeRubrics = function (rubrics, n) {
    var cur = rubrics.map(function () { return 0; });
    var total = rubrics.reduce(function (s, r) { return s + r.share; }, 0);
    var out = [];
    for (var k = 0; k < n; k++) {
      var best = 0;
      for (var i = 0; i < rubrics.length; i++) {
        cur[i] += rubrics[i].share;
        if (cur[i] > cur[best]) best = i;
      }
      cur[best] -= total;
      out.push(rubrics[best]);
    }
    return out;
  };

  var DAYS = {
    2: ['Вт', 'Пт'],
    3: ['Пн', 'Ср', 'Пт'],
    4: ['Пн', 'Ср', 'Пт', 'Вс'],
    5: ['Пн', 'Вт', 'Чт', 'Пт', 'Вс']
  };

  // Контент-план на 4 недели (PRD F4.1).
  SMM.buildContentPlan = function (st) {
    var perWeek = st.frequency.posts;
    var slots = SMM.distributeRubrics(st.rubrics, perWeek * 4);
    var used = {};
    var main = st.platforms[0];
    var rows = [];
    slots.forEach(function (r, idx) {
      var week = Math.floor(idx / perWeek) + 1;
      var inWeek = idx % perWeek;
      var n = used[r.name] || 0;
      used[r.name] = n + 1;
      var format;
      if (inWeek < st.frequency.videos) {
        format = st.video === 'partial' ? main.videoWord + ' без лица' : main.videoWord;
      } else {
        format = main.key === 'telegram' ? 'пост' : (inWeek % 2 ? 'фото + текст' : 'карусель');
      }
      rows.push({
        week: week,
        day: DAYS[perWeek][inWeek],
        rubric: r.name,
        topic: r.ideas[n % r.ideas.length],
        format: format
      });
    });
    return rows;
  };
})();

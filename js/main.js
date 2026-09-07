/* ============================================================
   NotebookLM Slide Deck Prompts — Main Application Logic
   ============================================================ */

(function () {
  'use strict';

  // --- State ---
  let currentLang = localStorage.getItem('nlm-lang') || 'zh';
  let currentTheme = localStorage.getItem('nlm-theme') || 'dark';
  let currentCategory = 'all';
  let currentDifficulty = 'all';
  let promptsData = null;
  let i18nData = null;

  // --- DOM References ---
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const searchInput = $('#searchInput');
  const mainContent = $('#mainContent');
  const categoryNavInner = $('#categoryNavInner');
  const filterBar = $('#filterBar');
  const noResults = $('#noResults');
  const guideSteps = $('#guideSteps');
  const toast = $('#toast');
  const langToggle = $('#langToggle');
  const themeToggle = $('#themeToggle');

  // --- Init ---
  async function init() {
    applyTheme(currentTheme);
    try {
      const [promptsRes, i18nRes] = await Promise.all([
        fetch('data/prompts.json'),
        fetch('data/i18n.json')
      ]);

      if (!promptsRes.ok || !i18nRes.ok) {
        throw new Error(`HTTP error! status: ${promptsRes.status} / ${i18nRes.status}`);
      }

      promptsData = await promptsRes.json();
      i18nData = await i18nRes.json();
    } catch (e) {
      console.error('Failed to load data:', e);
      mainContent.innerHTML = '<p style="text-align:center;padding:4rem;color:var(--text-tertiary)">Failed to load data. Please refresh.</p>';
      return;
    }

    applyI18n();
    buildCategoryNav();
    buildFilterBar();
    renderPrompts();
    buildGuide();
    setupEventListeners();
    setupIntersectionObserver();
  }

  // --- i18n ---
  function t(key) {
    return (i18nData && i18nData[currentLang] && i18nData[currentLang][key]) || key;
  }

  function applyI18n() {
    document.documentElement.lang = currentLang === 'zh' ? 'zh-CN' : 'en';

    $$('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });

    $$('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      el.placeholder = t(key);
    });

    // Update page title
    document.title = currentLang === 'zh'
      ? 'NotebookLM 幻灯片提示词库 | Slide Deck Prompts'
      : 'NotebookLM Slide Deck Prompts';
  }

  function toggleLang() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    localStorage.setItem('nlm-lang', currentLang);
    applyI18n();
    buildCategoryNav();
    buildFilterBar();
    renderPrompts();
    buildGuide();
  }

  // --- Theme ---
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('nlm-theme', currentTheme);
    applyTheme(currentTheme);
  }

  // --- Category Navigation ---
  function buildCategoryNav() {
    if (!promptsData) return;
    let html = `<button class="category-nav__btn ${currentCategory === 'all' ? 'active' : ''}" data-cat="all">${escapeHtml(t('allCategories'))}</button>`;
    promptsData.categories.forEach((cat) => {
      const title = currentLang === 'zh' ? cat.title_zh : cat.title_en;
      html += `<button class="category-nav__btn ${currentCategory === cat.id ? 'active' : ''}" data-cat="${escapeHtml(cat.id)}">${escapeHtml(cat.icon)} ${escapeHtml(title)}</button>`;
    });
    categoryNavInner.innerHTML = html;
  }

  // --- Filter Bar ---
  function buildFilterBar() {
    const difficulties = [
      { key: 'all', label: t('filterAll') },
      { key: 'basic', label: t('filterBasic') },
      { key: 'intermediate', label: t('filterIntermediate') },
      { key: 'advanced', label: t('filterAdvanced') }
    ];
    filterBar.innerHTML = difficulties.map((d) =>
      `<button class="filter-bar__btn ${currentDifficulty === d.key ? 'active' : ''}" data-diff="${d.key}">${d.label}</button>`
    ).join('');
  }

  // --- Render Prompts ---
  function renderPrompts() {
    if (!promptsData) return;
    const query = searchInput.value.trim().toLowerCase();
    let hasResults = false;
    let html = '';

    promptsData.categories.forEach((cat) => {
      if (currentCategory !== 'all' && currentCategory !== cat.id) return;

      const filteredPrompts = cat.prompts.filter((p) => {
        // Difficulty filter
        if (currentDifficulty !== 'all' && p.difficulty !== currentDifficulty) return false;
        // Search filter
        if (query) {
          const title = currentLang === 'zh' ? p.title_zh : p.title_en;
          const prompt = p.prompt;
          const scenario = currentLang === 'zh' ? p.scenario_zh : p.scenario_en;
          const tags = p.tags.join(' ');
          const searchStr = `${title} ${prompt} ${scenario} ${tags}`.toLowerCase();
          return searchStr.includes(query);
        }
        return true;
      });

      if (filteredPrompts.length === 0) return;
      hasResults = true;

      const catTitle = currentLang === 'zh' ? cat.title_zh : cat.title_en;
      html += `
        <section class="category-section" id="cat-${escapeHtml(cat.id)}">
          <div class="category-section__header">
            <span class="category-section__icon">${escapeHtml(cat.icon)}</span>
            <h2 class="category-section__title">${escapeHtml(catTitle)}</h2>
            <span class="category-section__count">${filteredPrompts.length}</span>
          </div>
          <div class="cards-grid">
            ${filteredPrompts.map((p) => renderCard(p)).join('')}
          </div>
        </section>
      `;
    });

    mainContent.innerHTML = html;
    noResults.classList.toggle('show', !hasResults);
    setupIntersectionObserver();
  }

  function renderCard(p) {
    const title = currentLang === 'zh' ? p.title_zh : p.title_en;
    const scenario = currentLang === 'zh' ? p.scenario_zh : p.scenario_en;
    const notes = currentLang === 'zh' ? p.notes_zh : p.notes_en;
    const diffLabel = {
      basic: t('filterBasic'),
      intermediate: t('filterIntermediate'),
      advanced: t('filterAdvanced')
    }[p.difficulty] || p.difficulty;

    return `
      <article class="prompt-card" data-id="${escapeHtml(p.id)}">
        <div class="prompt-card__header">
          <h3 class="prompt-card__title">${escapeHtml(title)}</h3>
          <span class="prompt-card__difficulty prompt-card__difficulty--${escapeHtml(p.difficulty)}">${escapeHtml(diffLabel)}</span>
        </div>
        <p class="prompt-card__scenario">
          <span class="prompt-card__label">${escapeHtml(t('scenarioLabel'))}</span>
          ${escapeHtml(scenario)}
        </p>
        <div>
          <span class="prompt-card__label">${escapeHtml(t('promptLabel'))}</span>
          <div class="prompt-card__prompt" id="prompt-${escapeHtml(p.id)}">
            ${escapeHtml(p.prompt)}
            <div class="prompt-card__prompt-fade"></div>
          </div>
        </div>
        <div class="prompt-card__actions">
          <button class="prompt-card__copy-btn" data-prompt="${encodeURIComponent(p.prompt)}">
            📋 ${escapeHtml(t('copyBtn'))}
          </button>
          <button class="prompt-card__expand-btn" data-target="prompt-${escapeHtml(p.id)}" data-notes="notes-${escapeHtml(p.id)}">
            ${escapeHtml(t('expandBtn'))}
          </button>
        </div>
        <div class="prompt-card__tags">
          ${p.tags.map((tag) => `<span class="prompt-card__tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
        <div class="prompt-card__notes" id="notes-${escapeHtml(p.id)}">
          <span class="prompt-card__label">${escapeHtml(t('notesLabel'))}</span>
          ${escapeHtml(notes)}
        </div>
      </article>
    `;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Guide ---
  function buildGuide() {
    const steps = t('guideSteps');
    if (!Array.isArray(steps)) return;
    guideSteps.innerHTML = steps.map((s) => `<li class="guide__step">${s}</li>`).join('');
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Language toggle
    langToggle.addEventListener('click', toggleLang);

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Search
    searchInput.addEventListener('input', debounce(renderPrompts, 200));

    // Category nav (delegated)
    categoryNavInner.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-nav__btn');
      if (!btn) return;
      currentCategory = btn.dataset.cat;
      buildCategoryNav();
      renderPrompts();
      if (currentCategory !== 'all') {
        const section = $(`#cat-${currentCategory}`);
        if (section) section.scrollIntoView({ behavior: 'smooth' });
      }
    });

    // Difficulty filter (delegated)
    filterBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.filter-bar__btn');
      if (!btn) return;
      currentDifficulty = btn.dataset.diff;
      buildFilterBar();
      renderPrompts();
    });

    // Card actions (delegated)
    mainContent.addEventListener('click', (e) => {
      // Copy button
      const copyBtn = e.target.closest('.prompt-card__copy-btn');
      if (copyBtn) {
        const promptText = decodeURIComponent(copyBtn.dataset.prompt);
        copyToClipboard(promptText);
        return;
      }

      // Expand / collapse
      const expandBtn = e.target.closest('.prompt-card__expand-btn');
      if (expandBtn) {
        const promptEl = $(`#${expandBtn.dataset.target}`);
        const notesEl = $(`#${expandBtn.dataset.notes}`);
        const isExpanded = promptEl.classList.contains('expanded');

        promptEl.classList.toggle('expanded');
        notesEl.classList.toggle('show');
        expandBtn.textContent = isExpanded ? t('expandBtn') : t('collapseBtn');
        return;
      }
    });
  }

  // --- Clipboard ---
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('copiedToast'));
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast(t('copiedToast'));
    }
  }

  // --- Toast ---
  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // --- Intersection Observer (Card animations) ---
  let cardObserver = null;
  function setupIntersectionObserver() {
    if (cardObserver) {
      cardObserver.disconnect();
    }

    const cards = $$('.prompt-card:not(.visible)');
    if (!cards.length) return;

    cardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry, idx) => {
          if (entry.isIntersecting) {
            setTimeout(() => entry.target.classList.add('visible'), idx * 60);
            cardObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    cards.forEach((card) => cardObserver.observe(card));
  }

  // --- Utils ---
  function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // --- Start ---
  document.addEventListener('DOMContentLoaded', init);
})();

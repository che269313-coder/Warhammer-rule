/* ================================================================
   BecomeChampion — app.js
   W40K Phase Prompt Tool  |  Vanilla JS, No Build Required
   ================================================================ */
'use strict';

// ================================================================
// CONSTANTS
// ================================================================

const APP_VERSION = '2.5.0';
const DB_NAME     = 'BecomeChampionDB';
const DB_VER      = 1;
const STORE_PACKS = 'rulesPacks';
const LS_KEY      = 'bc_appstate';

// Official built-in packs — shown in manage view without import, lazy-loaded on activation
const OFFICIAL_PACKS = [
  { id: 'cn-sm-bt-rules-pack', path: './rulepacks/CN-SM-BT-rules-pack.json', faction: '星际战士', subfaction: '黑色圣堂', pack_version: '1.0.0-cn.2', game_version: '第10版' },
  { id: 'ac-rules-pack',    path: './rulepacks/AC-rules-pack.json',    faction: 'Adeptus Custodes', subfaction: '',               pack_version: '1.0.0', game_version: '10th Edition' },
  { id: 'tyr-rules-pack',   path: './rulepacks/TYR-rules-pack.json',   faction: 'Tyranids',          subfaction: '',               pack_version: '1.0.0', game_version: '10th Edition' },
  { id: 'tau-rules-pack',   path: './rulepacks/TAU-rules-pack.json',   faction: "T'au Empire",       subfaction: '',               pack_version: '1.0.0', game_version: '10th Edition' },
  { id: 'ik-rules-pack',    path: './rulepacks/IK-rules-pack.json',    faction: 'Imperial Knights',  subfaction: '',               pack_version: '1.0.0', game_version: '10th Edition' },
  { id: 'sm-bt-rules-pack', path: './rulepacks/SM-BT-rules-pack.json', faction: 'Space Marines',     subfaction: 'Black Templars', pack_version: '1.0.0', game_version: '10th Edition' },
  { id: 'sm-um-rules-pack', path: './rulepacks/SM-UM-rules-pack.json', faction: 'Space Marines',     subfaction: 'Ultramarines',   pack_version: '1.1.0', game_version: '10th Edition' },
];
const OFFICIAL_PACK_IDS = new Set(OFFICIAL_PACKS.map(p => p.id));

const PHASES = [
  { id: 'command',     nameCN: '指挥阶段',   nameEN: 'Command',      icon: '⚜️',  color: '#c9a227' },
  { id: 'movement',    nameCN: '移动阶段',   nameEN: 'Movement',     icon: '🏃',  color: '#1976d2' },
  { id: 'shooting',    nameCN: '射击阶段',   nameEN: 'Shooting',     icon: '🎯',  color: '#c62828' },
  { id: 'charge',      nameCN: '冲锋阶段',   nameEN: 'Charge',       icon: '⚡',  color: '#ef6c00' },
  { id: 'fight',       nameCN: '近战阶段',   nameEN: 'Fight',        icon: '⚔️',  color: '#7b1fa2' },
  { id: 'battleshock', nameCN: '战斗冲击',   nameEN: 'Battle-shock', icon: '🧠',  color: '#37474f' },
];

const FILTER_DEFS = [
  { id: 'all',        label: '全部' },
  { id: 'unit',       label: '单位能力' },
  { id: 'stratagem',  label: '战略点' },
  { id: 'detachment', label: '编队规则' },
];

const TURN_CONTEXTS = [
  { id: 'friendly', label: '我方回合' },
  { id: 'enemy',    label: '敌方回合' },
];

const ABILITY_TYPE_META = {
  active:     { label: '主动',   cls: 'badge-active' },
  passive:    { label: '被动',   cls: 'badge-passive' },
  reaction:   { label: '反应',   cls: 'badge-reaction' },
  wargear:    { label: '装备',   cls: 'badge-wargear' },
  stratagem:  { label: '战略点', cls: 'badge-stratagem' },
  detachment: { label: '编队',   cls: 'badge-detachment' },
  enhancement:{ label: '强化',   cls: 'badge-enhancement' },
};

// ================================================================
// DATABASE — IndexedDB wrapper
// ================================================================

const DB = (() => {
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_PACKS)) {
          db.createObjectStore(STORE_PACKS, { keyPath: 'id' });
        }
      };
      req.onsuccess = (e) => { _db = e.target.result; resolve(); };
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function getAll() {
    return new Promise((resolve, reject) => {
      const req = _db.transaction(STORE_PACKS, 'readonly')
                     .objectStore(STORE_PACKS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function put(pack) {
    return new Promise((resolve, reject) => {
      const req = _db.transaction(STORE_PACKS, 'readwrite')
                     .objectStore(STORE_PACKS).put(pack);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  function remove(id) {
    return new Promise((resolve, reject) => {
      const req = _db.transaction(STORE_PACKS, 'readwrite')
                     .objectStore(STORE_PACKS).delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = (e) => reject(e.target.error);
    });
  }

  return { open, getAll, put, remove };
})();

// ================================================================
// STATE
// ================================================================

const state = {
  view:          'home',  // 'home' | 'phase' | 'manage' | 'roster' | 'search'
  prevView:      'home',
  packs:         [],
  activePackId:  null,
  activePhase:   null,
  turnContext:   'friendly',
  filter:        'all',
  detachmentFilter: 'all',
  round:         1,
  usedAbilities: new Set(),  // Set of ability IDs
  selectedUnitsByPack: {},
  importTab:     'file',     // 'file' | 'paste'
  rosterQuery:   '',
  searchQuery:   '',
};

function persistState() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      activePackId:  state.activePackId,
      round:         state.round,
      usedAbilities: [...state.usedAbilities],
      selectedUnitsByPack: state.selectedUnitsByPack,
    }));
  } catch (_) { /* storage full or private mode */ }
}

function restoreState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    if (s.activePackId)  state.activePackId  = s.activePackId;
    if (s.round)         state.round         = s.round;
    if (Array.isArray(s.usedAbilities)) state.usedAbilities = new Set(s.usedAbilities);
    if (s.selectedUnitsByPack && typeof s.selectedUnitsByPack === 'object') {
      state.selectedUnitsByPack = s.selectedUnitsByPack;
    }
  } catch (_) { /* corrupted */ }
}

// ================================================================
// HELPERS
// ================================================================

function getActivePack() {
  return state.packs.find(p => p.id === state.activePackId) || null;
}

function getPackUnits(pack) {
  return Array.isArray(pack?.units) ? pack.units : [];
}

function getStoredSelectedUnits(packId) {
  const ids = state.selectedUnitsByPack?.[packId];
  return Array.isArray(ids) ? ids : null;
}

function getEffectiveSelectedUnitIds(pack) {
  if (!pack) return new Set();
  const storedIds = getStoredSelectedUnits(pack.id);
  if (storedIds) return new Set(storedIds);
  return new Set(getPackUnits(pack).map(unit => unit.id));
}

function setSelectedUnitsForPack(packId, unitIds) {
  state.selectedUnitsByPack[packId] = [...unitIds];
  persistState();
}

function getRosterSummary(pack) {
  const units = getPackUnits(pack);
  const selectedUnitIds = getEffectiveSelectedUnitIds(pack);
  return {
    totalCount: units.length,
    selectedCount: units.filter(unit => selectedUnitIds.has(unit.id)).length,
    hasCustomSelection: Array.isArray(getStoredSelectedUnits(pack?.id)),
  };
}

function getUnitGroupLabel(pack) {
  const rawLabel = String(pack?.subfaction || pack?.faction || '当前规则包').trim();
  const baseLabel = rawLabel.includes('+') ? String(pack?.faction || rawLabel).trim() : rawLabel;
  return `${baseLabel} 核心`;
}

function parseDetachmentFromSource(source) {
  const s = String(source || '');
  const idx = s.lastIndexOf('/');
  if (idx === -1) return '';
  return s.slice(idx + 1).trim();
}

function parseDetachmentFromTiming(timing) {
  const t = String(timing || '');
  const m = t.match(/-\s*(.+)$/);
  return m ? m[1].trim() : '';
}

function getDetachmentOptions(pack, abilities) {
  const opts = [];
  const seen = new Set();

  const add = (name) => {
    const n = String(name || '').trim();
    if (!n || seen.has(n)) return;
    seen.add(n);
    opts.push(n);
  };

  String(pack?.subfaction || '')
    .split('+')
    .map(s => s.trim())
    .forEach(add);

  (abilities || [])
    .filter((ab) => ab._category !== 'unit')
    .forEach((ab) => add(ab._detachment));

  return opts;
}

function inferTurnScope({ turn, timing, summary, type }) {
  const text = `${turn || ''}\n${timing || ''}\n${summary || ''}`.toLowerCase();

  if (/either player'?s turn|either player’s turn|start or end of any phase|any phase/.test(text)) {
    return 'either';
  }

  if (/your opponent'?s|opponent'?s turn|opponent’s turn/.test(text)) {
    return 'enemy';
  }

  if (/your turn|your command phase|your movement phase|your shooting phase|your charge phase|battle-shock step of your command phase|at the start of your|at the end of your|end of your/.test(text)) {
    return 'friendly';
  }

  if (type === 'reaction' && /enemy unit|selected as the target|selected its targets|ends a charge move|has fought|declare a charge/.test(text)) {
    return 'enemy';
  }

  return 'either';
}

function matchesTurnContext(scope, context) {
  const normalizedScope = scope === 'friendly' || scope === 'enemy' || scope === 'either'
    ? scope
    : 'either';
  const normalizedContext = context === 'enemy' ? 'enemy' : 'friendly';
  return normalizedScope === 'either' || normalizedScope === normalizedContext;
}

/**
 * Collect all phase-relevant abilities from a pack.
 * Returns flat list with _category ('unit'|'stratagem'|'detachment') attached.
 */
function collectPhaseAbilities(pack, phaseId) {
  if (!pack) return [];
  const out = [];
  const selectedUnitIds = getEffectiveSelectedUnitIds(pack);
  const unitGroupLabel = getUnitGroupLabel(pack);

  // 1. Unit abilities
  for (const unit of (pack.units || [])) {
    if (!selectedUnitIds.has(unit.id)) continue;
    for (const ab of (unit.abilities || [])) {
      if (!ab.phases) continue;
      if (ab.phases.includes(phaseId) || ab.phases.includes('any')) {
        out.push({
          ...ab,
          _unit: unit.name,
          _category: 'unit',
          _detachment: unitGroupLabel,
          _turnScope: ab.turn_scope || inferTurnScope(ab),
        });
      }
    }
  }

  // 2. Detachment rules (shown first by ordering below)
  for (const rule of (pack.detachment_rules || [])) {
    if (!rule.phases) continue;
    if (rule.phases.includes(phaseId) || rule.phases.includes('any')) {
      const detachment = parseDetachmentFromSource(rule.source) || parseDetachmentFromTiming(rule.timing);
      out.push({
        id:        rule.id,
        name:      rule.name,
        type:      'detachment',
        phases:    rule.phases,
        timing:    rule.timing,
        summary:   rule.summary,
        source:    rule.source,
        priority:  rule.priority || 0,
        _category: 'detachment',
        _detachment: detachment || '编队规则',
        _turnScope: rule.turn_scope || inferTurnScope(rule),
      });
    }
  }

  // 3. Enhancements (treat as detachment category for filter)
  for (const enh of (pack.enhancements || [])) {
    if (!enh.phases) continue;
    if (enh.phases.includes(phaseId) || enh.phases.includes('any')) {
      const detachment = parseDetachmentFromSource(enh.source) || parseDetachmentFromTiming(enh.timing);
      out.push({
        id:        enh.id,
        name:      enh.name,
        type:      'enhancement',
        phases:    enh.phases,
        timing:    enh.timing,
        summary:   enh.summary,
        source:    enh.source,
        priority:  enh.priority || 0,
        _category: 'detachment',
        _detachment: detachment || '编队强化',
        _turnScope: enh.turn_scope || inferTurnScope(enh),
      });
    }
  }

  // 4. Stratagems
  for (const strat of (pack.stratagems || [])) {
    if (!strat.phases) continue;
    if (strat.phases.includes(phaseId) || strat.phases.includes('any')) {
      const detachment = parseDetachmentFromSource(strat.source);
      out.push({
        id:        strat.id,
        name:      strat.name,
        type:      'stratagem',
        phases:    strat.phases,
        timing:    strat.timing,
        summary:   strat.effect,
        source:    strat.source,
        cp_cost:   strat.cp_cost,
        once_per:  strat.once_per,
        priority:  strat.priority || 0,
        tags:      strat.tags || [],
        _target:   strat.target,
        _category: 'stratagem',
        _detachment: detachment || '',
        _turnScope: strat.turn_scope || inferTurnScope({
          turn: strat.turn,
          timing: strat.timing,
          summary: strat.effect,
          type: 'stratagem',
        }),
      });
    }
  }

  // Sort: detachment > unit > stratagem; within same, higher priority first
  const CAT_ORDER = { detachment: 0, unit: 1, stratagem: 2 };
  out.sort((a, b) => {
    const cd = CAT_ORDER[a._category] - CAT_ORDER[b._category];
    if (cd !== 0) return cd;
    return (b.priority || 0) - (a.priority || 0);
  });

  return out;
}

function validatePack(data) {
  if (typeof data !== 'object' || data === null) return 'JSON 顶层须为对象';
  if (!data.id            || typeof data.id !== 'string')           return '缺少字符串字段 "id"';
  if (!data.faction       || typeof data.faction !== 'string')      return '缺少字符串字段 "faction"';
  if (!data.pack_version  || typeof data.pack_version !== 'string') return '缺少字符串字段 "pack_version"';
  if (!Array.isArray(data.units))                                   return '"units" 须为数组';
  return null; // valid
}

// ================================================================
// TOAST
// ================================================================

function toast(msg, type = 'info', ms = 2800) {
  const prev = document.querySelector('.toast');
  if (prev) prev.remove();

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);

  setTimeout(() => {
    el.style.transition = 'opacity 0.3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, ms);
}

// ================================================================
// NAVIGATION
// ================================================================

function navigate(view, opts = {}) {
  state.prevView  = state.view;
  state.view      = view;
  if (opts.phase)  {
    state.activePhase = opts.phase;
    state.turnContext = 'friendly';
    state.filter = 'all';
    state.detachmentFilter = 'all';
  }
  if (view === 'roster') {
    state.rosterQuery = '';
  }
  if (view === 'search') {
    state.searchQuery = '';
  }
  renderApp();
}

// ================================================================
// RENDER — main dispatcher
// ================================================================

function renderApp() {
  const app = document.getElementById('app');
  switch (state.view) {
    case 'phase':  app.innerHTML = renderPhaseView();  break;
    case 'manage': app.innerHTML = renderManageView(); break;
    case 'roster': app.innerHTML = renderRosterView(); break;
    case 'search': app.innerHTML = renderSearchView(); break;
    default:       app.innerHTML = renderHomeView();
  }
  bindAppEvents();
}

// ─────────────────────────────────────────────────────────────────
// HOME VIEW
// ─────────────────────────────────────────────────────────────────
function renderHomeView() {
  const pack = getActivePack();
  const rosterSummary = getRosterSummary(pack);

  const packCard = pack
    ? `<div class="pack-info-card">
        <div class="pack-info-text">
          <div class="pack-name">📚 ${esc(pack.faction)}${pack.subfaction ? ' · ' + esc(pack.subfaction) : ''}</div>
          <div class="pack-version">v${esc(pack.pack_version)}${pack.game_version ? ' · ' + esc(pack.game_version) : ''}${pack.date ? ' · ' + esc(pack.date) : ''}</div>
        </div>
      </div>`
    : `<div class="pack-info-card">
        <div class="pack-info-text">
          <div class="pack-empty">尚未加载规则包 — 点击"规则包"按钮导入</div>
        </div>
      </div>`;

  const rosterCard = pack
    ? `<div class="roster-summary-card">
        <div class="roster-summary-text">
          <div class="roster-summary-title">🧾 建军阶段</div>
          <div class="roster-summary-meta">已选 ${rosterSummary.selectedCount}/${rosterSummary.totalCount} 个单位${rosterSummary.hasCustomSelection ? ' · 已按军表筛选' : ' · 当前默认显示全部'}</div>
        </div>
        <button class="btn btn-secondary" id="btn-open-roster">筛选单位</button>
      </div>`
    : '';

  const query = state.searchQuery.trim().toLowerCase();

  // ---- Search results (shown when query is non-empty) ----
  let searchResultsHtml = '';
  if (query && pack) {
    const allAbs = collectAllAbilities(pack);
    const seen = new Set();
    const uniqueAbs = allAbs.filter(ab => {
      if (seen.has(ab.id)) return false;
      seen.add(ab.id);
      return true;
    });
    const filtered = uniqueAbs.map(ab => {
      const name = String(ab.name || '').toLowerCase();
      const summary = String(ab.summary || '').toLowerCase();
      const timing = String(ab.timing || '').toLowerCase();
      const source = String(ab.source || '').toLowerCase();
      const unitName = String(ab._unit || '').toLowerCase();
      const effect = String(ab.effect || '').toLowerCase();
      const target = String(ab.target || '').toLowerCase();
      const keywords = String(ab._keywords || '').toLowerCase();

      let score = 0;
      if (name.includes(query))     score = Math.max(score, 10);
      if (effect.includes(query))   score = Math.max(score, 9);
      if (summary.includes(query))  score = Math.max(score, 8);
      if (timing.includes(query))   score = Math.max(score, 5);
      if (target.includes(query))   score = Math.max(score, 4);
      if (unitName.includes(query)) score = Math.max(score, 3);
      if (source.includes(query))   score = Math.max(score, 2);
      // keywords excluded: unit-level tags belong in Roster search, not ability search
      return { ab, score };
    }).filter(item => item.score > 0);

    const catOrder = { stratagem: 0, detachment: 1, enhancement: 2, unit: 3 };
    filtered.sort((a, b) => {
      const aUsed = state.usedAbilities.has(a.ab.id) ? 1 : 0;
      const bUsed = state.usedAbilities.has(b.ab.id) ? 1 : 0;
      if (aUsed !== bUsed) return aUsed - bUsed;
      if (a.score !== b.score) return b.score - a.score; // higher score first
      const aCat = catOrder[a.ab._category] ?? 4;
      const bCat = catOrder[b.ab._category] ?? 4;
      if (aCat !== bCat) return aCat - bCat;
      return String(a.ab.name || '').localeCompare(String(b.ab.name || ''));
    });

    const filteredAbs = filtered.map(item => item.ab);
    const searchColor = '#c9a227';
    searchResultsHtml = filteredAbs.length === 0
      ? `<div class="empty-state" style="padding:24px 0">
          <div class="empty-icon">🔎</div>
          <div class="empty-title">没有匹配的结果</div>
          <div class="empty-desc">试试其他关键词</div>
        </div>`
      : `<div class="search-result-header">搜索「${esc(state.searchQuery)}」&nbsp;·&nbsp;${filteredAbs.length} 条结果</div>
         <div class="ability-list">${filteredAbs.map(ab => renderAbilityCard(ab, searchColor)).join('')}</div>
         <button class="btn btn-ghost btn-full" id="btn-clear-search" style="margin-top:12px">✕ 清除搜索</button>`;
  } else if (query && !pack) {
    searchResultsHtml = `<div class="empty-state" style="padding:24px 0">
        <div class="empty-icon">📚</div>
        <div class="empty-title">尚未加载规则包</div>
        <div class="empty-desc">请先在"规则包"中激活一个规则包后再搜索</div>
      </div>`;
  }

  // ---- Phase grid (shown when no search query) ----
  const phaseButtons = PHASES.map(p => {
    const all       = pack ? collectPhaseAbilities(pack, p.id) : [];
    const usedCount = all.filter(a => state.usedAbilities.has(a.id)).length;
    const badge     = all.length
      ? `<span class="phase-badge">${usedCount}/${all.length}</span>`
      : '';
    return `
      <button class="phase-btn" data-phase="${p.id}" style="--phase-color:${p.color}">
        ${badge}
        <span class="phase-icon">${p.icon}</span>
        <div>
          <div class="phase-name">${p.nameCN}</div>
          <div class="phase-name-en">${p.nameEN}</div>
        </div>
      </button>`;
  }).join('');

  const bodyContent = query
    ? searchResultsHtml
    : `<div class="round-bar">
        <span class="round-label">⚔️ 当前回合</span>
        <div class="round-controls">
          <button class="round-adj-btn" id="round-dec">−</button>
          <span class="round-number" id="round-display">${state.round}</span>
          <button class="round-adj-btn" id="round-inc">+</button>
        </div>
      </div>
      <div class="phase-grid">${phaseButtons}</div>`;

  return `
    <div class="app-header">
      <div class="header-left">
        <div class="header-titles">
          <div class="header-title">BecomeChampion</div>
          <div class="header-subtitle">战锤40K 规则助手 v${APP_VERSION}</div>
        </div>
      </div>
      <div class="header-right">
        <button class="icon-btn" id="hdr-manage" title="管理规则包">⚙️</button>
      </div>
    </div>

    <div class="main-content">
      ${packCard}
      ${rosterCard}

      <input class="search-input" id="home-search" type="search"
        placeholder="${pack ? '搜索能力名、单位名、关键词...' : '请先激活规则包后再搜索'}"
        value="${esc(state.searchQuery)}">

      ${bodyContent}
    </div>

    <div class="bottom-bar">
      <button class="btn btn-ghost" id="btn-clear-used" style="flex:0 0 auto;padding:0 16px;">🔄 清空标记</button>
      <button class="btn btn-primary" id="btn-open-manage">📦 规则包</button>
    </div>`;
}

function renderRosterView() {
  const pack = getActivePack();
  if (!pack) {
    return `
      <div class="app-header">
        <div class="header-left">
          <button class="back-btn" id="btn-back">←</button>
          <div class="header-titles">
            <div class="header-title">建军阶段</div>
            <div class="header-subtitle">Army Roster</div>
          </div>
        </div>
      </div>

      <div class="main-content">
        <div class="empty-state">
          <div class="empty-icon">🧾</div>
          <div class="empty-title">尚未加载规则包</div>
          <div class="empty-desc">请先导入并激活一个规则包，再筛选本局携带的单位。</div>
        </div>
      </div>`;
  }

  const units = [...getPackUnits(pack)];
  const selectedUnitIds = getEffectiveSelectedUnitIds(pack);
  const rosterSummary = getRosterSummary(pack);
  const query = state.rosterQuery.trim().toLowerCase();

  units.sort((left, right) => {
    const selectedDiff = Number(selectedUnitIds.has(right.id)) - Number(selectedUnitIds.has(left.id));
    if (selectedDiff !== 0) return selectedDiff;
    return left.name.localeCompare(right.name);
  });

  const visibleUnits = units.filter((unit) => {
    if (!query) return true;
    return unit.name.toLowerCase().includes(query)
      || (unit.keywords || []).some(keyword => String(keyword).toLowerCase().includes(query));
  });

  const unitCards = visibleUnits.length === 0
    ? `<div class="empty-state" style="padding:28px 16px">
        <div class="empty-icon">🔎</div>
        <div class="empty-title">没有匹配的单位</div>
        <div class="empty-desc">试试搜索别名、关键词，或清空搜索条件。</div>
      </div>`
    : visibleUnits.map((unit) => renderRosterUnitCard(unit, selectedUnitIds.has(unit.id))).join('');

  return `
    <div class="app-header">
      <div class="header-left">
        <button class="back-btn" id="btn-back">←</button>
        <div class="header-titles">
          <div class="header-title">建军阶段</div>
          <div class="header-subtitle">${rosterSummary.selectedCount}/${rosterSummary.totalCount} 已选单位</div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <div class="pack-info-card">
        <div class="pack-info-text">
          <div class="pack-name">📚 ${esc(pack.faction)}${pack.subfaction ? ' · ' + esc(pack.subfaction) : ''}</div>
          <div class="pack-version">后续阶段只显示这里勾选单位的单位能力；战略点、编队规则和强化仍全部保留。</div>
        </div>
      </div>

      <input class="roster-search-input" id="roster-search" type="search" placeholder="搜索单位名或关键词..." value="${esc(state.rosterQuery)}">

      <div class="roster-toolbar">
        <button class="btn btn-secondary" id="btn-roster-select-all">全选</button>
        <button class="btn btn-ghost" id="btn-roster-clear-all">清空</button>
      </div>

      <div class="roster-list">${unitCards}</div>
    </div>

    <div class="bottom-bar">
      <button class="btn btn-primary" id="btn-roster-done">完成建军</button>
    </div>`;
}

function renderRosterUnitCard(unit, isSelected) {
  const keywords = (unit.keywords || []).slice(0, 4).map(keyword => `<span class="roster-keyword">${esc(keyword)}</span>`).join('');
  const abilityCount = Array.isArray(unit.abilities) ? unit.abilities.length : 0;

  return `
    <button class="roster-unit-card ${isSelected ? 'is-selected' : ''}" data-roster-unit-id="${esc(unit.id)}">
      <span class="roster-unit-check">${isSelected ? '✓' : ''}</span>
      <span class="roster-unit-body">
        <span class="roster-unit-name">${esc(unit.name)}</span>
        <span class="roster-unit-meta">${abilityCount} 项能力</span>
        <span class="roster-keywords">${keywords}</span>
      </span>
    </button>`;
}

// ─────────────────────────────────────────────────────────────────
// PHASE VIEW
// ─────────────────────────────────────────────────────────────────
function renderPhaseView() {
  const phase = PHASES.find(p => p.id === state.activePhase);
  if (!phase) return renderHomeView();

  const pack = getActivePack();
  const allAbs = collectPhaseAbilities(pack, phase.id);
  const turnScopedAbs = allAbs.filter(ab => matchesTurnContext(ab._turnScope, state.turnContext));
  const detachments = getDetachmentOptions(pack, turnScopedAbs);

  if (state.detachmentFilter !== 'all' && !detachments.includes(state.detachmentFilter)) {
    state.detachmentFilter = 'all';
  }

  const detachmentFiltered = state.detachmentFilter === 'all'
    ? turnScopedAbs
    : turnScopedAbs.filter(a => a._category === 'unit' || a._detachment === state.detachmentFilter);

  const filtered = state.filter === 'all'
    ? detachmentFiltered
    : detachmentFiltered.filter(a => a._category === state.filter);

  const availableFilters = FILTER_DEFS
    .map((filterDef) => {
      const count = filterDef.id === 'all'
        ? detachmentFiltered.length
        : detachmentFiltered.filter(a => a._category === filterDef.id).length;

      return {
        ...filterDef,
        count,
        visible: filterDef.id === 'all' || count > 0,
      };
    })
    .filter(filterDef => filterDef.visible);

  if (!availableFilters.some(filterDef => filterDef.id === state.filter)) {
    state.filter = 'all';
  }

  const filterChips = availableFilters.map(filterDef => {
    return `<button class="filter-chip ${state.filter === filterDef.id ? 'active' : ''}"
               data-filter="${filterDef.id}"
               style="--phase-color:${phase.color}">
              ${filterDef.label}${filterDef.count > 0 ? ` (${filterDef.count})` : ''}
            </button>`;
  }).join('');

  const turnContextToggle = `
    <div class="turn-context-toggle" style="--phase-color:${phase.color}">
      ${TURN_CONTEXTS.map(ctx => `
        <button class="turn-context-btn ${state.turnContext === ctx.id ? 'active' : ''}"
                data-turn-context="${ctx.id}">
          ${ctx.label}
        </button>`).join('')}
    </div>`;

  const detachmentSelect = detachments.length <= 1
    ? ''
    : `
      <div class="detachment-bar" style="--phase-color:${phase.color}">
        <label class="detachment-label" for="detachment-filter">按编队筛选</label>
        <div class="select-wrap">
          <select id="detachment-filter" class="detachment-select">
            <option value="all" ${state.detachmentFilter === 'all' ? 'selected' : ''}>全部 (${turnScopedAbs.length})</option>
            ${detachments.map(name => {
              const cnt = turnScopedAbs.filter(a => a._detachment === name).length;
              return `<option value="${esc(name)}" ${state.detachmentFilter === name ? 'selected' : ''}>${esc(name)} (${cnt})</option>`;
            }).join('')}
          </select>
          <span class="select-arrow" aria-hidden="true"></span>
        </div>
      </div>`;

  const usedInPhase = turnScopedAbs.filter(a => state.usedAbilities.has(a.id)).length;

  const cards = filtered.length === 0
    ? `<div class="empty-state">
        <div class="empty-icon">📭</div>
        <div class="empty-title">此阶段暂无${state.filter === 'all' ? '' : FILTER_DEFS.find(f=>f.id===state.filter)?.label || ''}能力</div>
        <div class="empty-desc">${pack ? '规则包中没有该分类，请切换筛选器' : '请先在"规则包"中导入规则包'}</div>
       </div>`
    : filtered.map(ab => renderAbilityCard(ab, phase.color)).join('');

  return `
    <div class="app-header" style="border-bottom-color:${phase.color}55">
      <div class="header-left">
        <button class="back-btn" id="btn-back">←</button>
        <div class="header-titles">
          <div class="header-title" style="color:${phase.color}">${phase.icon} ${phase.nameCN}</div>
          <div class="header-subtitle">${phase.nameEN} · ${state.turnContext === 'friendly' ? '我方回合' : '敌方回合'} · ${usedInPhase}/${turnScopedAbs.length} 已标记</div>
        </div>
      </div>
    </div>

    <div class="main-content">
      ${turnContextToggle}
      ${detachmentSelect}
      <div class="filter-bar">${filterChips}</div>
      <div class="ability-list">${cards}</div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// SEARCH VIEW
// ─────────────────────────────────────────────────────────────────

/**
 * Collect all abilities from a pack across all phases and categories.
 * Returns flat list with _category, _unit, _detachment, _phase, _turnScope.
 */
function collectAllAbilities(pack) {
  if (!pack) return [];
  const out = [];
  // Search across ALL units regardless of roster selection
  const factionLabel = getUnitGroupLabel(pack);

  // 1. Unit abilities — all units, not just roster-selected
  for (const unit of (pack.units || [])) {
    for (const ab of (unit.abilities || [])) {
      if (!ab.phases) continue;
      out.push({
        ...ab,
        _unit: unit.name,
        _keywords: (unit.keywords || []).join(' '),
        _category: 'unit',
        _detachment: factionLabel,
        _turnScope: ab.turn_scope || inferTurnScope(ab),
      });
    }
  }

  // 2. Detachment rules
  for (const rule of (pack.detachment_rules || [])) {
    if (!rule.phases) continue;
    const detachment = parseDetachmentFromSource(rule.source) || parseDetachmentFromTiming(rule.timing);
    out.push({
      ...rule,
      _category: 'detachment',
      _detachment: detachment || '编队规则',
      _turnScope: rule.turn_scope || inferTurnScope(rule),
      type: rule.type || 'detachment',
    });
  }

  // 3. Stratagems
  for (const strat of (pack.stratagems || [])) {
    if (!strat.phases) continue;
    const detachment = parseDetachmentFromSource(strat.source) || parseDetachmentFromTiming(strat.timing);
    out.push({
      ...strat,
      _category: 'stratagem',
      _detachment: detachment || '战略',
      _turnScope: strat.turn_scope || inferTurnScope(strat),
      type: strat.type || 'stratagem',
    });
  }

  // 4. Enhancements
  for (const enh of (pack.enhancements || [])) {
    if (!enh.phases) continue;
    out.push({
      ...enh,
      _category: 'enhancement',
      _detachment: '强化',
      _turnScope: enh.turn_scope || inferTurnScope(enh),
      type: enh.type || 'enhancement',
    });
  }

  return out;
}

function renderSearchView() {
  const pack = getActivePack();
  if (!pack) {
    return `
      <div class="app-header">
        <div class="header-left">
          <button class="back-btn" id="btn-back">←</button>
          <div class="header-titles">
            <div class="header-title">搜索规则</div>
            <div class="header-subtitle">Rule Search</div>
          </div>
        </div>
      </div>
      <div class="main-content">
        <div class="empty-state">
          <div class="empty-icon">📚</div>
          <div class="empty-title">尚未加载规则包</div>
          <div class="empty-desc">请先在"规则包"中导入并激活一个规则包</div>
        </div>
      </div>`;
  }

  const query = state.searchQuery.trim().toLowerCase();
  const allAbs = collectAllAbilities(pack);

  // Deduplicate by id
  const seen = new Set();
  const uniqueAbs = allAbs.filter(ab => {
    if (seen.has(ab.id)) return false;
    seen.add(ab.id);
    return true;
  });

  // Search matching
  const filtered = query ? uniqueAbs.filter(ab => {
    const name = String(ab.name || '').toLowerCase();
    const summary = String(ab.summary || '').toLowerCase();
    const timing = String(ab.timing || '').toLowerCase();
    const source = String(ab.source || '').toLowerCase();
    const unit = String(ab._unit || '').toLowerCase();
    const effect = String(ab.effect || '').toLowerCase();
    const target = String(ab.target || '').toLowerCase();
    return name.includes(query)
      || summary.includes(query)
      || timing.includes(query)
      || source.includes(query)
      || unit.includes(query)
      || effect.includes(query)
      || target.includes(query);
  }) : uniqueAbs;

  // Sort: used first, then by category priority
  const catOrder = { stratagem: 0, detachment: 1, enhancement: 2, unit: 3 };
  const searchPhaseColor = '#c9a227'; // gold accent for search

  filtered.sort((a, b) => {
    const aUsed = state.usedAbilities.has(a.id) ? 1 : 0;
    const bUsed = state.usedAbilities.has(b.id) ? 1 : 0;
    if (aUsed !== bUsed) return aUsed - bUsed;
    const aCat = catOrder[a._category] ?? 4;
    const bCat = catOrder[b._category] ?? 4;
    if (aCat !== bCat) return aCat - bCat;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  const resultCount = query ? `找到 ${filtered.length} 条` : `共 ${filtered.length} 条`;

  const cards = filtered.length === 0
    ? `<div class="empty-state">
        <div class="empty-icon">🔎</div>
        <div class="empty-title">${query ? '没有匹配的结果' : '输入关键词开始搜索'}</div>
        <div class="empty-desc">${query ? '试试其他关键词，如能力名、单位名、关键词等' : '搜索单位能力、战略点、编队规则和强化'}</div>
      </div>`
    : filtered.map(ab => renderAbilityCard(ab, searchPhaseColor)).join('');

  return `
    <div class="app-header">
      <div class="header-left">
        <button class="back-btn" id="btn-back">←</button>
        <div class="header-titles">
          <div class="header-title">🔍 搜索规则</div>
          <div class="header-subtitle">${resultCount}</div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <input class="search-input" id="search-input" type="search" placeholder="搜索能力名、单位名、关键词..." value="${esc(state.searchQuery)}" autofocus>
      ${query ? `<div class="search-summary">搜索「${esc(state.searchQuery)}」&nbsp;·&nbsp;${resultCount}</div>` : ''}
      <div class="ability-list">${cards}</div>
    </div>`;
}

function getAbilitySourceLabel(ab) {
  if (!ab) return '';
  if (ab._category === 'unit') return ab._unit || ab.source || '';
  if (ab._category === 'stratagem') return '战略';
  if (ab._category === 'detachment') return ab._detachment || ab.source || '';
  return ab.source || '';
}

function renderAbilityCard(ab, phaseColor) {
  const isUsed   = state.usedAbilities.has(ab.id);
  const typeMeta = ABILITY_TYPE_META[ab.type] || ABILITY_TYPE_META.active;

  // Build detail text from whichever field is available.
  // Unit abilities / detachment rules / enhancements / wargear → summary
  // Stratagems → effect (+ target)
  let detailText = String(ab.summary || '').trim();
  if (!detailText) {
    const parts = [];
    if (ab.target) parts.push(`🎯 目标：${ab.target}`);
    if (ab.effect) parts.push(`📋 效果：${ab.effect}`);
    detailText = parts.join('\n');
  }
  const sourceLabel = getAbilitySourceLabel(ab);

  const accentColor =
    ab._category === 'stratagem'  ? '#43a047' :
    ab._category === 'detachment' ? '#ef6c00' :
    phaseColor;

  const cpBadge = ab.cp_cost !== undefined
    ? `<span class="ability-cp">CP ${ab.cp_cost}</span>` : '';

  const timingHtml = ab.timing
    ? `<div class="ability-timing">⏱ ${esc(ab.timing)}</div>` : '';

  const detailHtml = detailText
    ? `
      <details class="ability-details">
        <summary class="ability-details-toggle">规则详情</summary>
        <div class="ability-summary">${esc(detailText)}</div>
      </details>`
    : '';

  return `
    <div class="ability-card ${isUsed ? 'is-used' : ''}" style="--card-accent:${accentColor}">
      <div class="ability-card-header">
        <span class="ability-name">${esc(ab.name)}</span>
        <span class="type-badge ${typeMeta.cls}">${typeMeta.label}</span>
      </div>
      ${timingHtml}
      ${detailHtml}
      <div class="ability-card-footer">
        <span class="ability-source">${esc(sourceLabel)}</span>
        ${cpBadge}
        <button class="used-btn" data-used-id="${esc(ab.id)}">
          ${isUsed ? '✓ 已使用' : '标记已用'}
        </button>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// MANAGE VIEW
// ─────────────────────────────────────────────────────────────────
function renderManageView() {
  // Built-in section — always visible from hardcoded metadata, no import needed
  const builtinItems = OFFICIAL_PACKS.map(op => {
    const isActive   = op.id === state.activePackId;
    const loadedPack = state.packs.find(p => p.id === op.id);
    const label      = op.faction + (op.subfaction ? ' · ' + op.subfaction : '');
    const unitCnt    = loadedPack ? (loadedPack.units || []).length : '–';
    const stratCnt   = loadedPack ? (loadedPack.stratagems || []).length : '–';
    const metaText   = loadedPack
      ? `v${esc(op.pack_version)} · ${esc(op.game_version)} · ${unitCnt} 单位 · ${stratCnt} 战略`
      : `v${esc(op.pack_version)} · ${esc(op.game_version)} · 点击激活自动加载`;
    return `
      <div class="pack-item ${isActive ? 'is-active-pack' : ''}" data-activate-builtin="${esc(op.id)}">
        <div class="pack-radio">${isActive ? '✓' : ''}</div>
        <div class="pack-item-info">
          <div class="pack-item-name">${esc(label)}</div>
          <div class="pack-item-meta">${metaText}</div>
        </div>
        <span class="pack-official-badge">内置</span>
      </div>`;
  }).join('');

  // User-imported packs (official ones excluded)
  const userPacks = state.packs.filter(p => !OFFICIAL_PACK_IDS.has(p.id));
  const userPacksHtml = userPacks.length === 0
    ? `<div style="padding:10px 0 4px;font-size:12px;color:var(--text-muted)">暂无自定义规则包 — 点击下方按钮导入</div>`
    : userPacks.map(p => {
        const isActive = p.id === state.activePackId;
        const unitCnt  = (p.units || []).length;
        const stratCnt = (p.stratagems || []).length;
        return `
          <div class="pack-item ${isActive ? 'is-active-pack' : ''}" data-activate-pack="${esc(p.id)}">
            <div class="pack-radio">${isActive ? '✓' : ''}</div>
            <div class="pack-item-info">
              <div class="pack-item-name">${esc(p.faction)}${p.subfaction ? ' · '+esc(p.subfaction) : ''}</div>
              <div class="pack-item-meta">v${esc(p.pack_version)} · ${esc(p.game_version || '')} · ${unitCnt} 单位 · ${stratCnt} 战略</div>
            </div>
            <button class="pack-del-btn" data-delete-pack="${esc(p.id)}" title="删除此规则包">🗑️</button>
          </div>`;
      }).join('');

  return `
    <div class="app-header">
      <div class="header-left">
        <button class="back-btn" id="btn-back">←</button>
        <div class="header-titles">
          <div class="header-title">规则包管理</div>
          <div class="header-subtitle">Rules Pack Management</div>
        </div>
      </div>
    </div>

    <div class="main-content">
      <div class="section-heading">📦 内置规则包</div>
      <div class="pack-list">${builtinItems}</div>

      <div class="section-heading">🗂 自定义规则包</div>
      <div class="pack-list">${userPacksHtml}</div>

      <div class="section-heading">🔧 数据操作</div>
      <div class="manage-actions">
        <button class="btn btn-secondary btn-full" id="btn-export-data">📥 导出全部数据（备份）</button>
        <button class="btn btn-danger btn-full"    id="btn-clear-used-manage">🔄 清空所有已用标记</button>
      </div>
    </div>

    <div class="bottom-bar">
      <button class="btn btn-primary" id="btn-open-import">📂 导入自定义规则包</button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// IMPORT MODAL
// ─────────────────────────────────────────────────────────────────
function openImportModal() {
  closeModal();

  const isPaste = state.importTab === 'paste';

  const html = `
    <div class="modal-backdrop" id="import-modal">
      <div class="modal-sheet">
        <div class="modal-header">
          <span class="modal-title">📂 导入规则包</span>
          <button class="modal-close-btn" id="modal-close">✕</button>
        </div>

        <div class="import-tabs">
          <button class="import-tab-btn ${!isPaste ? 'active' : ''}" data-tab="file">选择文件</button>
          <button class="import-tab-btn ${isPaste  ? 'active' : ''}" data-tab="paste">粘贴 JSON</button>
        </div>

        <div id="tab-file" class="import-panel ${!isPaste ? 'active' : ''}">
          <label class="file-drop-area" for="file-input">
            <div class="file-drop-icon">📁</div>
            <div class="file-drop-text">点击选择 rules-pack.json 文件</div>
            <div class="file-selected-name" id="file-selected-name"></div>
            <input type="file" id="file-input" accept=".json,application/json">
          </label>
          <button class="btn btn-primary btn-full" id="btn-import-file" disabled>导入</button>
        </div>

        <div id="tab-paste" class="import-panel ${isPaste ? 'active' : ''}">
          <textarea class="json-input" id="json-paste" placeholder='在此粘贴 rules-pack.json 内容...'></textarea>
          <button class="btn btn-primary btn-full" id="btn-import-paste">解析并导入</button>
        </div>

        <button class="btn btn-ghost btn-full" id="modal-cancel" style="margin-top:10px">取消</button>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
  bindModalEvents();
}

function closeModal() {
  const m = document.getElementById('import-modal');
  if (m) m.remove();
}

function bindModalEvents() {
  const modal = document.getElementById('import-modal');
  if (!modal) return;

  // Backdrop click
  modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

  document.getElementById('modal-close')?.addEventListener('click',  closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);

  // Tab switching (no re-render — just toggle panels)
  modal.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      state.importTab = tab;
      modal.querySelectorAll('.import-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
      modal.querySelectorAll('.import-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${tab}`));
    });
  });

  // File input
  const fileInput = document.getElementById('file-input');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      document.getElementById('file-selected-name').textContent = file.name;
      const importBtn = document.getElementById('btn-import-file');
      if (importBtn) { importBtn.disabled = false; importBtn.dataset.filename = file.name; }
    });
  }

  document.getElementById('btn-import-file')?.addEventListener('click', async () => {
    const file = document.getElementById('file-input')?.files[0];
    if (!file) return;
    await importFromFile(file);
  });

  document.getElementById('btn-import-paste')?.addEventListener('click', () => {
    const text = document.getElementById('json-paste')?.value || '';
    importFromText(text.trim());
  });
}

// ================================================================
// EVENT BINDING — app-level (event delegation)
// ================================================================

function bindAppEvents() {
  const app = document.getElementById('app');
  if (app.dataset.eventsBound === 'true') return;
  app.addEventListener('click', handleAppClick);
  app.addEventListener('input', handleAppInput);
  app.addEventListener('change', handleAppChange);
  app.addEventListener('compositionstart', handleCompositionStart);
  app.addEventListener('compositionend', handleCompositionEnd);
  app.dataset.eventsBound = 'true';
}

// ── IME composition helpers ──

let _isComposing = false;
let _searchTimer = null;

function handleCompositionStart() { _isComposing = true; }

function handleCompositionEnd(e) {
  _isComposing = false;
  const target = e.target;
  if (target && (target.id === 'home-search' || target.id === 'search-input')) {
    state.searchQuery = target.value || '';
    const wasFocused = document.activeElement === target;
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      renderApp();
      if (wasFocused) {
        requestAnimationFrame(() => {
          const input = document.getElementById('home-search') || document.getElementById('search-input');
          if (input && document.activeElement !== input) {
            input.focus();
            const len = input.value.length;
            input.setSelectionRange(len, len);
          }
        });
      }
    }, 250);
  }
}

// ── Input handling ──

function handleAppInput(e) {
  const target = e.target;
  if (target.id === 'roster-search') {
    state.rosterQuery = target.value || '';
    renderApp();
    return;
  }
  if (target.id === 'search-input' || target.id === 'home-search') {
    if (_isComposing) return; // skip during IME composition
    state.searchQuery = target.value || '';
    const wasFocused = document.activeElement === target;
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      renderApp();
      // Restore focus and cursor after DOM rebuild
      if (wasFocused) {
        requestAnimationFrame(() => {
          const input = document.getElementById('home-search') || document.getElementById('search-input');
          if (input && document.activeElement !== input) {
            input.focus();
            const len = input.value.length;
            input.setSelectionRange(len, len);
          }
        });
      }
    }, 250);
  }
}

function handleAppChange(e) {
  const target = e.target;
  if (target.id === 'detachment-filter') {
    state.detachmentFilter = target.value || 'all';
    renderApp();
    return;
  }
}

function handleAppClick(e) {
  const t = e.target;

  // Guard: text nodes and SVG elements may lack closest()
  if (!t || typeof t.closest !== 'function') return;

  // Never intercept clicks on <summary> — let native <details> toggle work
  if (t.tagName === 'SUMMARY' || t.closest('summary')) return;

  // Back buttons
  if (t.closest('#btn-back')) {
    navigate(state.prevView === 'phase' ? 'home' : (state.prevView || 'home'));
    return;
  }

  // Clear search
  if (t.closest('#btn-clear-search')) {
    state.searchQuery = '';
    renderApp();
    return;
  }

  // Manage navigation
  if (t.closest('#hdr-manage') || t.closest('#btn-open-manage')) {
    navigate('manage');
    return;
  }

  if (t.closest('#btn-open-roster')) {
    if (!getActivePack()) {
      toast('请先导入并激活规则包', 'info');
      return;
    }
    navigate('roster');
    return;
  }

  // Import modal
  if (t.closest('#btn-open-import')) {
    openImportModal();
    return;
  }

  // Phase buttons
  const phaseBtn = t.closest('.phase-btn');
  if (phaseBtn) {
    navigate('phase', { phase: phaseBtn.dataset.phase });
    return;
  }

  const turnContextBtn = t.closest('[data-turn-context]');
  if (turnContextBtn) {
    state.turnContext = turnContextBtn.dataset.turnContext === 'enemy' ? 'enemy' : 'friendly';
    state.filter = 'all';
    state.detachmentFilter = 'all';
    renderApp();
    return;
  }

  const chip = t.closest('.filter-chip');
  if (chip) {
    state.filter = chip.dataset.filter;
    renderApp();
    return;
  }

  const rosterUnit = t.closest('[data-roster-unit-id]');
  if (rosterUnit) {
    toggleRosterUnit(rosterUnit.dataset.rosterUnitId);
    return;
  }

  // Used toggle
  const usedBtn = t.closest('[data-used-id]');
  if (usedBtn) {
    e.stopPropagation();
    toggleUsed(usedBtn.dataset.usedId);
    return;
  }

  // Clear used
  if (t.closest('#btn-clear-used') || t.closest('#btn-clear-used-manage')) {
    clearAllUsed();
    return;
  }

  // Round dec / inc
  if (t.closest('#round-dec')) { adjustRound(-1); return; }
  if (t.closest('#round-inc')) { adjustRound(+1); return; }

  // Built-in pack activate (lazy-load on first click, then activate)
  const activateBuiltinEl = t.closest('[data-activate-builtin]');
  if (activateBuiltinEl) {
    activateBuiltinPack(activateBuiltinEl.dataset.activateBuiltin);
    return;
  }

  // Pack activate
  const activateEl = t.closest('[data-activate-pack]');
  if (activateEl && !t.closest('[data-delete-pack]')) {
    setActivePack(activateEl.dataset.activatePack);
    return;
  }

  // Pack delete
  const deleteEl = t.closest('[data-delete-pack]');
  if (deleteEl) {
    e.stopPropagation();
    deletePack(deleteEl.dataset.deletePack);
    return;
  }

  // Export / download
  if (t.closest('#btn-export-data'))  { exportData();       return; }
  if (t.closest('#btn-import-sample')) { importSamplePack(); return; }
  if (t.closest('#btn-dl-sample'))    { downloadSample();   return; }
  if (t.closest('#btn-roster-select-all')) { selectAllRosterUnits(); return; }
  if (t.closest('#btn-roster-clear-all')) { clearRosterUnits(); return; }
  if (t.closest('#btn-roster-done')) { navigate('home'); return; }
}

// ================================================================
// ROUND MANAGEMENT
// ================================================================

function adjustRound(delta) {
  const next = state.round + delta;
  if (next < 1 || next > 5) return;
  state.round = next;
  persistState();
  // Update display without full re-render for smoothness
  const display = document.getElementById('round-display');
  if (display) {
    display.textContent = state.round;
  } else {
    renderApp();
  }
}

// ================================================================
// USED ABILITIES
// ================================================================

function toggleUsed(id) {
  if (!id) return;
  if (state.usedAbilities.has(id)) {
    state.usedAbilities.delete(id);
  } else {
    state.usedAbilities.add(id);
  }
  persistState();
  renderApp();
}

function clearAllUsed() {
  if (state.usedAbilities.size === 0) {
    toast('已用标记本就是空的', 'info');
    return;
  }
  state.usedAbilities.clear();
  persistState();
  toast('✓ 已清空所有标记', 'success');
  renderApp();
}

function toggleRosterUnit(unitId) {
  const pack = getActivePack();
  if (!pack || !unitId) return;

  const selectedUnitIds = getEffectiveSelectedUnitIds(pack);
  if (selectedUnitIds.has(unitId)) selectedUnitIds.delete(unitId);
  else selectedUnitIds.add(unitId);

  setSelectedUnitsForPack(pack.id, selectedUnitIds);
  renderApp();
}

function selectAllRosterUnits() {
  const pack = getActivePack();
  if (!pack) return;
  setSelectedUnitsForPack(pack.id, new Set(getPackUnits(pack).map(unit => unit.id)));
  toast('✓ 已选中全部单位', 'success');
  renderApp();
}

function clearRosterUnits() {
  const pack = getActivePack();
  if (!pack) return;
  setSelectedUnitsForPack(pack.id, new Set());
  toast('✓ 已清空单位筛选', 'success');
  renderApp();
}

// ================================================================
// PACK MANAGEMENT
// ================================================================

async function importFromFile(file) {
  try {
    const text = await file.text();
    importFromText(text);
  } catch (err) {
    toast(`读取文件失败: ${err.message}`, 'error');
  }
}

async function importFromText(text) {
  if (!text) { toast('请先粘贴 JSON 内容', 'error'); return; }
  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    toast(`JSON 解析错误: ${err.message}`, 'error');
    return;
  }

  const validErr = validatePack(data);
  if (validErr) { toast(`规则包校验失败: ${validErr}`, 'error'); return; }

  try {
    await DB.put(data);
    state.packs = await DB.getAll();
    if (!state.activePackId || !state.packs.find(p => p.id === state.activePackId)) {
      state.activePackId = data.id;
    }
    persistState();
    closeModal();
    toast(`✓ 规则包「${data.faction}」导入成功`, 'success');
    renderApp();
  } catch (err) {
    toast(`保存规则包失败: ${err.message}`, 'error');
  }
}

async function importSamplePack() {
  let data = null;

  try {
    const resp = await fetch('./sample-rules-pack.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.json();
  } catch (_) {
    data = window.BC_SAMPLE_PACK || null;
  }

  if (!data) {
    toast('样例规则包不可用', 'error');
    return;
  }

  try {
    await DB.put(data);
    state.packs = await DB.getAll();
    state.activePackId = data.id;
    persistState();
    toast(`✓ 已载入样例规则包「${data.faction}」`, 'success');
    renderApp();
  } catch (err) {
    toast(`载入样例规则包失败: ${err.message}`, 'error');
  }
}

function setActivePack(id) {
  if (state.activePackId === id) return;
  state.activePackId = id;
  persistState();
  toast('✓ 已切换激活规则包', 'success');
  renderApp();
}

async function activateBuiltinPack(id) {
  const meta = OFFICIAL_PACKS.find(p => p.id === id);
  if (!meta) return;

  const cached = state.packs.find(p => p.id === id);

  // Read from inline global (window.BC_BUILTIN_PACKS), works on file:// too
  const inlineData = window.BC_BUILTIN_PACKS && window.BC_BUILTIN_PACKS[id];
  if (inlineData) {
    try {
      if (cached && JSON.stringify(cached) === JSON.stringify(inlineData)) {
        setActivePack(id);
        return;
      }

      await DB.put(inlineData);
      state.packs = await DB.getAll();
      state.activePackId = id;
      persistState();
      toast(`✓ 已${cached ? '更新并激活' : '激活'}「${inlineData.faction}${inlineData.subfaction ? ' · ' + inlineData.subfaction : ''}」`, 'success');
      renderApp();
    } catch (err) {
      toast(`激活内置规则包失败: ${err.message}`, 'error');
    }
    return;
  }

  if (cached) {
    setActivePack(id);
    return;
  }

  // Fallback: fetch (HTTP server)
  toast('正在加载内置规则包...', 'info', 5000);
  try {
    const resp = await fetch(meta.path, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    await DB.put(data);
    state.packs = await DB.getAll();
    state.activePackId = id;
    persistState();
    toast(`✓ 已激活「${data.faction}${data.subfaction ? ' · ' + data.subfaction : ''}」`, 'success');
    renderApp();
  } catch (err) {
    toast(`加载内置规则包失败: ${err.message}`, 'error');
  }
}

async function deletePack(id) {
  if (OFFICIAL_PACK_IDS.has(id)) {
    toast('官方内置规则包不可删除', 'info');
    return;
  }
  const pack = state.packs.find(p => p.id === id);
  if (!pack) return;
  if (!confirm(`确定删除规则包「${pack.faction}」？\n(此操作不可撤销)`)) return;

  try {
    await DB.remove(id);
    state.packs = state.packs.filter(p => p.id !== id);
    delete state.selectedUnitsByPack[id];
    if (state.activePackId === id) {
      state.activePackId = state.packs[0]?.id || null;
    }
    persistState();
    toast('规则包已删除', 'info');
    renderApp();
  } catch (err) {
    toast(`删除失败: ${err.message}`, 'error');
  }
}

// ================================================================
// EXPORT / DOWNLOAD
// ================================================================

function exportData() {
  const payload = {
    app:         'BecomeChampion',
    version:     APP_VERSION,
    exported_at: new Date().toISOString(),
    packs:       state.packs,
    state: {
      activePackId:  state.activePackId,
      round:         state.round,
      usedAbilities: [...state.usedAbilities],
      selectedUnitsByPack: state.selectedUnitsByPack,
    },
  };
  triggerDownload(
    JSON.stringify(payload, null, 2),
    `bc-backup-${new Date().toISOString().slice(0, 10)}.json`
  );
  toast('✓ 数据已导出', 'success');
}

function downloadSample() {
  const pack = window.BC_SAMPLE_PACK || null;
  if (!pack) {
    toast('示例规则包不可用', 'error');
    return;
  }
  triggerDownload(
    JSON.stringify(pack, null, 2),
    'sample-rules-pack-black-templars.json'
  );
  toast('✓ 示例规则包已下载', 'success');
}

function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ================================================================
// SECURITY — HTML escape helper
// ================================================================

function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ================================================================
// SERVICE WORKER REGISTRATION
// ================================================================

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('[BC] Service Worker registered'))
      .catch(err => console.info('[BC] SW unavailable (expected on file://):', err.message));
  }
}

// ================================================================
// SAMPLE PACK — Space Marines / Ultramarines (10th Edition)
// Summaries only — not official text; for reference & prompting.
// ================================================================

const SAMPLE_PACK = {
  "id": "sm-ultramarines-10th-v1.0",
  "faction": "星际战士",
  "subfaction": "极限战士",
  "game_version": "10th Edition",
  "pack_version": "1.0.0",
  "date": "2026-03-17",
  "author": "Community",
  "source_note": "本规则包仅含能力摘要与提示，非官方原文。请以官方 Codex 为准。",
  "units": [
    {
      "id": "all-sm",
      "name": "所有星际战士单位",
      "keywords": ["ADEPTUS ASTARTES"],
      "abilities": [
        {
          "id": "sm-and-they-shall-know-no-fear",
          "name": "无惧之士",
          "phases": ["battleshock"],
          "timing": "战斗冲击阶段",
          "type": "passive",
          "summary": "本单位进行 Battle-shocked 测试时，若领袖模型存活，则测试自动通过。",
          "source": "Codex: Space Marines",
          "priority": 4
        },
        {
          "id": "sm-armour-of-contempt",
          "name": "蔑视之甲",
          "phases": ["shooting", "fight"],
          "timing": "敌方攻击本单位时（结算前）",
          "type": "passive",
          "summary": "敌方攻击本单位时，将该次攻击的 AP 特性提高 1（如 AP-2 变为 AP-1；AP-1 变为 AP0）。",
          "source": "Codex: Space Marines",
          "priority": 3
        },
        {
          "id": "sm-bolter-discipline",
          "name": "枪法纪律",
          "phases": ["shooting"],
          "timing": "射击阶段 — 选择本单位射击时",
          "type": "passive",
          "summary": "本单位装备 BOLT 武器时，若本回合未移动或仅保持静止，RAPID FIRE 武器的额外射击次数加倍。",
          "source": "Codex: Space Marines",
          "priority": 2
        }
      ]
    },
    {
      "id": "captain",
      "name": "队长 (Captain)",
      "keywords": ["步兵", "角色", "队长"],
      "abilities": [
        {
          "id": "captain-rites-of-battle",
          "name": "战斗礼仪",
          "phases": ["command"],
          "timing": "你的指挥阶段",
          "type": "active",
          "once_per": "turn",
          "summary": "选择本模型 12\" 范围内 1 支友军 ADEPTUS ASTARTES 单位。直至下一个你的指挥阶段，该单位所有命中骰可重掷。",
          "source": "Codex: Space Marines",
          "priority": 3
        }
      ]
    },
    {
      "id": "chaplain",
      "name": "修士 (Chaplain)",
      "keywords": ["步兵", "角色", "修士"],
      "abilities": [
        {
          "id": "chaplain-litany",
          "name": "战斗颂词",
          "phases": ["command"],
          "timing": "你的指挥阶段",
          "type": "active",
          "once_per": "turn",
          "summary": "宣告并激活一段颂词（需掷骰 3+ 成功）。各颂词效果不同，可增益命中、伤亡、或给予特殊规则。",
          "source": "Codex: Space Marines",
          "priority": 2
        },
        {
          "id": "chaplain-zealot",
          "name": "狂热信仰",
          "phases": ["charge", "fight"],
          "timing": "冲锋阶段 / 近战阶段",
          "type": "passive",
          "summary": "本单位在冲锋阶段宣告冲锋后，冲锋移动距离 +1\"。在近战阶段，本单位命中骰重掷 1。",
          "source": "Codex: Space Marines"
        }
      ]
    },
    {
      "id": "librarian",
      "name": "档案员 (Librarian)",
      "keywords": ["步兵", "角色", "心能师"],
      "abilities": [
        {
          "id": "librarian-smite",
          "name": "打击 (Smite)",
          "phases": ["shooting"],
          "timing": "你的射击阶段",
          "type": "active",
          "once_per": "turn",
          "summary": "投 D6：4-5 对最近可见单位造成 D3 致命伤害；6 造成 D6 致命伤害。",
          "source": "Core Rules (Psychic)"
        },
        {
          "id": "librarian-hood",
          "name": "心能兜帽",
          "phases": ["shooting"],
          "timing": "敌方使用心能能力时",
          "type": "reaction",
          "summary": "友军 6\" 内有档案员时，可尝试阻断敌方心能（投 D6 ≥ 敌方触发骰即成功）。",
          "source": "Codex: Space Marines"
        }
      ]
    },
    {
      "id": "intercessors",
      "name": "中间者小队 (Intercessors)",
      "keywords": ["步兵", "ADEPTUS ASTARTES"],
      "abilities": [
        {
          "id": "intercessors-obj-secured",
          "name": "目标确保 (Objective Secured)",
          "phases": ["any"],
          "type": "passive",
          "summary": "本单位控制目标时，无论敌方单位数量，只要敌方无同类能力，则本单位视为控制该目标。",
          "source": "Core Rules"
        }
      ]
    },
    {
      "id": "assault-intercessors",
      "name": "突击中间者 (Assault Intercessors)",
      "keywords": ["步兵", "ADEPTUS ASTARTES"],
      "abilities": [
        {
          "id": "assault-int-righteous",
          "name": "义愤之战",
          "phases": ["fight"],
          "timing": "近战阶段 — 对 CHAOS 单位攻击时",
          "type": "passive",
          "summary": "本单位对 CHAOS 关键词单位进行近战攻击时，命中骰可重掷。",
          "source": "Codex: Space Marines"
        }
      ]
    },
    {
      "id": "dreadnought",
      "name": "噩梦机甲 (Dreadnought)",
      "keywords": ["载具", "ADEPTUS ASTARTES"],
      "abilities": [
        {
          "id": "dreadnought-duty-eternal",
          "name": "永恒职责",
          "phases": ["shooting", "fight"],
          "timing": "敌方攻击本单位，结算伤害时",
          "type": "passive",
          "summary": "凡对本单位的攻击，其伤害（Damage）值减少 1（最低为 1）。",
          "source": "Codex: Space Marines",
          "priority": 2
        }
      ]
    },
    {
      "id": "lieutenant",
      "name": "副官 (Lieutenant)",
      "keywords": ["步兵", "角色", "副官"],
      "abilities": [
        {
          "id": "lieutenant-tactical-precision",
          "name": "战术精准",
          "phases": ["shooting", "fight"],
          "timing": "友军单位在本模型 6\" 内攻击时",
          "type": "passive",
          "summary": "6\" 内友军 ADEPTUS ASTARTES 单位的攻击，伤亡骰可重掷 1。",
          "source": "Codex: Space Marines",
          "priority": 2
        }
      ]
    }
  ],
  "stratagems": [
    {
      "id": "strat-honour-chapter",
      "name": "荣耀战团",
      "cp_cost": 2,
      "phases": ["fight"],
      "timing": "近战阶段 — 选择己方单位并宣告攻击目标后",
      "target": "1 支己方 ADEPTUS ASTARTES 步兵或骑乘单位",
      "effect": "该单位近战武器获得 [SUSTAINED HITS 2] 和 [LETHAL HITS]，直至本次攻击序列结束。",
      "source": "Codex: Space Marines",
      "once_per": "phase",
      "tags": ["fight", "damage"]
    },
    {
      "id": "strat-rapid-fire",
      "name": "急速射击",
      "cp_cost": 1,
      "phases": ["shooting"],
      "timing": "射击阶段 — 选择己方单位，用 BOLT 武器射击时",
      "target": "1 支装备 BOLT 武器的己方 ADEPTUS ASTARTES 单位",
      "effect": "本单位 BOLT 武器攻击中，每个未修正的命中骰 6 额外产生 1 次命中。",
      "source": "Codex: Space Marines",
      "tags": ["shooting", "bolt"]
    },
    {
      "id": "strat-armoured-resilience",
      "name": "坚甲韧性",
      "cp_cost": 1,
      "phases": ["shooting", "fight"],
      "timing": "敌方单位攻击己方 ADEPTUS ASTARTES 单位，结算伤害之前",
      "target": "1 支己方 ADEPTUS ASTARTES 单位",
      "effect": "该单位受到的所有攻击伤害（Damage）减少 1（最低 1）。",
      "source": "Codex: Space Marines",
      "tags": ["defense"]
    },
    {
      "id": "strat-transhuman",
      "name": "超人生理",
      "cp_cost": 1,
      "phases": ["shooting", "fight"],
      "timing": "敌方攻击己方单位，投伤亡骰之前",
      "target": "1 支己方 ADEPTUS ASTARTES 步兵单位",
      "effect": "对方对该单位的伤亡骰须掷出 4+ 才能成功（无视任何使3+或更佳的能力）。",
      "source": "Codex: Space Marines",
      "tags": ["defense", "wound roll"]
    },
    {
      "id": "strat-insane-bravery",
      "name": "疯狂勇气",
      "cp_cost": 1,
      "phases": ["battleshock"],
      "timing": "战斗冲击阶段 — 己方单位须进行 Battle-shocked 测试之前",
      "target": "1 支己方 ADEPTUS ASTARTES 单位",
      "effect": "该单位自动通过本次 Battle-shocked 测试。",
      "source": "Codex: Space Marines",
      "tags": ["morale"]
    },
    {
      "id": "strat-veteran-fighters",
      "name": "老兵斗士",
      "cp_cost": 1,
      "phases": ["fight"],
      "timing": "近战阶段 — 敌方单位攻击己方单位，结算伤害之前",
      "target": "1 支己方 ADEPTUS ASTARTES 步兵单位",
      "effect": "该单位在本轮近战阶段获得 5+ 无视伤害（Feel No Pain）。",
      "source": "Codex: Space Marines",
      "tags": ["fight", "defense"]
    },
    {
      "id": "strat-tactical-retreat",
      "name": "战术撤退",
      "cp_cost": 1,
      "phases": ["movement"],
      "timing": "移动阶段 — 选择己方单位进行撤退移动时",
      "target": "1 支己方 ADEPTUS ASTARTES 单位",
      "effect": "该单位执行 Fall Back 后，本回合仍可进行射击（不可冲锋）。",
      "source": "Codex: Space Marines",
      "tags": ["movement"]
    },
    {
      "id": "strat-only-in-death",
      "name": "唯有死亡方能解脱义务",
      "cp_cost": 2,
      "phases": ["fight"],
      "timing": "近战阶段 — 己方 CHARACTER 模型在攻击序列前被消灭时",
      "target": "1 支即将被消灭的己方 ADEPTUS ASTARTES CHARACTER 单位",
      "effect": "该模型被移除前，可立即执行一次完整近战攻击序列（含全部攻击次数）。",
      "source": "Codex: Space Marines",
      "once_per": "phase",
      "tags": ["fight", "character"]
    },
    {
      "id": "strat-squad-tactics",
      "name": "小队战术",
      "cp_cost": 1,
      "phases": ["command"],
      "timing": "你的指挥阶段",
      "target": "1 支己方 ADEPTUS ASTARTES 步兵单位",
      "effect": "该单位进行整队（Regroup），可以从 Battle-shocked 状态中恢复（自动）。",
      "source": "Codex: Space Marines",
      "tags": ["command", "morale"]
    }
  ],
  "detachment_rules": [
    {
      "id": "dr-oath-of-moment",
      "name": "时刻之誓",
      "phases": ["command"],
      "timing": "你的指挥阶段开始时（每回合必须执行）",
      "summary": "选择 1 支敌方单位。直至下一个你的指挥阶段，你所有 ADEPTUS ASTARTES 单位攻击该目标单位时，命中骰与伤亡骰均可重掷。",
      "source": "Codex: Ultramarines",
      "priority": 10
    }
  ],
  "enhancements": [
    {
      "id": "enh-adept-of-codex",
      "name": "法典精通者",
      "phases": ["command"],
      "timing": "你的指挥阶段",
      "summary": "装备此强化的角色可额外施展一次战斗礼仪（Rites of Battle），选择一支不同的友军单位。",
      "source": "Codex: Ultramarines"
    },
    {
      "id": "enh-nobility-manifest",
      "name": "高贵化身",
      "phases": ["command"],
      "timing": "你的指挥阶段 — 执行时刻之誓时",
      "summary": "装备者执行时刻之誓时，可额外选择 1 支敌方单位（合计 2 个目标）。",
      "source": "Codex: Ultramarines"
    }
  ]
};

// ================================================================
// INIT
// ================================================================

async function init() {
  try {
    await DB.open();
    restoreState();
    state.packs = await DB.getAll();

    // Validate active pack still exists
    if (state.activePackId && !state.packs.find(p => p.id === state.activePackId)) {
      state.activePackId = state.packs[0]?.id || null;
      persistState();
    }

    registerSW();
    renderApp();
  } catch (err) {
    console.error('[BC] Init failed:', err);
    document.getElementById('app').innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  min-height:100vh;padding:32px;text-align:center;gap:12px;">
        <div style="font-size:56px">⚠️</div>
        <div style="font-size:18px;color:#ef9a9a;font-weight:700">应用加载失败</div>
        <div style="font-size:13px;color:#606070">请刷新页面重试</div>
        <div style="font-size:11px;color:#404050;word-break:break-all;max-width:400px">${esc(err.message)}</div>
      </div>`;
  }
}

window.addEventListener('DOMContentLoaded', init);
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const source = $('source-text');
  const SETTINGS_STORAGE_KEY = 'typo-fix.api-settings';
  const state = { apiKey: '', baseUrl: TypoAPI.DEFAULT_BASE_URL, model: TypoAPI.DEFAULT_MODEL, configured: false, mode: 'typo', review: null, accepted: new Set(), busy: false, controller: null, tab: 'diff', demo: false };
  const EXAMPLE = '大家好，明天下午三点我们在会议室开会，请提前作好准备。\n这次主要讨伦新项目的进展，以及接下来的工作按排。\n如果有任何问题，欢迎随时于我联系。辛苦大家！';
  const CORRECTED_EXAMPLE = '大家好，明天下午三点我们在会议室开会，请提前做好准备。\n这次主要讨论新项目的进展，以及接下来的工作安排。\n如果有任何问题，欢迎随时与我联系。辛苦大家！';
  let toastTimer;

  function message(text, error = false) {
    $('message').textContent = text;
    $('message').classList.toggle('error', error);
    $('message').hidden = !text;
  }
  function toast(text) {
    clearTimeout(toastTimer);
    $('toast').textContent = text;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2800);
  }
  function confirmAction(text, title = '替换当前文本？') {
    $('confirm-title').textContent = title;
    $('confirm-description').textContent = text;
    const dialog = $('confirm-dialog');
    dialog.returnValue = '';
    dialog.showModal();
    $('confirm-cancel').focus();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true }));
  }
  $('confirm-cancel').addEventListener('click', () => $('confirm-dialog').close('cancel'));
  $('confirm-ok').addEventListener('click', () => $('confirm-dialog').close('ok'));

  function updateControls() {
    $('character-count').textContent = source.value.length.toLocaleString();
    $('correct-button').disabled = state.busy || !source.value.trim();
    $('correct-button').classList.toggle('is-loading', state.busy);
    $('correct-label').textContent = state.busy ? '正在校对…' : state.review ? '重新纠错' : 'AI 自动纠错';
    $('clear-input').disabled = state.busy || !source.value;
    $('load-example').disabled = state.busy;
    $('open-settings').disabled = state.busy;
    $('preview-example').disabled = state.busy;
    $('cancel-request').hidden = !state.busy;
    source.readOnly = state.busy;
    source.setAttribute('aria-busy', String(state.busy));
    document.querySelectorAll('.mode-button').forEach(button => { button.disabled = state.busy; });
    if (state.review) updateDecisions();
  }
  function clearReview() {
    state.review = null;
    state.accepted.clear();
    state.demo = false;
    $('review-card').hidden = true;
    $('review-tools').hidden = true;
    $('empty-state').hidden = false;
    $('review-badge').textContent = '等待校对';
    $('review-badge').classList.remove('ready');
    $('review-description').textContent = '对照原文，选择你想保留的修改。';
    $('diff-rows').replaceChildren();
    $('result-text').textContent = '';
    setTab('diff');
  }
  function replaceInput(text) {
    source.value = text;
    clearReview();
    message('');
    updateControls();
    source.focus();
  }
  source.addEventListener('input', () => {
    if (state.review) {
      clearReview();
      message('原文已更新，请重新纠错以获取对应的修改建议。');
    } else message('');
    updateControls();
  });
  $('load-example').addEventListener('click', async () => {
    if (source.value && source.value !== EXAMPLE && !await confirmAction('插入示例会替换当前输入并清除审阅结果。')) return;
    replaceInput(EXAMPLE);
  });
  $('clear-input').addEventListener('click', () => {
    replaceInput('');
  });
  $('preview-example').addEventListener('click', async () => {
    if (source.value && source.value !== EXAMPLE && !await confirmAction('示例预览会替换当前输入并展示内置的纠错结果。')) return;
    replaceInput(EXAMPLE);
    showReview(EXAMPLE, CORRECTED_EXAMPLE, true);
    message('这是内置示例，未调用 API。点击高亮文字，试试逐处采纳。');
  });
  document.querySelectorAll('.mode-button').forEach(button => button.addEventListener('click', () => {
    state.mode = button.dataset.mode;
    document.querySelectorAll('.mode-button').forEach(item => {
      const selected = item === button;
      item.classList.toggle('active', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
    if (state.review) message('模式已切换，下次纠错时生效。当前审阅结果保持不变。');
  }));

  function updateSettingsIndicator() {
    $('key-indicator').hidden = !state.configured;
    $('open-settings').setAttribute('aria-label', state.configured ? 'API 设置，已配置接口' : 'API 设置');
  }
  function restoreSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
      if (!saved || typeof saved.apiKey !== 'string' || /\s/.test(saved.apiKey)) return;
      TypoAPI.resolveEndpoint(saved.baseUrl);
      const model = TypoAPI.validateModel(saved.model);
      state.apiKey = saved.apiKey;
      state.baseUrl = saved.baseUrl.trim();
      state.model = model;
      state.configured = true;
    } catch {
      // Unavailable storage or invalid saved data must not prevent page startup.
    }
  }
  function openSettings() {
    $('settings-error').hidden = true;
    $('api-key').value = state.apiKey;
    $('api-key').setCustomValidity('');
    $('base-url').value = state.baseUrl;
    $('model-name').value = state.model;
    $('base-url').setCustomValidity('');
    $('model-name').setCustomValidity('');
    $('api-key').type = 'password';
    $('toggle-key').textContent = '显示';
    $('toggle-key').setAttribute('aria-label', '显示 API Key');
    $('settings-dialog').showModal();
    $('api-key').focus();
  }
  $('open-settings').addEventListener('click', openSettings);
  $('close-settings').addEventListener('click', () => $('settings-dialog').close());
  $('settings-dialog').addEventListener('close', () => {
    $('api-key').value = '';
    $('api-key').type = 'password';
    $('base-url').value = '';
    $('model-name').value = '';
  });
  $('toggle-key').addEventListener('click', () => {
    const show = $('api-key').type === 'password';
    $('api-key').type = show ? 'text' : 'password';
    $('toggle-key').textContent = show ? '隐藏' : '显示';
    $('toggle-key').setAttribute('aria-label', show ? '隐藏 API Key' : '显示 API Key');
  });
  $('clear-settings').addEventListener('click', () => {
    try { localStorage.removeItem(SETTINGS_STORAGE_KEY); }
    catch {
      $('settings-error').textContent = '无法清除浏览器中保存的配置，请检查浏览器的存储权限后重试。';
      $('settings-error').hidden = false;
      return;
    }
    state.apiKey = '';
    state.baseUrl = TypoAPI.DEFAULT_BASE_URL;
    state.model = TypoAPI.DEFAULT_MODEL;
    state.configured = false;
    updateSettingsIndicator();
    $('settings-dialog').close();
    toast('已清除保存的 API 配置');
  });
  $('settings-form').addEventListener('submit', event => {
    event.preventDefault();
    const key = $('api-key').value.trim();
    if (/\s/.test(key)) {
      $('api-key').setCustomValidity('Key 中不能包含空格或换行，请重新粘贴。');
      $('api-key').reportValidity();
      return;
    }
    const baseUrl = $('base-url').value.trim();
    let model;
    try { TypoAPI.resolveEndpoint(baseUrl); }
    catch (error) {
      $('base-url').setCustomValidity(error.message);
      $('base-url').reportValidity();
      return;
    }
    try { model = TypoAPI.validateModel($('model-name').value); }
    catch (error) {
      $('model-name').setCustomValidity(error.message);
      $('model-name').reportValidity();
      return;
    }
    state.apiKey = key;
    state.baseUrl = baseUrl;
    state.model = model;
    state.configured = true;
    let persisted = false;
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ apiKey: key, baseUrl, model }));
      persisted = true;
    } catch {
      // Keep the valid configuration usable for this page if storage is blocked.
    }
    updateSettingsIndicator();
    $('settings-dialog').close();
    toast(persisted ? '设置已保存到浏览器，刷新后自动恢复' : '浏览器无法保存配置，本次设置仅在当前页面有效');
  });
  $('api-key').addEventListener('input', () => $('api-key').setCustomValidity(''));
  $('base-url').addEventListener('input', () => $('base-url').setCustomValidity(''));
  $('model-name').addEventListener('input', () => $('model-name').setCustomValidity(''));

  async function runCorrection() {
    if (state.busy || !source.value.trim()) return;
    if (!state.configured) { openSettings(); return; }
    if (state.accepted.size && !await confirmAction('重新纠错会生成新的修改建议，并重置当前的采纳选择。', '重新校对这段文字？')) return;
    const original = source.value;
    const controller = new AbortController();
    state.controller = controller;
    state.busy = true;
    updateControls();
    message('正在逐字校对，请稍等…');
    const started = performance.now();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 90000);
    try {
      const result = await TypoAPI.correctText({ text: original, apiKey: state.apiKey, baseUrl: state.baseUrl, mode: state.mode, model: state.model, signal: controller.signal });
      if (controller.signal.aborted || source.value !== original) return;
      showReview(original, result.text);
      const seconds = ((performance.now() - started) / 1000).toFixed(1);
      const count = state.review.segments.filter(segment => segment.changed).length;
      message(count ? `校对完成，用时 ${seconds} 秒。请审阅下面的 ${count} 处修改。` : `校对完成，用时 ${seconds} 秒。没有发现需要修改的地方。`);
    } catch (error) {
      if (controller.signal.aborted) message(timedOut ? '等待超过 90 秒，请检查网络或缩短文本后重试。' : '已取消本次纠错，原文保持不变。', timedOut);
      else message(error.message || '纠错失败，请重试。', true);
    } finally {
      clearTimeout(timeout);
      state.busy = false;
      state.controller = null;
      updateControls();
    }
  }
  $('correct-button').addEventListener('click', runCorrection);
  $('cancel-request').addEventListener('click', () => state.controller?.abort());
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !document.querySelector('dialog[open]') && !event.isComposing) {
      event.preventDefault();
      runCorrection();
    }
  });

  function showReview(original, corrected, demo = false) {
    state.review = TypoCore.createReview(original, corrected);
    state.accepted = new Set();
    state.demo = demo;
    const changes = state.review.segments.filter(segment => segment.changed);
    $('empty-state').hidden = true;
    $('review-card').hidden = false;
    $('review-tools').hidden = !changes.length;
    $('review-badge').textContent = demo ? '示例预览' : changes.length ? `${changes.length} 处建议` : '未发现错误';
    $('review-badge').classList.add('ready');
    $('review-description').textContent = changes.length ? '保留你的表达，只采纳你认可的修改。' : '这段文字无需修改，可以直接复制使用。';
    $('diff-hint').textContent = state.review.coarse ? '改动较多，已合并为一个修改块。请仔细对照后采纳。' : '点击高亮文字采纳或撤回修改，也可以逐行采纳。';
    const fragment = document.createDocumentFragment();
    TypoCore.reviewRows(state.review).forEach(row => {
      const container = document.createElement('div');
      container.className = `diff-row${row.ids.length ? ' has-changes' : ''}`;
      [['left', row.oldLine], ['right', row.newLine]].forEach(([side, line]) => {
        const cell = document.createElement('div');
        cell.className = 'diff-cell';
        const number = document.createElement('span');
        number.className = 'line-number';
        number.textContent = line;
        number.setAttribute('aria-hidden', 'true');
        const content = document.createElement('div');
        content.className = 'line-content';
        row[side].forEach(part => {
          if (part.id === undefined) content.append(document.createTextNode(part.text));
          else {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `change ${side === 'left' ? 'before' : 'after'}`;
            button.dataset.change = part.id;
            if (part.text) button.textContent = part.text;
            else {
              const placeholder = document.createElement('span');
              placeholder.className = 'empty-change';
              placeholder.textContent = side === 'left' ? '新增' : '删除';
              button.append(placeholder);
            }
            content.append(button);
          }
        });
        if (!content.childNodes.length) content.textContent = '\u00a0';
        cell.append(number, content);
        if (side === 'right' && row.ids.length) {
          const action = document.createElement('button');
          action.className = 'line-action';
          action.dataset.rowChanges = row.ids.join(',');
          action.dataset.rowLine = row.oldLine;
          action.dataset.multiline = String(row.multiline);
          cell.append(action);
        }
        container.append(cell);
      });
      fragment.append(container);
    });
    $('diff-rows').replaceChildren(fragment);
    setTab('diff');
    updateControls();
  }

  function updateDecisions() {
    if (!state.review) return;
    const changes = state.review.segments.filter(segment => segment.changed);
    const map = new Map(changes.map(segment => [segment.id, segment]));
    document.querySelectorAll('[data-change]').forEach(button => {
      const id = Number(button.dataset.change);
      const accepted = state.accepted.has(id);
      const segment = map.get(id);
      button.classList.toggle('is-accepted', accepted);
      button.setAttribute('aria-pressed', String(accepted));
      const action = accepted ? '撤回' : '采纳';
      const short = text => text.length > 35 ? text.slice(0, 35) + '…' : text;
      button.title = `${action}修改：${short(segment.original) || '（空）'} → ${short(segment.corrected) || '（删除）'}`;
      button.setAttribute('aria-label', button.title);
      button.disabled = state.busy;
    });
    document.querySelectorAll('[data-row-changes]').forEach(button => {
      const allAccepted = button.dataset.rowChanges.split(',').every(id => state.accepted.has(Number(id)));
      const unit = button.dataset.multiline === 'true' ? '本组' : '本行';
      button.textContent = allAccepted ? '撤回' + unit : '采纳' + unit;
      button.setAttribute('aria-label', `${allAccepted ? '撤回' : '采纳'}第 ${button.dataset.rowLine} 行${unit === '本组' ? '所在修改组' : ''}的所有修改`);
      button.classList.toggle('accepted', allAccepted);
      button.disabled = state.busy;
    });
    $('result-text').textContent = TypoCore.resultText(state.review, state.accepted);
    $('review-progress').textContent = changes.length ? `已采纳 ${state.accepted.size} / ${changes.length} 处修改` : '原文无需修改';
    $('reset-review').disabled = state.busy || !state.accepted.size;
    $('accept-all').disabled = state.busy || state.accepted.size === changes.length;
    $('continue-editing').disabled = state.busy;
  }
  $('diff-rows').addEventListener('click', event => {
    if (state.busy || !state.review) return;
    const change = event.target.closest('[data-change]');
    const row = event.target.closest('[data-row-changes]');
    if (change) {
      const id = Number(change.dataset.change);
      if (state.accepted.has(id)) state.accepted.delete(id); else state.accepted.add(id);
    } else if (row) {
      const ids = row.dataset.rowChanges.split(',').map(Number);
      const remove = ids.every(id => state.accepted.has(id));
      ids.forEach(id => remove ? state.accepted.delete(id) : state.accepted.add(id));
    } else return;
    updateDecisions();
  });
  $('accept-all').addEventListener('click', () => {
    state.review?.segments.filter(segment => segment.changed).forEach(segment => state.accepted.add(segment.id));
    updateDecisions();
    toast('已采纳全部修改');
  });
  $('reset-review').addEventListener('click', () => { state.accepted.clear(); updateDecisions(); toast('已撤回全部修改'); });
  function setTab(tab) {
    state.tab = tab;
    ['diff', 'result'].forEach(name => {
      $(name + '-panel').hidden = name !== tab;
      $(name + '-tab').classList.toggle('active', name === tab);
      $(name + '-tab').setAttribute('aria-selected', String(name === tab));
      $(name + '-tab').tabIndex = name === tab ? 0 : -1;
    });
  }
  ['diff', 'result'].forEach(name => {
    $(name + '-tab').addEventListener('click', () => setTab(name));
    $(name + '-tab').addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const next = event.key === 'Home' ? 'diff' : event.key === 'End' ? 'result' : name === 'diff' ? 'result' : 'diff';
        setTab(next);
        $(next + '-tab').focus();
      }
    });
  });
  $('continue-editing').addEventListener('click', async () => {
    if (!state.review) return;
    const all = state.review.segments.filter(segment => segment.changed).length;
    if (state.accepted.size < all && !await confirmAction('只把已采纳的修改带回输入区，未采纳的建议将被清除。', '用当前结果继续编辑？')) return;
    replaceInput(TypoCore.resultText(state.review, state.accepted));
    source.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast('结果已放回输入区，可以继续编辑');
  });
  $('copy-result').addEventListener('click', async () => {
    if (!state.review) return;
    const text = TypoCore.resultText(state.review, state.accepted);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      const hasChanges = state.review.segments.some(segment => segment.changed);
      toast(state.accepted.size ? '已复制包含已采纳修改的文本' : hasChanges ? '已复制原文（尚未采纳修改）' : '已复制校对文本');
    } catch {
      $('copy-fallback').value = text;
      $('copy-dialog').showModal();
      $('copy-fallback').focus();
      $('copy-fallback').select();
    }
  });
  $('close-copy').addEventListener('click', () => $('copy-dialog').close());
  $('copy-dialog').addEventListener('close', () => { $('copy-fallback').value = ''; });

  // Leaving the page cancels requests without discarding the saved configuration.
  window.addEventListener('pagehide', () => state.controller?.abort());
  if (!navigator.platform.toLowerCase().includes('mac')) document.querySelector('.shortcut kbd').textContent = 'Ctrl';
  restoreSettings();
  updateSettingsIndicator();
  updateControls();
})();

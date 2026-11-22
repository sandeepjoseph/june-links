/* Searchable controls. Native selects remain the source of submitted values. */
(() => {
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}+\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  const indexedItems = new WeakMap();
  function rank(items, query) {
    const terms = normalize(query).split(' ').filter(Boolean);
    if (!terms.length) return items;
    return items.map((item, index) => {
      if (!indexedItems.has(item)) { const label = normalize(item.label), haystack = item.search || normalize([item.label,item.detail,item.keywords].join(' ')); indexedItems.set(item, {label, words:label.split(' '), haystack, hayWords:haystack.split(' ')}); }
      const {label,words,haystack,hayWords} = indexedItems.get(item);
      if (!terms.every(term => haystack.includes(term))) return null;
      const score = terms.reduce((sum, term) => sum + (label === term ? 0 : label.startsWith(term) ? 1 : words.some(word => word.startsWith(term)) ? 2 : hayWords.includes(term) ? 3 : hayWords.some(word => word.startsWith(term)) ? 4 : 6), 0);
      return {item, score, index};
    }).filter(Boolean).sort((a, b) => a.score - b.score || a.index - b.index).map(entry => entry.item);
  }
  const controls = new Map();
  let openControl = null, sequence = 0;
  function create({input, items, onSelect, onInput, restore, label, limit = Infinity, trigger, emptyText = 'No matching options. Try another word.'}) {
    const id = `june-options-${++sequence}`;
    const popup = document.createElement('div');
    popup.id = id; popup.className = 'suggestion-popup'; popup.hidden = true;
    popup.setAttribute('role', 'listbox'); popup.setAttribute('aria-label', label || 'Suggestions');
    // Popovers escape clipping containers without moving the page or taking focus.
    const topLayer = typeof popup.showPopover === 'function';
    if (topLayer) popup.setAttribute('popover', 'manual');
    document.body.append(popup);
    const status = document.createElement('span');
    status.className = 'suggestion-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    input.after(status);
    input.setAttribute('role', 'combobox'); input.setAttribute('aria-autocomplete', 'list'); input.setAttribute('aria-haspopup', 'listbox');
    input.setAttribute('aria-controls', id); input.setAttribute('aria-expanded', 'false'); input.setAttribute('autocomplete', 'off'); input.setAttribute('spellcheck', 'false');
    let options = [], active = -1, request = 0, composing = false, touchingPopup = false;
    popup.addEventListener('pointerdown', () => { touchingPopup = true; });
    document.addEventListener('pointerup', () => { setTimeout(() => { touchingPopup = false; }, 0); });
    popup.addEventListener('pointercancel', () => { touchingPopup = false; });
    function position() {
      if (popup.hidden) return false;
      const rect = input.getBoundingClientRect(), viewport = window.visualViewport;
      const top = viewport?.offsetTop || 0, bottom = top + (viewport?.height || innerHeight);
      if (!rect.height || rect.bottom < top || rect.top > bottom) { close(); return false; }
      const below = bottom - rect.bottom - 12, above = rect.top - top - 12;
      const upward = below < 200 && above > below;
      const height = Math.min(312, Math.max(80, upward ? above : below));
      popup.style.width = `${Math.min(rect.width, innerWidth - 24)}px`;
      popup.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - rect.width - 12))}px`;
      popup.style.maxHeight = `${height}px`;
      popup.style.top = upward ? 'auto' : `${rect.bottom + 6}px`;
      popup.style.bottom = upward ? `${innerHeight - rect.top + 6}px` : 'auto';
      return true;
    }
    function close() {
      request++; if (topLayer && popup.matches(':popover-open')) popup.hidePopover();
      popup.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant');
      trigger?.setAttribute('aria-expanded', 'false'); active = -1;
      if (openControl === api) openControl = null;
    }
    function choose(item) { close(); onSelect(item); }
    async function show(query = input.value) {
      if (input.disabled) return;
      openControl?.close(); openControl = api;
      const current = ++request;
      let next;
      try { next = await items(query); } catch { next = []; }
      if (current !== request || document.activeElement !== input) return;
      options = next.slice(0, limit); active = -1; popup.replaceChildren(); input.removeAttribute('aria-activedescendant');
      for (const [index, item] of options.entries()) {
        const option = document.createElement('div'); option.id = `${id}-${index}`; option.className = 'suggestion-option';
        option.setAttribute('role', 'option'); option.setAttribute('aria-selected', 'false');
        const title = document.createElement('span'); title.textContent = item.label; option.append(title);
        if (item.detail) { const detail = document.createElement('small'); detail.textContent = item.detail; option.append(detail); }
        option.addEventListener('pointerdown', event => { if (event.pointerType === 'mouse') event.preventDefault(); });
        option.addEventListener('click', () => choose(item)); popup.append(option);
      }
      if (!options.length) { const empty = document.createElement('p'); empty.textContent = emptyText; popup.append(empty); }
      popup.hidden = false;
      if (!position()) return;
      if (topLayer && !popup.matches(':popover-open')) popup.showPopover();
      input.setAttribute('aria-expanded', 'true'); trigger?.setAttribute('aria-expanded', 'true');
      status.textContent = options.length ? `${options.length} suggestions available. Use up and down arrows to review.` : emptyText;
    }
    input.addEventListener('focus', () => { if (restore) input.select(); show(restore ? '' : input.value); });
    input.addEventListener('click', () => { if (restore) input.select(); if (popup.hidden) show(restore ? '' : input.value); });
    input.addEventListener('input', () => { onInput?.(input.value); if (!composing) show(); });
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; show(); });
    input.addEventListener('keydown', event => {
      if (composing || event.isComposing) return;
      if (event.key === 'Escape') { if (!popup.hidden) { event.preventDefault(); event.stopPropagation(); close(); restore?.(); } return; }
      if (event.key === 'Tab') { close(); restore?.(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (popup.hidden) { show(restore ? '' : input.value); return; }
        if (!options.length) return;
        active = active < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) : (active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
        [...popup.children].forEach((option, index) => option.setAttribute('aria-selected', String(index === active)));
        const option = popup.children[active]; input.setAttribute('aria-activedescendant', option.id); option.scrollIntoView({block: 'nearest', behavior: 'instant'}); return;
      }
      if (event.key === 'Enter' && !popup.hidden) { event.preventDefault(); if (active >= 0) choose(options[active]); }
    });
    input.addEventListener('blur', event => { if (!popup.contains(event.relatedTarget)) setTimeout(() => { if (document.activeElement !== input && !touchingPopup && !popup.matches(':hover')) { close(); restore?.(); } }, 0); });
    trigger?.addEventListener('pointerdown', event => event.preventDefault());
    trigger?.addEventListener('click', () => { if (!popup.hidden) { close(); return; } input.focus({preventScroll: true}); show(''); });
    const api = {input, popup, close, show, position, restore}; controls.set(input, api); return api;
  }
  const selects = new Map();
  function enhance(select) {
    const wrapper = document.createElement('div'); wrapper.className = 'searchable-select';
    select.before(wrapper); wrapper.append(select);
    const input = document.createElement('input'); input.id = `${select.id}-search`; input.type = 'text'; input.className = 'select-search'; input.dataset.controlledSelect = select.id;
    input.placeholder = select.dataset.placeholder || 'Type to find an option';
    if (select.hasAttribute('aria-describedby')) input.setAttribute('aria-describedby', select.getAttribute('aria-describedby'));
    input.addEventListener('keydown', event => { if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && input.value === select.selectedOptions[0]?.textContent) input.select(); });
    const trigger = document.createElement('button'); trigger.type = 'button'; trigger.className = 'select-disclosure'; trigger.tabIndex = -1;
    trigger.setAttribute('aria-label', 'Show options'); trigger.setAttribute('aria-expanded', 'false'); trigger.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="m3 6 5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
    wrapper.append(input, trigger);
    const labels = [...select.labels]; for (const label of labels) label.htmlFor = input.id;
    const name = labels.map(label => label.textContent.trim()).join(' ') || select.getAttribute('aria-label') || 'Options';
    if (!labels.length) input.setAttribute('aria-label', name);
    trigger.setAttribute('aria-label', `Show ${name.replace(/\*/g, '').trim()} options`);
    select.hidden = true; select.tabIndex = -1;
    let optionItems;
    function optionIndex() { return optionItems ||= [...select.options].filter(option => !option.disabled).map(option => ({value:option.value,label:option.textContent,keywords:option.dataset.search,search:normalize([option.textContent,option.dataset.search].join(' ')),detail:option.dataset.detail})); }
    function sync() { input.value = select.selectedOptions[0]?.textContent || ''; input.disabled = select.disabled; trigger.disabled = select.disabled; input.required = select.required; input.setCustomValidity(''); input.classList.remove('invalid'); input.removeAttribute('aria-invalid'); }
    const api = create({input, trigger, label: name, restore: sync, limit: Number(select.dataset.suggestionLimit) || Infinity,
      items(query) { return rank(optionIndex(),query); },
      onSelect(item) { select.value = item.value; sync(); select.dispatchEvent(new Event('input', {bubbles:true})); select.dispatchEvent(new Event('change', {bubbles:true})); },
      onInput() { input.setCustomValidity(''); }
    });
    api.sync = sync; selects.set(select, api); select.addEventListener('change', sync);
    new MutationObserver(() => {optionItems=null;sync();}).observe(select, {childList:true, subtree:true, attributes:true, attributeFilter:['disabled','selected','label']}); sync();
  }
  function refresh(select) { if (select) selects.get(select)?.sync(); else for (const api of selects.values()) api.sync(); }
  function focus(element, options = {preventScroll:true}) { (selects.get(element)?.input || element)?.focus(options); }
  function validate(select) {
    const api = selects.get(select); if (!api) return null;
    api.sync(); if (select.checkValidity()) return true;
    api.input.classList.add('invalid'); api.input.setAttribute('aria-invalid','true'); api.input.setCustomValidity(select.validationMessage || 'Please choose an option.'); api.input.reportValidity(); return false;
  }
  document.addEventListener('pointerdown', event => { if (openControl && !openControl.popup.contains(event.target) && event.target !== openControl.input && !event.target.closest('.select-disclosure')) { const active = openControl; active.close(); active.restore?.(); } });
  document.addEventListener('focusin', event => { if (openControl && event.target !== openControl.input && !openControl.popup.contains(event.target)) { const active = openControl; active.close(); active.restore?.(); } });
  let positionFrame = 0;
  addEventListener('scroll', event => { if (openControl && !openControl.popup.contains(event.target) && !positionFrame) positionFrame = requestAnimationFrame(() => { positionFrame = 0; openControl?.position(); }); }, {capture:true,passive:true});
  addEventListener('resize', () => openControl?.position()); window.visualViewport?.addEventListener('resize', () => openControl?.position());
  document.addEventListener('june:venue-selected', () => refresh());
  document.addEventListener('reset', () => { openControl?.close(); queueMicrotask(() => refresh()); }, true);
  for (const select of document.querySelectorAll('select')) enhance(select);
  window.JuneControls = {create, rank, normalize, refresh, focus, validate};
  const departure = document.querySelector('#departureCity'), origin = document.querySelector('#atlas-origin');
  if (departure && origin) create({input:departure, label:'Departure cities', limit:12, items:query => rank([...origin.options].filter(option => option.value).map(option => ({label:option.textContent, value:option.value})), query), onSelect:item => { departure.value=item.value; departure.dispatchEvent(new Event('input',{bubbles:true})); }, emptyText:'Keep your city as written. We’ll plan from there.'});
})();

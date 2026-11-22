/* IANA location identifiers preserve daylight-saving rules in the trip brief. */
(() => {
  const select = document.querySelector('#timezone'), helper = document.querySelector('#timezone-help'), device = document.querySelector('#timezone-device');
  if (!select) return;
  let zones = [], pending;
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  function updateHelp() {
    if (!select.value) { helper.textContent = 'Search by city, country or time zone. Your preferred contact time is local to this zone.'; return; }
    try {
      const parts = new Intl.DateTimeFormat('en', {timeZone:select.value, timeZoneName:'longGeneric', hour:'numeric'}).formatToParts(new Date());
      const name = parts.find(part => part.type === 'timeZoneName')?.value;
      const offset = new Intl.DateTimeFormat('en', {timeZone:select.value, timeZoneName:'longOffset', hour:'numeric'}).formatToParts(new Date()).find(part => part.type === 'timeZoneName')?.value.replace('GMT','UTC');
      helper.textContent = `${name || select.value} · ${offset || 'UTC'} now. We’ll use this zone for your preferred contact time.`;
    } catch { helper.textContent = 'We’ll use your chosen city’s time zone for your preferred contact time.'; }
  }
  function load() {
    if (pending) return pending;
    pending = fetch('/assets/timezones.json?v=iana-2026f').then(response => { if (!response.ok) throw Error('Time zones unavailable'); return response.json(); }).then(data => {
      zones = data.zones;
      const value = select.value, fragment = document.createDocumentFragment();
      const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Choose your time zone'; fragment.append(blank);
      for (const zone of zones) {
        const option = document.createElement('option'); option.value = zone.id;
        option.textContent = zone.countries.length ? `${zone.city}, ${zone.countries[0]}` : zone.city;
        option.dataset.search = [zone.id, zone.region, ...zone.countries, ...zone.names, zone.countries.includes('United Kingdom')?'UK Britain British':'', zone.countries.includes('United States')?'US USA America':'', zone.id==='Asia/Kolkata'?'Mumbai Delhi Bombay Calcutta IST':''].join(' ');
        option.dataset.detail = [zone.names[0], zone.id].filter(Boolean).join(' · '); fragment.append(option);
      }
      select.replaceChildren(fragment); select.value = value;
      window.JuneControls.refresh(select); device.hidden = !deviceZone; return zones;
    }).catch(() => { pending = null; helper.textContent = 'Choose a listed time zone, or add your city in the trip notes.'; return []; });
    return pending;
  }
  device.addEventListener('click', async () => {
    await load();
    let match = zones.find(zone => zone.id === deviceZone);
    if (!match) match = zones.find(zone => { try { return new Intl.DateTimeFormat('en', {timeZone:zone.id}).resolvedOptions().timeZone === deviceZone; } catch { return false; } });
    if (!match) { helper.textContent = 'Search for your city or country to choose a time zone.'; return; }
    select.value = match.id; select.dispatchEvent(new Event('change', {bubbles:true})); window.JuneControls.focus(select);
  });
  select.addEventListener('change', updateHelp);
  document.querySelector('#inquiry-form').addEventListener('reset', () => queueMicrotask(updateHelp));
  // The small local index loads once; keystrokes never call an external service.
  load();
})();

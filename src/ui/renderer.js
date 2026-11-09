/**
 * UI Renderer for Shrishti AI
 * Renders rich cards for Tool Results: Leaflet Maps, Weather, Translations, Research, Calculations.
 */

import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { speakText } from '../voice/speech.js';

// Fix Leaflet marker icons in bundlers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom SVG Icons
export const ICONS = {
  calculator: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" x2="16" y1="6" y2="6"/><line x1="16" x2="16" y1="14" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>`,
  map: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15"/><path d="M15 6v15"/></svg>`,
  route: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/></svg>`,
  weather: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>`,
  translate: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
  search: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
  copy: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
  check: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  volume: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`,
  externalLink: `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`,
  compass: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`,
  thermometer: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></svg>`,
  wind: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.7 7.7A2.5 2.5 0 1 1 15 12H2"/><path d="M19.7 15.7A2.5 2.5 0 1 1 17 20H2"/></svg>`,
  droplet: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>`,
  sunrise: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"/><path d="m4.93 10.93 1.41 1.41"/><path d="M20 18h2"/><path d="M2 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>`,
  sunset: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M20 18h2"/><path d="M2 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m16 6-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/></svg>`
};

/**
 * Helper to copy text to clipboard with button feedback
 */
export function setupCopyButton(btn, text) {
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.innerHTML;
      btn.innerHTML = `${ICONS.check} <span>Copied</span>`;
      btn.classList.add('copied');
      setTimeout(() => {
        btn.innerHTML = original;
        btn.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.warn('Copy failed', err);
    }
  });
}

/**
 * 1. Render Calculator Result Card
 */
export function renderCalculatorCard(data) {
  const container = document.createElement('div');
  container.className = 'tool-card calculator-card';

  if (!data.success && data.error) {
    container.innerHTML = `
      <div class="card-header">
        <span class="tool-badge">${ICONS.calculator} Calculator</span>
      </div>
      <div class="card-error">Error: ${escapeHtml(data.error)}</div>
    `;
    return container;
  }

  container.innerHTML = `
    <div class="card-header">
      <span class="tool-badge">${ICONS.calculator} Calculator</span>
      <button class="action-btn copy-btn" title="Copy result">${ICONS.copy} Copy</button>
    </div>
    <div class="calc-expression">${escapeHtml(data.expression)}</div>
    <div class="calc-result">${escapeHtml(data.formattedResult)}</div>
  `;

  const copyBtn = container.querySelector('.copy-btn');
  setupCopyButton(copyBtn, String(data.formattedResult));
  return container;
}

/**
 * 2. Render Unit Converter Card
 */
export function renderUnitConverterCard(data) {
  const container = document.createElement('div');
  container.className = 'tool-card unit-card';

  container.innerHTML = `
    <div class="card-header">
      <span class="tool-badge">${ICONS.calculator} Unit Conversion (${escapeHtml(data.category)})</span>
      <button class="action-btn copy-btn" title="Copy result">${ICONS.copy} Copy</button>
    </div>
    <div class="unit-comparison">
      <div class="unit-from">
        <span class="unit-val">${escapeHtml(String(data.value))}</span>
        <span class="unit-lbl">${escapeHtml(data.fromUnit)}</span>
      </div>
      <div class="unit-arrow">→</div>
      <div class="unit-to">
        <span class="unit-val highlight">${escapeHtml(String(data.result))}</span>
        <span class="unit-lbl">${escapeHtml(data.toUnit)}</span>
      </div>
    </div>
  `;

  const copyBtn = container.querySelector('.copy-btn');
  setupCopyButton(copyBtn, `${data.result} ${data.toUnit}`);
  return container;
}

/**
 * 3. Render Translation Card
 */
export function renderTranslationCard(data) {
  const container = document.createElement('div');
  container.className = 'tool-card translation-card';

  container.innerHTML = `
    <div class="card-header">
      <span class="tool-badge">${ICONS.translate} Translation (${escapeHtml(data.sourceLanguageName)} → ${escapeHtml(data.targetLanguageName)})</span>
      <div class="card-actions">
        <button class="action-btn speak-btn" title="Listen translation">${ICONS.volume} Listen</button>
        <button class="action-btn copy-btn" title="Copy translation">${ICONS.copy} Copy</button>
      </div>
    </div>
    <div class="translation-body">
      <div class="trans-section original">
        <div class="lang-tag">${escapeHtml(data.sourceLanguageName)}</div>
        <p class="trans-text">${escapeHtml(data.originalText)}</p>
      </div>
      <div class="trans-divider"></div>
      <div class="trans-section translated">
        <div class="lang-tag target">${escapeHtml(data.targetLanguageName)}</div>
        <p class="trans-text highlight">${escapeHtml(data.translatedText)}</p>
      </div>
    </div>
    <div class="card-footer">
      <span class="engine-tag">Engine: ${escapeHtml(data.provider || 'MyMemory')}</span>
    </div>
  `;

  const copyBtn = container.querySelector('.copy-btn');
  setupCopyButton(copyBtn, data.translatedText);

  const speakBtn = container.querySelector('.speak-btn');
  speakBtn.addEventListener('click', () => {
    speakText(data.translatedText);
  });

  return container;
}

/**
 * 4. Render Weather Card
 */
export function renderWeatherCard(data) {
  const container = document.createElement('div');
  container.className = 'tool-card weather-card';

  const cur = data.current;
  const adminText = data.admin1 ? `${data.admin1}, ` : '';
  const locTitle = `${data.location}, ${adminText}${data.country}`.replace(/,\s*,/g, ',');

  // Build 24-hr hourly forecast items
  const hourlyHtml = (data.hourly || []).map(h => `
    <div class="hourly-item">
      <div class="hourly-time">${h.hourFormatted}</div>
      <div class="hourly-temp">${h.temperature}°</div>
      <div class="hourly-rain">${h.precipitationProb > 0 ? `${h.precipitationProb}%` : ''}</div>
    </div>
  `).join('');

  // Build 7-day daily forecast rows
  const dailyHtml = (data.daily || []).map(d => `
    <div class="daily-row">
      <div class="daily-day">${d.dayName}</div>
      <div class="daily-cond">${d.condition}</div>
      <div class="daily-temps">
        <span class="temp-max">${d.maxTemp}°</span>
        <span class="temp-min">${d.minTemp}°</span>
      </div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="card-header">
      <span class="tool-badge">${ICONS.weather} Weather</span>
      <span class="loc-badge">${escapeHtml(data.location)}</span>
    </div>
    <div class="weather-current">
      <div class="weather-main">
        <div class="temp-display">${cur.temperature}<span class="unit">°C</span></div>
        <div class="weather-condition">${escapeHtml(cur.condition)}</div>
        <div class="weather-feels">Feels like ${cur.apparentTemperature}°C</div>
      </div>
      <div class="weather-details-grid">
        <div class="detail-item">
          ${ICONS.droplet}
          <span>Humidity: <strong>${cur.humidity}%</strong></span>
        </div>
        <div class="detail-item">
          ${ICONS.wind}
          <span>Wind: <strong>${cur.windSpeed} km/h</strong></span>
        </div>
        <div class="detail-item">
          ${ICONS.sunrise}
          <span>Sunrise: <strong>${data.todaySunrise || '--'}</strong></span>
        </div>
        <div class="detail-item">
          ${ICONS.sunset}
          <span>Sunset: <strong>${data.todaySunset || '--'}</strong></span>
        </div>
      </div>
    </div>

    <!-- Hourly Scroll -->
    <div class="hourly-container">
      <div class="section-title">24-Hour Forecast</div>
      <div class="hourly-scroll">
        ${hourlyHtml}
      </div>
    </div>

    <!-- 7-Day Forecast -->
    <div class="daily-container">
      <div class="section-title">7-Day Forecast</div>
      <div class="daily-list">
        ${dailyHtml}
      </div>
    </div>
  `;

  return container;
}

/**
 * 5. Render Research / Web Search Card (Orange-B Research Report)
 */
export function renderSearchCard(data) {
  const container = document.createElement('div');
  container.className = 'tool-card search-card research-report-card';

  const overviewText = data.overview || (
    data.findings && data.findings.length > 0
      ? data.findings.slice(0, 3).join(' ')
      : 'Overview from retrieved evidence.'
  );

  const findings = data.findings || [];
  const sources = data.sources || data.results || [];

  const findingsHtml = findings.length > 0
    ? findings.map((f, i) => `
      <div class="finding-item">
        <span class="finding-badge">${i + 1}</span>
        <span class="finding-text">${escapeHtml(f)}</span>
      </div>
    `).join('')
    : '<div class="empty-findings">Relevant sources were found, but no sufficiently relevant evidence sentences could be extracted.</div>';

  const sourcesHtml = sources.length > 0
    ? sources.map((s, idx) => {
      const domain = s.sourceDomain || (s.url ? new URL(s.url).hostname.replace('www.', '') : '');
      const quality = s.quality || 'Web source';
      const scope = s.scope || 'National';
      return `
        <div class="research-source-item">
          <div class="source-header-row">
            <span class="source-index">[${idx + 1}]</span>
            <a class="source-link" href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(s.title || s.url)} ${ICONS.externalLink}
            </a>
          </div>
          <div class="source-url-row">${escapeHtml(s.url)}</div>
          <div class="source-tags-row">
            <span class="source-quality-tag">Type: ${escapeHtml(quality)}</span>
            <span class="source-scope-tag">Scope: ${escapeHtml(scope)}</span>
            ${domain ? `<span class="source-domain-tag">${escapeHtml(domain)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('')
    : '<div class="empty-results">No usable search results were found.</div>';

  container.innerHTML = `
    <div class="card-header">
      <span class="tool-badge">${ICONS.search} Orange-B Research</span>
      <div class="header-right-actions">
        <span class="source-tag">${escapeHtml(data.provider || 'Orange-B Research Engine v3.0')}</span>
        <button class="action-btn copy-btn copy-report-btn" title="Copy Plaintext Report">${ICONS.copy} Copy Report</button>
      </div>
    </div>

    <!-- RESEARCH OVERVIEW -->
    <div class="research-block">
      <div class="research-heading">RESEARCH OVERVIEW</div>
      <div class="research-divider"></div>
      <div class="research-overview-content">
        ${escapeHtml(overviewText)}
      </div>
    </div>

    <!-- KEY FINDINGS -->
    <div class="research-block">
      <div class="research-heading">KEY FINDINGS</div>
      <div class="research-divider"></div>
      <div class="research-findings-list">
        ${findingsHtml}
      </div>
    </div>

    <!-- SOURCES -->
    <div class="research-block">
      <div class="research-heading">SOURCES</div>
      <div class="research-divider"></div>
      <div class="research-sources-list">
        ${sourcesHtml}
      </div>
    </div>

    <!-- DISCLAIMER NOTE -->
    <div class="research-disclaimer-note">
      <span class="note-icon">ℹ️</span>
      <span>Note: The overview is generated from retrieved evidence. It is not an independent factual verification or an LLM-generated synthesis.</span>
    </div>
  `;

  // Setup copy report action
  const copyBtn = container.querySelector('.copy-report-btn');
  if (copyBtn) {
    const rawToCopy = data.rawText || reconstructRawReport(overviewText, findings, sources);
    setupCopyButton(copyBtn, rawToCopy);
  }

  return container;
}

function reconstructRawReport(overview, findings, sources) {
  const lines = [];
  lines.push('RESEARCH OVERVIEW');
  lines.push('='.repeat(55));
  lines.push('');
  lines.push(overview);
  lines.push('');
  lines.push('KEY FINDINGS');
  lines.push('='.repeat(55));
  lines.push('');
  findings.forEach((f, idx) => {
    lines.push(`${idx + 1}. ${f}`);
  });
  lines.push('');
  lines.push('SOURCES');
  lines.push('='.repeat(55));
  lines.push('');
  sources.forEach((s, idx) => {
    lines.push(`[${idx + 1}] ${s.title}`);
    lines.push(`    ${s.url}`);
    lines.push(`    Type: ${s.quality || 'Web source'}`);
  });
  lines.push('');
  lines.push('Note: The overview is generated from retrieved evidence. It is not an independent factual verification or an LLM-generated synthesis.');
  return lines.join('\n');
}

/**
 * 6. Render Leaflet Map Card (Places, Nearby Amenities, or Route Directions)
 */
export function renderMapCard(toolName, data) {
  const container = document.createElement('div');
  container.className = 'tool-card map-card';

  const mapId = 'map-' + Math.random().toString(36).substring(2, 9);

  let headerTitle = 'Map';
  let badgeIcon = ICONS.map;
  let infoHtml = '';

  if (toolName === 'search_places') {
    headerTitle = `Place: ${data.primaryPlace?.name || data.query}`;
    infoHtml = `
      <div class="map-info-bar">
        <strong>${escapeHtml(data.primaryPlace?.name || data.query)}</strong>
        <span class="subtext">${escapeHtml(data.primaryPlace?.displayName || '')}</span>
      </div>
    `;
  } else if (toolName === 'find_nearby_places') {
    headerTitle = `Nearby ${data.category} in ${data.center?.name}`;
    badgeIcon = ICONS.compass;
    const placesList = (data.places || []).map((p, idx) => `
      <div class="nearby-item" data-idx="${idx}">
        <span class="nearby-num">${idx + 1}</span>
        <div class="nearby-details">
          <div class="nearby-name">${escapeHtml(p.name)}</div>
          <div class="nearby-sub">${p.distanceKm} km away ${p.phone ? '• ' + escapeHtml(p.phone) : ''}</div>
        </div>
      </div>
    `).join('');

    infoHtml = `
      <div class="nearby-places-container">
        <div class="section-title">${data.places?.length || 0} places found within ${(data.radiusMeters / 1000).toFixed(1)} km:</div>
        <div class="nearby-scroll">${placesList}</div>
      </div>
    `;
  } else if (toolName === 'get_directions') {
    headerTitle = `Directions: ${data.origin?.name} → ${data.destination?.name}`;
    badgeIcon = ICONS.route;
    const stepsHtml = (data.steps || []).map(s => `
      <li class="route-step">
        <span class="step-text">${escapeHtml(s.instruction)}</span>
        <span class="step-dist">${s.distanceMeters > 1000 ? (s.distanceMeters / 1000).toFixed(1) + ' km' : s.distanceMeters + ' m'}</span>
      </li>
    `).join('');

    infoHtml = `
      <div class="route-info-summary">
        <div class="route-stat">
          <span class="stat-label">Total Distance</span>
          <span class="stat-value">${data.distanceKm} km</span>
        </div>
        <div class="route-stat">
          <span class="stat-label">Estimated Time</span>
          <span class="stat-value highlight">${data.durationFormatted}</span>
        </div>
        <div class="route-stat">
          <span class="stat-label">Travel Mode</span>
          <span class="stat-value">${data.mode}</span>
        </div>
      </div>
      ${stepsHtml ? `
        <details class="route-steps-details">
          <summary>Turn-by-turn Navigation Steps (${data.steps.length})</summary>
          <ol class="route-steps-list">${stepsHtml}</ol>
        </details>
      ` : ''}
    `;
  }

  container.innerHTML = `
    <div class="card-header">
      <span class="tool-badge">${badgeIcon} ${escapeHtml(headerTitle)}</span>
    </div>
    <div id="${mapId}" class="leaflet-map-canvas"></div>
    ${infoHtml}
  `;

  // Asynchronously initialize Leaflet Map after attached to DOM
  setTimeout(() => {
    initLeafletMapInstance(mapId, toolName, data);
  }, 50);

  return container;
}

/**
 * Initialize actual Leaflet map instance and render pins / routes
 */
function initLeafletMapInstance(containerId, toolName, data) {
  const el = document.getElementById(containerId);
  if (!el) return;

  try {
    const map = L.map(containerId, {
      zoomControl: true,
      scrollWheelZoom: false
    });

    // OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    if (toolName === 'search_places') {
      const place = data.primaryPlace;
      if (place && place.latitude && place.longitude) {
        map.setView([place.latitude, place.longitude], 13);
        L.marker([place.latitude, place.longitude])
          .addTo(map)
          .bindPopup(`<b>${escapeHtml(place.name)}</b><br/>${escapeHtml(place.displayName)}`)
          .openPopup();
      }
    } else if (toolName === 'find_nearby_places') {
      const center = data.center;
      const bounds = [];

      // Center marker
      if (center) {
        const centerIcon = L.divIcon({
          className: 'custom-center-marker',
          html: `<div style="background:#06B6D4; width:16px; height:16px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 10px #06B6D4;"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        L.marker([center.latitude, center.longitude], { icon: centerIcon })
          .addTo(map)
          .bindPopup(`<b>Center: ${escapeHtml(center.name)}</b>`);
        bounds.push([center.latitude, center.longitude]);
      }

      // Nearby places markers
      for (const p of data.places || []) {
        if (p.latitude && p.longitude) {
          bounds.push([p.latitude, p.longitude]);
          L.marker([p.latitude, p.longitude])
            .addTo(map)
            .bindPopup(`<b>${escapeHtml(p.name)}</b><br/>${p.distanceKm} km away<br/>${p.phone ? 'Tel: ' + p.phone : ''}`);
        }
      }

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [30, 30] });
      } else if (center) {
        map.setView([center.latitude, center.longitude], 13);
      }
    } else if (toolName === 'get_directions') {
      const coords = data.coordinates;
      if (coords && coords.length > 0) {
        // Draw polyline
        const routeLine = L.polyline(coords, {
          color: '#3B82F6',
          weight: 5,
          opacity: 0.85,
          lineJoin: 'round'
        }).addTo(map);

        // Origin marker
        L.marker(coords[0])
          .addTo(map)
          .bindPopup(`<b>Start:</b> ${escapeHtml(data.origin?.name || 'Origin')}`);

        // Destination marker
        L.marker(coords[coords.length - 1])
          .addTo(map)
          .bindPopup(`<b>Destination:</b> ${escapeHtml(data.destination?.name || 'Destination')}<br/>Distance: ${data.distanceKm} km`);

        map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });
      }
    }

    // Leaflet resize trigger
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

  } catch (mapErr) {
    console.error('Error mounting Leaflet map:', mapErr);
  }
}

/**
 * Render Tool Execution Indicator Pill
 */
export function renderToolExecutionPill(toolName, input) {
  const pill = document.createElement('div');
  pill.className = 'tool-exec-indicator';
  pill.innerHTML = `
    <span class="spinner"></span>
    <span class="exec-text">Orange-B executing tool <strong>${escapeHtml(toolName)}</strong>...</span>
  `;
  return pill;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

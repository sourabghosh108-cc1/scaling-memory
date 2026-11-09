/**
 * Chat Conversation Controller for Shrishti AI
 * Manages message stream, user inputs, tool responses, local storage persistence, and voice controls.
 */

import { processUserQuery } from '../engine/router.js';
import {
  renderCalculatorCard,
  renderUnitConverterCard,
  renderTranslationCard,
  renderWeatherCard,
  renderSearchCard,
  renderMapCard,
  renderToolExecutionPill,
  setupCopyButton,
  ICONS
} from './renderer.js';
import { speakText, stopSpeaking, toggleMicrophone, onSpeechStatusChange, SpeechStatus } from '../voice/speech.js';

const STORAGE_KEY = 'shrishti_conversations_v1';
const ACTIVE_CONV_KEY = 'shrishti_active_conv_id';

let currentConversationId = null;
let conversations = [];
let abortController = null;

// Callbacks
let onConversationListUpdate = null;

export function setConversationListCallback(cb) {
  onConversationListUpdate = cb;
}

/**
 * Load conversations from LocalStorage
 */
export function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    conversations = raw ? JSON.parse(raw) : [];
  } catch (e) {
    conversations = [];
  }

  currentConversationId = localStorage.getItem(ACTIVE_CONV_KEY);
  if (!currentConversationId || !conversations.find(c => c.id === currentConversationId)) {
    if (conversations.length > 0) {
      currentConversationId = conversations[0].id;
    } else {
      createNewConversation();
    }
  }

  return conversations;
}

/**
 * Save conversations to LocalStorage
 */
export function saveConversations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    localStorage.setItem(ACTIVE_CONV_KEY, currentConversationId);
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
  if (onConversationListUpdate) onConversationListUpdate(conversations, currentConversationId);
}

/**
 * Create a new conversation session
 */
export function createNewConversation(title = 'New Session') {
  const newConv = {
    id: 'conv_' + Date.now(),
    title,
    createdAt: new Date().toISOString(),
    messages: []
  };
  conversations.unshift(newConv);
  currentConversationId = newConv.id;
  saveConversations();
  renderChatMessages();
  return newConv;
}

/**
 * Switch active conversation
 */
export function switchConversation(id) {
  if (currentConversationId === id) return;
  currentConversationId = id;
  saveConversations();
  renderChatMessages();
}

/**
 * Delete a conversation
 */
export function deleteConversation(id) {
  conversations = conversations.filter(c => c.id !== id);
  if (currentConversationId === id) {
    currentConversationId = conversations.length > 0 ? conversations[0].id : null;
    if (!currentConversationId) {
      createNewConversation();
      return;
    }
  }
  saveConversations();
  renderChatMessages();
}

/**
 * Clear messages in active conversation
 */
export function clearCurrentConversation() {
  const conv = getActiveConversation();
  if (conv) {
    conv.messages = [];
    saveConversations();
    renderChatMessages();
  }
}

export function getActiveConversation() {
  return conversations.find(c => c.id === currentConversationId);
}

/**
 * Render all messages for current conversation
 */
export function renderChatMessages() {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  container.innerHTML = '';
  const conv = getActiveConversation();

  if (!conv || conv.messages.length === 0) {
    container.innerHTML = `
      <div class="empty-chat-hero research-first">
        <div class="hero-logo-box">
          <img src="/logo.svg" alt="Shrishti AI" class="hero-logo" />
        </div>
        <h2 class="hero-title">Shrishti AI</h2>
        <p class="hero-subtitle">Search the web, translate, find places, get directions, check weather &amp; more — all inside your browser.</p>

        <div class="hero-search-bar">
          <span class="hero-search-icon">${ICONS.search}</span>
          <input
            id="hero-search-input"
            type="text"
            class="hero-search-input"
            placeholder="Search the web or ask anything..."
            autocomplete="off"
            spellcheck="false"
          />
          <button class="hero-search-submit" id="hero-search-submit" type="button">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>

        <div class="hero-quick-links">
          <button class="hero-quick-btn" data-prompt="Search the web for latest AI news today">🤖 AI News</button>
          <button class="hero-quick-btn" data-prompt="Search the web for top tech stories this week">💻 Tech Stories</button>
          <button class="hero-quick-btn" data-prompt="Search the web for India news today">🇮🇳 India News</button>
          <button class="hero-quick-btn" data-prompt="Show weather in Tokyo">🌤️ Weather in Tokyo</button>
          <button class="hero-quick-btn" data-prompt="Translate hello into Hindi">🌐 Translate</button>
        </div>
      </div>
    `;

    // Hero search bar submit
    const heroInput = container.querySelector('#hero-search-input');
    const heroSubmit = container.querySelector('#hero-search-submit');

    const fireHeroSearch = () => {
      const val = heroInput ? heroInput.value.trim() : '';
      if (val) submitMessage(val.startsWith('Search') ? val : `Search the web for ${val}`);
    };

    if (heroInput) {
      heroInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); fireHeroSearch(); }
      });
      // Auto-focus
      setTimeout(() => heroInput.focus(), 50);
    }
    if (heroSubmit) {
      heroSubmit.addEventListener('click', fireHeroSearch);
    }

    // Quick link buttons
    container.querySelectorAll('.hero-quick-btn').forEach(btn => {
      btn.addEventListener('click', () => submitMessage(btn.getAttribute('data-prompt')));
    });

    return;
  }

  for (const msg of conv.messages) {
    appendMessageElement(msg, false);
  }

  scrollToBottom();
}

/**
 * Append message element to chat window
 */
function appendMessageElement(msg, autoScroll = true) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `message-row ${msg.role}-row`;
  msgDiv.id = `msg-${msg.id}`;

  if (msg.role === 'user') {
    msgDiv.innerHTML = `
      <div class="message-bubble user-bubble">
        <div class="message-text">${escapeHtml(msg.content)}</div>
        <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    `;
  } else {
    // Assistant message with tool cards
    let toolCardsHtml = '';
    const cardsWrapper = document.createElement('div');
    cardsWrapper.className = 'tool-cards-container';

    if (msg.toolCalls && msg.toolCalls.length > 0) {
      for (const tc of msg.toolCalls) {
        let cardEl = null;
        const res = tc.result;

        if (tc.name === 'calculator' && res) {
          cardEl = renderCalculatorCard(res);
        } else if (tc.name === 'unit_converter' && res) {
          cardEl = renderUnitConverterCard(res);
        } else if (tc.name === 'translate_text' && res) {
          cardEl = renderTranslationCard(res);
        } else if (tc.name === 'get_weather' && res) {
          cardEl = renderWeatherCard(res);
        } else if (tc.name === 'web_search' && res) {
          cardEl = renderSearchCard(res);
        } else if (['search_places', 'find_nearby_places', 'get_directions'].includes(tc.name) && res) {
          cardEl = renderMapCard(tc.name, res);
        }

        if (cardEl) {
          cardsWrapper.appendChild(cardEl);
        }
      }
    }

    const textContentHtml = msg.content ? `<div class="assistant-prose">${formatMarkdown(msg.content)}</div>` : '';

    msgDiv.innerHTML = `
      <div class="assistant-avatar">
        <img src="/logo.svg" alt="Shrishti" />
      </div>
      <div class="message-bubble assistant-bubble">
        ${textContentHtml}
        <div class="cards-mount-point"></div>
        <div class="message-footer">
          <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          <div class="msg-actions">
            <button class="msg-action-btn speak-msg-btn" title="Speak response">${ICONS.volume}</button>
            <button class="msg-action-btn copy-msg-btn" title="Copy response">${ICONS.copy}</button>
          </div>
        </div>
      </div>
    `;

    const mountPoint = msgDiv.querySelector('.cards-mount-point');
    if (mountPoint && cardsWrapper.childNodes.length > 0) {
      mountPoint.appendChild(cardsWrapper);
    }

    // Attach speak button
    const speakBtn = msgDiv.querySelector('.speak-msg-btn');
    if (speakBtn) {
      speakBtn.addEventListener('click', () => {
        const textToSpeak = msg.content || (msg.toolCalls && msg.toolCalls[0]?.result ? JSON.stringify(msg.toolCalls[0].result) : '');
        speakText(textToSpeak);
      });
    }

    // Attach copy button
    const copyBtn = msgDiv.querySelector('.copy-msg-btn');
    if (copyBtn) {
      setupCopyButton(copyBtn, msg.content || '');
    }
  }

  container.appendChild(msgDiv);
  if (autoScroll) scrollToBottom();
}

/**
 * Submit user message and trigger Needle tool loop
 */
export async function submitMessage(text) {
  const query = text ? text.trim() : '';
  if (!query) return;

  const conv = getActiveConversation();
  if (!conv) return;

  // If first message in conversation, update title
  if (conv.messages.length === 0) {
    conv.title = query.slice(0, 32);
  }

  // Create user message
  const userMsg = {
    id: 'user_' + Date.now(),
    role: 'user',
    content: query,
    timestamp: new Date().toISOString()
  };

  conv.messages.push(userMsg);
  saveConversations();
  appendMessageElement(userMsg);

  // Clear input
  const inputEl = document.getElementById('chat-input');
  if (inputEl) {
    inputEl.value = '';
    inputEl.style.height = 'auto';
  }

  // Show execution indicator
  const container = document.getElementById('chat-messages');
  const indicator = document.createElement('div');
  indicator.className = 'message-row assistant-row pending-indicator-row';
  indicator.id = 'current-pending-indicator';
  indicator.innerHTML = `
    <div class="assistant-avatar">
      <img src="/logo.svg" alt="Shrishti" />
    </div>
    <div class="message-bubble assistant-bubble">
      <div class="needle-status-pulse">
        <span class="pulsing-dot"></span>
        <span>Orange-B selecting and executing tools...</span>
      </div>
    </div>
  `;
  container.appendChild(indicator);
  scrollToBottom();

  // Toggle stop button
  setExecutingState(true);

  abortController = new AbortController();

  try {
    const result = await processUserQuery(query, {
      abortSignal: abortController.signal
    });

    // Remove pending indicator
    const currentInd = document.getElementById('current-pending-indicator');
    if (currentInd) currentInd.remove();

    if (!result) return;

    let assistantContent = '';
    let toolCalls = [];

    if (result.matched) {
      toolCalls = result.toolCalls;
      // Synthesize clean summary from results
      assistantContent = synthesizeToolResponse(toolCalls);
    } else {
      assistantContent = result.message;
    }

    const assistantMsg = {
      id: 'asst_' + Date.now(),
      role: 'assistant',
      content: assistantContent,
      toolCalls,
      timestamp: new Date().toISOString()
    };

    conv.messages.push(assistantMsg);
    saveConversations();
    appendMessageElement(assistantMsg);

  } catch (err) {
    const currentInd = document.getElementById('current-pending-indicator');
    if (currentInd) currentInd.remove();

    if (err.name === 'AbortError') {
      const abortMsg = {
        id: 'asst_' + Date.now(),
        role: 'assistant',
        content: 'Execution stopped by user.',
        toolCalls: [],
        timestamp: new Date().toISOString()
      };
      conv.messages.push(abortMsg);
      saveConversations();
      appendMessageElement(abortMsg);
    } else {
      const errorMsg = {
        id: 'asst_' + Date.now(),
        role: 'assistant',
        content: `Error executing request: ${err.message}`,
        toolCalls: [],
        timestamp: new Date().toISOString()
      };
      conv.messages.push(errorMsg);
      saveConversations();
      appendMessageElement(errorMsg);
    }
  } finally {
    setExecutingState(false);
    abortController = null;
  }
}

/**
 * Synthesize a natural language summary text from real tool results
 */
function synthesizeToolResponse(toolCalls) {
  if (!toolCalls || toolCalls.length === 0) return '';

  const summaries = [];
  for (const tc of toolCalls) {
    const res = tc.result;
    if (!res) continue;

    if (tc.name === 'calculator') {
      summaries.push(`**Calculation Result**: ${res.expression} = **${res.formattedResult}**`);
    } else if (tc.name === 'unit_converter') {
      summaries.push(`**Converted**: ${res.value} ${res.fromUnit} is **${res.formattedResult}**`);
    } else if (tc.name === 'translate_text') {
      summaries.push(`**Translation** (${res.sourceLanguageName} → ${res.targetLanguageName}): "${res.translatedText}"`);
    } else if (tc.name === 'get_weather') {
      summaries.push(`Current weather in **${res.location}**: **${res.current.temperature}°C**, ${res.current.condition}. Humidity is ${res.current.humidity}% with wind at ${res.current.windSpeed} km/h.`);
    } else if (tc.name === 'search_places') {
      summaries.push(`Found location for **${tc.arguments.query}**: ${res.primaryPlace?.displayName || ''}`);
    } else if (tc.name === 'find_nearby_places') {
      summaries.push(`Found **${res.places?.length || 0}** ${res.category} near ${res.center?.name}.`);
    } else if (tc.name === 'get_directions') {
      summaries.push(`Route from **${res.origin?.name}** to **${res.destination?.name}**: **${res.distanceKm} km**, estimated travel time **${res.durationFormatted}**.`);
    } else if (tc.name === 'web_search') {
      summaries.push(`Retrieved **${res.results?.length || 0}** web research sources for "${res.query}":`);
    }
  }

  return summaries.join('\n\n');
}

function setExecutingState(isExecuting) {
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');
  if (sendBtn && stopBtn) {
    if (isExecuting) {
      sendBtn.classList.add('hidden');
      stopBtn.classList.remove('hidden');
    } else {
      sendBtn.classList.remove('hidden');
      stopBtn.classList.add('hidden');
    }
  }
}

export function stopCurrentExecution() {
  if (abortController) {
    abortController.abort();
  }
  stopSpeaking();
}

function scrollToBottom() {
  const container = document.getElementById('chat-messages');
  if (container) {
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }
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

function formatMarkdown(text) {
  if (!text) return '';
  // Basic markdown bold, code, lists
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

/**
 * Initialize command bar pill buttons above the composer
 */
export function initCommandBar() {
  const bar = document.getElementById('command-bar');
  if (!bar) return;

  const chatInput = document.getElementById('chat-input');

  bar.querySelectorAll('.cmd-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      // Visually mark active pill
      bar.querySelectorAll('.cmd-pill').forEach(p => p.classList.remove('cmd-pill--active'));
      pill.classList.add('cmd-pill--active');

      const query = pill.getAttribute('data-query') || '';
      const mode = pill.getAttribute('data-mode') || 'prefix';

      if (mode === 'full') {
        // Full query — submit immediately
        submitMessage(query);
      } else {
        // Prefix — populate input and focus so user types the rest
        if (chatInput) {
          chatInput.value = query;
          chatInput.focus();
          chatInput.style.height = 'auto';
          chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
          // Move cursor to end
          const len = chatInput.value.length;
          chatInput.setSelectionRange(len, len);
        }
      }
    });
  });
}


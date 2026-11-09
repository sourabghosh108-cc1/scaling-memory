/**
 * Sidebar Navigation & Model Status Panel for Shrishti AI
 */

import {
  createNewConversation,
  switchConversation,
  deleteConversation,
  clearCurrentConversation,
  setConversationListCallback
} from './chat.js';
import { onNeedleStateChange, NeedleState } from '../engine/needle.js';
import { ICONS } from './renderer.js';

export function initSidebar() {
  const sidebarEl = document.getElementById('sidebar');
  const newChatBtn = document.getElementById('new-chat-btn');
  const convListEl = document.getElementById('conversation-list');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const themeToggle = document.getElementById('theme-toggle');

  // New Chat
  if (newChatBtn) {
    newChatBtn.addEventListener('click', () => {
      createNewConversation();
      closeMobileSidebar();
    });
  }

  // Clear current conversation
  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      if (confirm('Clear messages in this conversation?')) {
        clearCurrentConversation();
      }
    });
  }

  // Mobile sidebar toggle
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebarEl.classList.toggle('open');
      const backdrop = document.getElementById('sidebar-backdrop');
      if (backdrop) backdrop.classList.toggle('visible');
    });
  }

  const backdrop = document.getElementById('sidebar-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeMobileSidebar);
  }

  // Theme toggle
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
    // Init theme from localStorage
    const savedTheme = localStorage.getItem('shrishti_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
  }

  // Register conversation list updates
  setConversationListCallback((conversations, activeId) => {
    renderConversationsList(conversations, activeId);
  });

  // Needle status listener
  onNeedleStateChange(({ state, progress, error }) => {
    renderNeedleStatus(state, progress, error);
  });
}

function closeMobileSidebar() {
  const sidebarEl = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebarEl) sidebarEl.classList.remove('open');
  if (backdrop) backdrop.classList.remove('visible');
}

function renderConversationsList(conversations, activeId) {
  const listEl = document.getElementById('conversation-list');
  if (!listEl) return;

  listEl.innerHTML = '';

  if (conversations.length === 0) {
    listEl.innerHTML = `<div class="empty-list-msg">No conversations yet</div>`;
    return;
  }

  for (const conv of conversations) {
    const item = document.createElement('div');
    item.className = `conv-item ${conv.id === activeId ? 'active' : ''}`;
    item.innerHTML = `
      <div class="conv-info">
        <span class="conv-title">${escapeHtml(conv.title || 'Conversation')}</span>
        <span class="conv-date">${new Date(conv.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
      </div>
      <button class="conv-del-btn" title="Delete conversation">×</button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('conv-del-btn')) {
        e.stopPropagation();
        deleteConversation(conv.id);
      } else {
        switchConversation(conv.id);
        closeMobileSidebar();
      }
    });

    listEl.appendChild(item);
  }
}

/**
 * Render Needle model loading & readiness status in sidebar
 */
function renderNeedleStatus(state, progress, error) {
  const statusContainer = document.getElementById('model-status-card');
  if (!statusContainer) return;

  let stateText = 'Uninitialized';
  let badgeClass = 'badge-idle';
  let progressHtml = '';

  switch (state) {
    case NeedleState.UNINITIALIZED:
      stateText = 'Ready to load';
      badgeClass = 'badge-idle';
      break;
    case NeedleState.LOADING:
      stateText = 'Loading Orange-B WASM...';
      badgeClass = 'badge-loading';
      progressHtml = `<div class="progress-bar-wrap"><div class="progress-bar indeterminate"></div></div>`;
      break;
    case NeedleState.DOWNLOADING:
      stateText = `Downloading Orange-B (${progress.percentage}%)`;
      badgeClass = 'badge-loading';
      progressHtml = `
        <div class="progress-bar-wrap">
          <div class="progress-bar" style="width: ${progress.percentage}%"></div>
        </div>
        <div class="progress-meta">${(progress.loaded / (1024 * 1024)).toFixed(1)} MB / 35.3 MB</div>
      `;
      break;
    case NeedleState.READY:
      stateText = 'Orange-B 3.0 Active';
      badgeClass = 'badge-ready';
      break;
    case NeedleState.RUNNING:
      stateText = 'Inferring Tools...';
      badgeClass = 'badge-running';
      break;
    case NeedleState.ERROR:
      stateText = 'Initialization Error';
      badgeClass = 'badge-error';
      progressHtml = `<div class="error-msg-mini">${escapeHtml(error || 'Failed to initialize')}</div>`;
      break;
  }

  statusContainer.innerHTML = `
    <div class="status-header">
      <div class="status-left">
        <span class="status-dot ${badgeClass}"></span>
        <span class="status-label">Orange-B</span>
      </div>
      <span class="status-pill ${badgeClass}">${stateText}</span>
    </div>
    ${progressHtml}
    <div class="status-footer">
      <span>Local WebAssembly</span>
      <span>Zero API Key</span>
    </div>
  `;
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('shrishti_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = theme === 'dark'
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> Light Mode`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> Dark Mode`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}


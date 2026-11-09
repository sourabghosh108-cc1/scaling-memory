/**
 * Shrishti AI - Main Application Entrypoint
 * Browser-native AI assistant powered by Cactus Needle JavaScript (WebAssembly)
 */

import './style.css';
import { initNeedle, getNeedleStatus } from './src/engine/needle.js';
import {
  loadConversations,
  renderChatMessages,
  submitMessage,
  stopCurrentExecution,
  initCommandBar
} from './src/ui/chat.js';
import { initSidebar } from './src/ui/sidebar.js';
import { initSettings } from './src/ui/settings.js';
import { toggleMicrophone, onSpeechStatusChange, SpeechStatus, stopSpeaking } from './src/voice/speech.js';
import { ICONS } from './src/ui/renderer.js';

document.addEventListener('DOMContentLoaded', async () => {
  console.log('[Shrishti AI] Starting application...');

  // 1. Initialize UI components
  initSidebar();
  initSettings();
  loadConversations();
  renderChatMessages();
  initCommandBar();

  // 2. Setup message composer controls
  setupComposer();

  // 3. Setup voice microphone controls
  setupVoiceControls();

  // 4. Initialize Cactus Needle engine eagerly
  try {
    await initNeedle();
  } catch (err) {
    console.warn('[Shrishti AI] Needle initialization pending user interaction or network download:', err);
  }
});

function setupComposer() {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');

  if (chatInput) {
    // Auto-expand textarea
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
    });

    // Enter to submit (Shift+Enter for newline)
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (text) submitMessage(text);
      }
    });
  }

  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput ? chatInput.value.trim() : '';
      if (text) submitMessage(text);
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopCurrentExecution();
    });
  }
}

function setupVoiceControls() {
  const micBtn = document.getElementById('mic-btn');
  if (!micBtn) return;

  micBtn.addEventListener('click', () => {
    toggleMicrophone((transcribedText, engine) => {
      console.log(`[Shrishti AI] Speech transcribed via ${engine}: "${transcribedText}"`);
      const chatInput = document.getElementById('chat-input');
      if (chatInput && transcribedText) {
        chatInput.value = transcribedText;
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 180) + 'px';
        // Auto-submit voice query
        submitMessage(transcribedText);
      }
    });
  });

  // Track recording / speech states
  onSpeechStatusChange((status, { whistleReady, whistleProgress, error }) => {
    if (status === SpeechStatus.RECORDING) {
      micBtn.classList.add('recording');
      micBtn.setAttribute('title', 'Listening... Click to stop');
      micBtn.innerHTML = `<span class="mic-pulse"></span> <span class="mic-status-label">Listening...</span>`;
    } else if (status === SpeechStatus.TRANSCRIBING) {
      micBtn.classList.remove('recording');
      micBtn.classList.add('transcribing');
      micBtn.setAttribute('title', 'Transcribing audio...');
      micBtn.innerHTML = `<span class="spinner-sm"></span> <span class="mic-status-label">Transcribing...</span>`;
    } else {
      micBtn.classList.remove('recording');
      micBtn.classList.remove('transcribing');
      micBtn.setAttribute('title', 'Voice Input (Whistle speech recognition)');
      micBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" x2="12" y1="19" y2="22"/>
        </svg>
      `;
    }
  });
}

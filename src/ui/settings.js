/**
 * Settings Controller for Shrishti AI
 * Handles Voice settings, TTS configuration, Whistle STT modes, and Cache management.
 */

import { getAvailableVoices, setTTSVoice, setMuted, getMuted, speakText } from '../voice/speech.js';

export function initSettings() {
  const settingsModal = document.getElementById('settings-modal');
  const settingsBtn = document.getElementById('settings-btn');
  const closeBtn = document.getElementById('close-settings-btn');
  const voiceSelect = document.getElementById('tts-voice-select');
  const muteCheckbox = document.getElementById('tts-mute-checkbox');
  const testTtsBtn = document.getElementById('test-tts-btn');
  const clearCacheBtn = document.getElementById('clear-cache-btn');

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      populateVoices();
      settingsModal.classList.add('visible');
    });
  }

  if (closeBtn && settingsModal) {
    closeBtn.addEventListener('click', () => {
      settingsModal.classList.remove('visible');
    });
  }

  // Close modal when clicking backdrop
  if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) {
        settingsModal.classList.remove('visible');
      }
    });
  }

  // Mute toggle
  if (muteCheckbox) {
    muteCheckbox.checked = getMuted();
    muteCheckbox.addEventListener('change', () => {
      setMuted(muteCheckbox.checked);
    });
  }

  // Voice selection
  if (voiceSelect) {
    voiceSelect.addEventListener('change', () => {
      const voices = getAvailableVoices();
      const selected = voices.find(v => v.name === voiceSelect.value);
      if (selected) setTTSVoice(selected);
    });
  }

  // Test voice
  if (testTtsBtn) {
    testTtsBtn.addEventListener('click', () => {
      speakText('Hello! This is Shrishti AI text to speech using your browser voice engine.');
    });
  }

  // Clear cache
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', async () => {
      if (confirm('Clear cached Orange-B and speech models from browser CacheStorage? You will need to re-download them on next session.')) {
        try {
          const keys = await caches.keys();
          for (const key of keys) {
            if (key.includes('needle') || key.includes('cactus')) {
              await caches.delete(key);
            }
          }
          alert('Model caches cleared successfully.');
        } catch (e) {
          alert('Error clearing cache: ' + e.message);
        }
      }
    });
  }

  // Voice change event listener in browser
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      populateVoices();
    };
  }
}

function populateVoices() {
  const voiceSelect = document.getElementById('tts-voice-select');
  if (!voiceSelect) return;

  const voices = getAvailableVoices();
  if (voices.length === 0) return;

  voiceSelect.innerHTML = '';
  voices.forEach(voice => {
    const opt = document.createElement('option');
    opt.value = voice.name;
    opt.textContent = `${voice.name} (${voice.lang})${voice.default ? ' [Default]' : ''}`;
    voiceSelect.appendChild(opt);
  });
}


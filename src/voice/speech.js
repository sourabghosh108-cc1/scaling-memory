/**
 * Speech Recognition (Whistle) & Text-to-Speech (Browser SpeechSynthesis)
 * Runs Whistle speech transcription locally via WebAssembly.
 * Text-to-speech uses browser Web Speech Synthesis API.
 */

import { Whistle, createWhistle } from 'cactus-needle/browser';
import { startRecording, stopRecording, isRecording } from './audio.js';

let whistleInstance = null;
let whistleLoading = false;
let whistleReady = false;
let whistleProgress = { loaded: 0, total: 16919407, percentage: 0 };

export const SpeechStatus = {
  IDLE: 'IDLE',
  RECORDING: 'RECORDING',
  TRANSCRIBING: 'TRANSCRIBING',
  SPEAKING: 'SPEAKING',
  ERROR: 'ERROR'
};

const listeners = new Set();
let currentStatus = SpeechStatus.IDLE;

export function onSpeechStatusChange(fn) {
  listeners.add(fn);
  fn(currentStatus, { whistleReady, whistleProgress });
  return () => listeners.delete(fn);
}

function notify(status, extra = {}) {
  currentStatus = status;
  for (const fn of listeners) {
    try {
      fn(currentStatus, { whistleReady, whistleProgress, ...extra });
    } catch (e) {
      console.error(e);
    }
  }
}

/**
 * Initialize or get cached Whistle instance
 */
export async function getWhistle() {
  if (whistleInstance && whistleReady) return whistleInstance;
  if (whistleLoading) return null;

  whistleLoading = true;
  notify(SpeechStatus.IDLE, { message: 'Loading Whistle speech model...' });

  try {
    whistleInstance = await createWhistle({
      cache: true,
      onDownloadProgress({ loaded, total, percentage }) {
        const pct = percentage !== undefined ? Math.round(percentage) : (total ? Math.round((loaded / total) * 100) : 0);
        whistleProgress = { loaded, total: total || 16919407, percentage: pct };
        notify(currentStatus, { whistleProgress });
      }
    });

    whistleReady = true;
    whistleLoading = false;
    notify(SpeechStatus.IDLE, { message: 'Whistle model ready' });
    return whistleInstance;
  } catch (err) {
    whistleLoading = false;
    console.warn('Failed to load Whistle model:', err);
    notify(SpeechStatus.ERROR, { error: err.message });
    throw err;
  }
}

/**
 * Record and transcribe microphone input
 */
export async function toggleMicrophone(onResultCallback) {
  if (isRecording()) {
    notify(SpeechStatus.TRANSCRIBING);
    try {
      const audioData = await stopRecording();
      if (!audioData || audioData.samples.length === 0) {
        notify(SpeechStatus.IDLE);
        return;
      }

      // Try Whistle transcription
      try {
        const whistle = await getWhistle();
        if (whistle) {
          const result = await whistle.transcribe({
            samples: audioData.samples,
            sampleRate: audioData.sampleRate
          });

          notify(SpeechStatus.IDLE);
          if (result && result.text) {
            onResultCallback(result.text.trim(), 'whistle');
            return;
          }
        }
      } catch (whistleErr) {
        console.warn('Whistle transcription failed or model not ready, falling back to Web Speech API...', whistleErr);
      }

      notify(SpeechStatus.IDLE);
    } catch (err) {
      notify(SpeechStatus.ERROR, { error: err.message });
    }
  } else {
    // Start recording
    try {
      await startRecording();
      notify(SpeechStatus.RECORDING);
    } catch (err) {
      // If microphone blocked or error
      notify(SpeechStatus.ERROR, { error: err.message });
    }
  }
}

/**
 * Alternative instant speech recognition via browser Web Speech API
 */
export function startWebSpeechRecognition(onResult, onError) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (onError) onError('Web Speech API is not supported in this browser.');
    return null;
  }

  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    notify(SpeechStatus.RECORDING);
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    notify(SpeechStatus.IDLE);
    if (onResult) onResult(transcript, 'webspeech');
  };

  recognition.onerror = (event) => {
    notify(SpeechStatus.ERROR, { error: event.error });
    if (onError) onError(event.error);
  };

  recognition.onend = () => {
    notify(SpeechStatus.IDLE);
  };

  recognition.start();
  return recognition;
}

/**
 * Text-to-Speech using browser native SpeechSynthesis API
 */
let isMuted = false;
let selectedVoice = null;

export function getAvailableVoices() {
  if (!window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

export function setTTSVoice(voice) {
  selectedVoice = voice;
}

export function setMuted(muted) {
  isMuted = muted;
  if (isMuted) stopSpeaking();
}

export function getMuted() {
  return isMuted;
}

export function speakText(text) {
  if (isMuted || !window.speechSynthesis) return;

  stopSpeaking();

  // Strip markdown, URLs, and JSON symbols for natural speech
  const cleanText = text
    .replace(/[*_#`~[\]]/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  utterance.onstart = () => notify(SpeechStatus.SPEAKING);
  utterance.onend = () => notify(SpeechStatus.IDLE);
  utterance.onerror = () => notify(SpeechStatus.IDLE);

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
    if (currentStatus === SpeechStatus.SPEAKING) {
      notify(SpeechStatus.IDLE);
    }
  }
}


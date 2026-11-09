/**
 * Cactus Needle Engine Lifecycle & Orchestrator
 * Runs WebAssembly Needle 3 model locally inside the browser.
 * Zero API keys. Zero Python. Zero cloud inference.
 */

import { createNeedle } from 'cactus-needle/browser';
import { registeredTools } from './tools.js';

// Needle engine state
export const NeedleState = {
  UNINITIALIZED: 'UNINITIALIZED',
  LOADING: 'LOADING',
  DOWNLOADING: 'DOWNLOADING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  ERROR: 'ERROR'
};

let currentNeedleInstance = null;
let currentStatus = NeedleState.UNINITIALIZED;
let downloadProgress = { loaded: 0, total: 35335380, percentage: 0 };
let lastError = null;
const stateChangeListeners = new Set();

export function onNeedleStateChange(listener) {
  stateChangeListeners.add(listener);
  // Emit current state immediately
  listener({
    state: currentStatus,
    progress: downloadProgress,
    error: lastError
  });
  return () => stateChangeListeners.delete(listener);
}

function updateState(newState, extra = {}) {
  currentStatus = newState;
  if (extra.progress) downloadProgress = { ...downloadProgress, ...extra.progress };
  if (extra.error !== undefined) lastError = extra.error;

  for (const listener of stateChangeListeners) {
    try {
      listener({
        state: currentStatus,
        progress: downloadProgress,
        error: lastError
      });
    } catch (e) {
      console.error('Error in Needle state listener:', e);
    }
  }
}

/**
 * Initialize or get active Cactus Needle instance
 */
export async function initNeedle() {
  if (currentNeedleInstance && currentStatus === NeedleState.READY) {
    return currentNeedleInstance;
  }

  updateState(NeedleState.LOADING, { error: null });

  try {
    console.log('[Shrishti AI] Initializing Cactus Needle browser engine...');

    currentNeedleInstance = await createNeedle({
      tools: registeredTools,
      stateless: true, // Independent completions without carry-over hallucinations
      cache: true, // Use browser CacheStorage
      onDownloadProgress({ loaded, total, percentage }) {
        const pct = percentage !== undefined ? Math.round(percentage) : (total ? Math.round((loaded / total) * 100) : 0);
        updateState(NeedleState.DOWNLOADING, {
          progress: { loaded, total: total || 35335380, percentage: pct }
        });
      }
    });

    console.log('[Shrishti AI] Cactus Needle engine initialized and ready!');
    updateState(NeedleState.READY, {
      progress: { percentage: 100 }
    });

    // Register clean shutdown on window unload
    window.addEventListener('beforeunload', () => {
      closeNeedle();
    });

    return currentNeedleInstance;
  } catch (err) {
    console.error('[Shrishti AI] Failed to initialize Needle:', err);
    updateState(NeedleState.ERROR, { error: err.message || String(err) });
    throw err;
  }
}

/**
 * Execute user message using Needle tool-calling loop
 */
export async function runWithNeedle(userMessage, options = {}) {
  const needle = await initNeedle();

  updateState(NeedleState.RUNNING);

  try {
    // Real Needle execution loop
    const result = await needle.run(userMessage, {
      maxSteps: 5,
      strict: false,
      abortSignal: options.abortSignal
    });

    updateState(NeedleState.READY);
    return result;
  } catch (err) {
    updateState(NeedleState.READY);
    throw err;
  }
}

/**
 * Cleanly close the Needle engine and release WebAssembly worker memory
 */
export async function closeNeedle() {
  if (currentNeedleInstance) {
    try {
      console.log('[Shrishti AI] Terminating Needle worker and releasing WASM memory...');
      await currentNeedleInstance.close();
    } catch (e) {
      console.warn('Error closing Needle instance:', e);
    } finally {
      currentNeedleInstance = null;
      updateState(NeedleState.UNINITIALIZED);
    }
  }
}

export function getNeedleStatus() {
  return {
    state: currentStatus,
    progress: downloadProgress,
    error: lastError,
    isReady: currentStatus === NeedleState.READY
  };
}

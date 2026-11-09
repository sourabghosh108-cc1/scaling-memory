/**
 * Audio Recording and PCM Extraction for Whistle Speech Recognition
 * Captures microphone stream and decodes to mono PCM Float32Array samples.
 */

let mediaStream = null;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;

export const RecordingState = {
  INACTIVE: 'INACTIVE',
  RECORDING: 'RECORDING',
  PROCESSING: 'PROCESSING'
};

export async function requestMicrophonePermission() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Microphone access is not supported by your browser.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
  });
  return stream;
}

/**
 * Start recording from the microphone
 */
export async function startRecording() {
  audioChunks = [];
  mediaStream = await requestMicrophonePermission();

  // Prefer standard web audio or media recorder
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
    ? 'audio/webm;codecs=opus'
    : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
      ? 'audio/ogg;codecs=opus'
      : '';

  mediaRecorder = new MediaRecorder(mediaStream, mimeType ? { mimeType } : undefined);

  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.start(250); // Slice chunks every 250ms
  return RecordingState.RECORDING;
}

/**
 * Stop recording and return decoded PCM samples suitable for Whistle
 * Accepts up to 30 seconds of audio.
 */
export async function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    return null;
  }

  return new Promise((resolve, reject) => {
    mediaRecorder.onstop = async () => {
      // Stop all tracks in mediaStream
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      }

      try {
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        const arrayBuffer = await audioBlob.arrayBuffer();

        // Decode using browser Web Audio API AudioContext
        if (!audioContext || audioContext.state === 'closed') {
          audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        }

        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get single channel mono samples
        const channelData = audioBuffer.getChannelData(0);

        // Ensure max 30 seconds
        const maxSamples = 30 * audioBuffer.sampleRate;
        const clampedSamples = channelData.length > maxSamples
          ? channelData.subarray(0, maxSamples)
          : channelData;

        resolve({
          samples: clampedSamples,
          sampleRate: audioBuffer.sampleRate,
          duration: audioBuffer.duration
        });
      } catch (err) {
        reject(new Error(`Failed to decode microphone audio: ${err.message}`));
      }
    };

    mediaRecorder.stop();
  });
}

export function isRecording() {
  return mediaRecorder && mediaRecorder.state === 'recording';
}


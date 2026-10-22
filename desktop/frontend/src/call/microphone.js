const CONSENT_KEY = 'postly.micConsent';

export const isCallingSupported = () =>
  Boolean(navigator.mediaDevices?.getUserMedia && window.RTCPeerConnection);

export const hasMicConsent = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'granted';
  } catch (_) {
    return false;
  }
};

export const saveMicConsent = () => {
  try {
    localStorage.setItem(CONSENT_KEY, 'granted');
  } catch (_) {}
};

export const openMicrophone = () =>
  navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: false,
  });

export const stopStream = (stream) => {
  stream?.getTracks().forEach((t) => t.stop());
};

export const describeMicError = (e) => {
  switch (e?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        text: 'Доступ к микрофону запрещён в настройках системы. Разрешите его и попробуйте снова.',
        settings: true,
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
      return {
        text: 'Микрофон не найден. Подключите микрофон и попробуйте снова.',
        settings: true,
      };
    case 'NotReadableError':
    case 'AbortError':
      return {
        text: 'Микрофон занят другим приложением или недоступен.',
        settings: true,
      };
    default:
      return { text: 'Не удалось включить микрофон.', settings: false };
  }
};

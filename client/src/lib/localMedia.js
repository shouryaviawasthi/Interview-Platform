const preparedStreams = new Map();

export const acquireLocalMedia = async () => {
  if (!window.isSecureContext) {
    throw new Error(
      "Camera and microphone access requires HTTPS on phones. Open the interview using a trusted HTTPS link."
    );
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser does not support camera and microphone access.");
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });
    return { stream, warning: null };
  } catch (mediaError) {
    if (mediaError?.name === "NotAllowedError" || mediaError?.name === "PermissionDeniedError") {
      throw new Error("Allow both camera and microphone access in your browser settings, then try again.");
    }
    if (mediaError?.name === "NotFoundError" || mediaError?.name === "OverconstrainedError") {
      throw new Error("This device needs an available camera and microphone to join the interview.");
    }
    throw new Error(mediaError?.message || "Couldn't access the camera and microphone.");
  }
};

export const savePreparedMedia = (key, stream, warning = null) => {
  const previous = preparedStreams.get(key);
  if (previous) {
    clearTimeout(previous.timeout);
    previous.stream.getTracks().forEach((track) => track.stop());
  }

  const timeout = setTimeout(() => {
    const prepared = preparedStreams.get(key);
    if (prepared?.stream === stream) {
      stream.getTracks().forEach((track) => track.stop());
      preparedStreams.delete(key);
    }
  }, 30000);

  preparedStreams.set(key, { stream, warning, timeout });
};

export const takePreparedMedia = (key) => {
  const prepared = preparedStreams.get(key);
  if (!prepared) return null;
  clearTimeout(prepared.timeout);
  preparedStreams.delete(key);
  return { stream: prepared.stream, warning: prepared.warning };
};

import { useEffect } from 'react';

export const useVolumeMeter = (localStream, isMicOn, volumeBarRef) => {
  useEffect(() => {
    let audioContext, analyser, source, animationFrameId;
    
    if (localStream && isMicOn) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.smoothingTimeConstant = 0.7;
      analyser.fftSize = 256;

      try {
        source = audioContext.createMediaStreamSource(localStream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVolume = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const average = sum / dataArray.length;
          if (volumeBarRef.current) {
            volumeBarRef.current.style.height = `${Math.min(average * 1.5, 100)}%`;
          }
          animationFrameId = requestAnimationFrame(updateVolume);
        };
        updateVolume();
      } catch (err) {
        console.warn("Could not create media stream source for volume meter", err);
      }
    } else if (volumeBarRef.current) {
      volumeBarRef.current.style.height = "0%";
    }
    
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext && audioContext.state !== "closed") audioContext.close();
      if (volumeBarRef.current) {
        volumeBarRef.current.style.height = "0%";
        volumeBarRef.current.style.width = "0%";
      }
    };
  }, [localStream, isMicOn, volumeBarRef]);
};

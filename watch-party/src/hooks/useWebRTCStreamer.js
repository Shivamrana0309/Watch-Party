import { useState, useEffect, useRef } from 'react';

export default function useWebRTCStreamer({
  isConnected,
  sendData,
  subscribeToData,
  startMovieShare,
  stopMovieShare
}) {
  const [fileName, setFileName] = useState("");
  const [isStreamer, setIsStreamer] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('Good');

  const streamRef = useRef(null);
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const audioContextRef = useRef(null);
  const mediaElementSourceRef = useRef(null);
  const mediaStreamDestinationRef = useRef(null);
  const statsIntervalRef = useRef(null);

  const videoUrlRef = useRef('');
  const videoRef = useRef(null);
  const lastSyncTime = useRef(0);
  const ignoreSyncUntil = useRef(0);

  // ── Clean up local movie capture resources ──
  const cleanupMediaAndCalls = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }

    setNetworkQuality('Good');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMediaAndCalls();
      stopMovieShare();
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  // ── Subscribe to data channel events for video sync ──
  useEffect(() => {
    const unsubscribe = subscribeToData((data) => {
      if (!data || !data.type) return;

      if (data.type === 'STREAM_TAKEOVER') {
        setIsStreamer(false);
        if (videoUrlRef.current) {
          URL.revokeObjectURL(videoUrlRef.current);
          videoUrlRef.current = '';
        }
        if (videoRef.current) {
          videoRef.current.removeAttribute('src');
          videoRef.current.srcObject = null;
        }
      } else if (data.type === 'SYNC_STATE') {
        if (!isStreamer && !isScrubbing && Date.now() > ignoreSyncUntil.current) {
          setCurrentTime(data.currentTime);
          setDuration(data.duration);
          setIsPaused(data.isPaused);
        }
      } else if (data.type === 'COMMAND') {
        if (isStreamer && videoRef.current) {
          const video = videoRef.current;
          if (data.action === 'play') {
            video.play().catch(console.error);
          } else if (data.action === 'pause') {
            video.pause();
          } else if (data.action === 'seek') {
            if (data.value !== undefined) {
              video.currentTime = data.value;
            }
          }
        }
      }
    });

    return unsubscribe;
  }, [subscribeToData, isStreamer, isScrubbing]);

  // ── Movie file handling & capture stream pipeline ──
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFileName(file.name);
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      videoUrlRef.current = url;
      setIsStreamer(true);

      if (videoRef.current) {
        videoRef.current.srcObject = null;
        videoRef.current.src = url;
      }

      // Notify the peer that we are taking over as the streamer
      sendData({ type: 'STREAM_TAKEOVER' });
    }
  };

  const applyHighQualitySenderSettings = (peerConnection) => {
    if (!peerConnection) return;

    setTimeout(() => {
      try {
        const senders = peerConnection.getSenders();
        senders.forEach((sender) => {
          if (sender.track && sender.track.kind === 'video') {
            const params = sender.getParameters();
            if (!params.encodings || params.encodings.length === 0) {
              params.encodings = [{}];
            }

            // Set max bitrate to 8 Mbps (8,000,000 bps) for high-definition streaming
            params.encodings[0].maxBitrate = 8000000;
            params.encodings[0].priority = 'high';
            params.encodings[0].networkPriority = 'high';

            // Critical: Never downscale the resolution, prioritize frame detail
            params.degradationPreference = 'maintain-resolution';

            sender.setParameters(params).catch((err) => {
              console.warn('Unable to set RTCRtpSender parameters:', err);
            });
          }
        });
      } catch (err) {
        console.warn('Sender optimization failed:', err);
      }
    }, 500);
  };

  const startStatsMonitoring = (movieStream, isStreamerRole) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);

    statsIntervalRef.current = setInterval(() => {
      if (!movieStream || movieStream.getTracks().length === 0) {
        setNetworkQuality('Poor');
        return;
      }

      const videoTrack = movieStream.getVideoTracks()[0];
      if (videoTrack && videoTrack.readyState === 'ended') {
        setNetworkQuality('Poor');
      } else {
        setNetworkQuality('Good');
      }
    }, 3000);
  };

  const handleVideoLoadedMetadata = () => {
    if (!isStreamer) return;
    const video = videoRef.current;
    if (!video) return;

    cleanupMediaAndCalls();

    if (!isConnected) return;

    let finalStream = new MediaStream();
    let fallbackToCanvas = false;
    let capturedVideoTrack = null;
    let originalAudioTrack = null;

    try {
      const captured = video.captureStream ? video.captureStream(60) : (video.mozCaptureStream ? video.mozCaptureStream(60) : null);
      if (captured && captured.getVideoTracks().length > 0) {
        capturedVideoTrack = captured.getVideoTracks()[0];
        if (captured.getAudioTracks().length > 0) {
          originalAudioTrack = captured.getAudioTracks()[0];
        }
      } else {
        fallbackToCanvas = true;
      }
    } catch (e) {
      fallbackToCanvas = true;
    }

    if (fallbackToCanvas) {
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

      const renderFrame = () => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        if ('requestVideoFrameCallback' in video) {
          video.requestVideoFrameCallback(renderFrame);
        } else {
          animationFrameId.current = requestAnimationFrame(renderFrame);
        }
      };

      if ('requestVideoFrameCallback' in video) {
        video.requestVideoFrameCallback(renderFrame);
      } else {
        animationFrameId.current = requestAnimationFrame(renderFrame);
      }

      const canvasStream = canvas.captureStream(60);
      if (canvasStream.getVideoTracks().length > 0) {
        capturedVideoTrack = canvasStream.getVideoTracks()[0];
      }
    }

    if (capturedVideoTrack) {
      if ('contentHint' in capturedVideoTrack) {
        capturedVideoTrack.contentHint = 'detail';
      }
      finalStream.addTrack(capturedVideoTrack);
    }

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      if (!mediaElementSourceRef.current) {
        mediaElementSourceRef.current = audioCtx.createMediaElementSource(video);
        mediaStreamDestinationRef.current = audioCtx.createMediaStreamDestination();

        mediaElementSourceRef.current.connect(mediaStreamDestinationRef.current);
        mediaElementSourceRef.current.connect(audioCtx.destination);
      }

      if (mediaStreamDestinationRef.current.stream.getAudioTracks().length > 0) {
        finalStream.addTrack(mediaStreamDestinationRef.current.stream.getAudioTracks()[0]);
      }
    } catch (e) {
      console.warn("Web Audio API failed, falling back to captureStream track", e);
      if (originalAudioTrack) finalStream.addTrack(originalAudioTrack);
    }

    if (!finalStream || finalStream.getTracks().length === 0) return;

    streamRef.current = finalStream;

    startMovieShare(finalStream);
    startStatsMonitoring(finalStream, true);
  };

  const sendSyncState = () => {
    if (!isStreamer || !videoRef.current) return;

    const video = videoRef.current;
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);
    setIsPaused(video.paused);

    if (!isConnected) return;

    const now = Date.now();
    if (now - lastSyncTime.current < 250) return;
    lastSyncTime.current = now;

    sendData({
      type: 'SYNC_STATE',
      currentTime: video.currentTime,
      duration: video.duration || 0,
      isPaused: video.paused
    });
  };

  const handleTimeUpdate = () => {
    if (isStreamer) sendSyncState();
  };

  const handlePlayPauseEvent = () => {
    if (isStreamer) {
      const video = videoRef.current;
      if (!video) return;

      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
      setIsPaused(video.paused);

      if (!isConnected) return;

      sendData({
        type: 'SYNC_STATE',
        currentTime: video.currentTime,
        duration: video.duration || 0,
        isPaused: video.paused
      });
      lastSyncTime.current = Date.now();
    }
  };

  const handleWaiting = () => {
    if (isStreamer) sendSyncState();
  };

  const togglePlayPause = () => {
    if (isStreamer) {
      const video = videoRef.current;
      if (video) {
        if (video.paused) video.play().catch(console.error);
        else video.pause();
      }
    } else {
      sendData({ type: 'COMMAND', action: isPaused ? 'play' : 'pause' });
      setIsPaused(!isPaused);
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);

    if (isStreamer) {
      if (videoRef.current) videoRef.current.currentTime = newTime;
      sendSyncState();
    } else {
      ignoreSyncUntil.current = Date.now() + 500;
      sendData({ type: 'COMMAND', action: 'seek', value: newTime });
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "00:00";
    const m = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return {
    videoRef,
    videoUrlRef,
    fileName,
    isStreamer,
    currentTime,
    duration,
    isPaused,
    isScrubbing,
    networkQuality,
    handleFileChange,
    applyHighQualitySenderSettings,
    startStatsMonitoring,
    handleVideoLoadedMetadata,
    sendSyncState,
    handleTimeUpdate,
    handlePlayPauseEvent,
    handleWaiting,
    togglePlayPause,
    handleSeek,
    formatTime,
    cleanupMediaAndCalls,
    setIsScrubbing
  };
}

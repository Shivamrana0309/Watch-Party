import React, { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';
import {
  Maximize, Minimize, Mic, MicOff, Video as VideoIcon, VideoOff,
  FolderOpen, Copy, PhoneCall, PhoneOff, CheckCircle2, Play, Pause,
  User, Sun, Moon, Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCallContext } from './context/CallContext';

export default function WebRTCWatchParty() {
  const navigate = useNavigate();

  // ── Pull everything from the global CallContext ──
  const {
    peerId, friendId, setFriendId,
    localStream, remoteStream,
    remoteMovieStream, startMovieShare, stopMovieShare,
    callFriend, acceptCall, rejectCall, leaveCall,
    isConnected, callStatus, incomingCall,
    user1Media, user2Media, toggleLocalMic, toggleLocalCam,
    sendData, subscribeToData,
    localVideoDOM, remoteVideoDOM
  } = useCallContext();

  // UI & Player State
  const [fileName, setFileName] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [showProfile, setShowProfile] = useState(false);
  const [userInfo] = useState({ name: 'Guest User', username: '@guest' });
  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });

  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);
  const profileDropdownRef = useRef(null);

  // Theme persistence
  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  // Close profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [isStreamer, setIsStreamer] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('Good');

  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeoutRef = useRef(null);

  const handleMouseMove = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setControlsVisible(false), 5000);
  };

  const handleMouseLeave = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setControlsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const ignoreSyncUntil = useRef(0);

  // Local-only refs for movie streaming pipeline (canvas fallback, audio routing, stats)
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

  // Webcam video element refs — these attach to context streams
  const localVideoCamRef = useRef(null);
  const remoteVideoCamRef = useRef(null);
  const volumeBarRef = useRef(null);

  // ── Attach context webcam streams to local video elements ──
  useEffect(() => {
    if (localVideoCamRef.current && localStream) {
      localVideoCamRef.current.srcObject = localStream;
      localVideoCamRef.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoCamRef.current && remoteStream) {
      remoteVideoCamRef.current.srcObject = remoteStream;
      remoteVideoCamRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  // Volume Bar Logic
  useEffect(() => {
    let audioContext, analyser, source, animationFrameId;
    if (localStream && user1Media.mic) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.smoothingTimeConstant = 0.7;
      analyser.fftSize = 256;

      source = audioContext.createMediaStreamSource(localStream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        if (volumeBarRef.current) volumeBarRef.current.style.height = `${Math.min(average * 1.5, 100)}%`;
        animationFrameId = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } else if (volumeBarRef.current) {
      volumeBarRef.current.style.height = "0%";
    }
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext && audioContext.state !== "closed") audioContext.close();
    };
  }, [localStream, user1Media.mic]);

  // ── Attach remote movie stream to the main video player ──
  useEffect(() => {
    if (remoteMovieStream && videoRef.current && !isStreamer) {
      videoRef.current.removeAttribute('src');
      videoRef.current.srcObject = remoteMovieStream;
      videoRef.current.play().catch(e => console.error("Autoplay blocked:", e));
    }
  }, [remoteMovieStream, isStreamer]);

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

  /**
   * Enforces 1080p/4K bitrates and prevents WebRTC from degrading resolution.
   */
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

    // Stats monitoring requires a peerConnection, which we don't have direct access to
    // from the context. We skip detailed RTCPeerConnection stats for now and just monitor
    // the stream's track states.
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
      // Capture the source video at full 60fps / native refresh rate
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

    // Tell WebRTC encoder to maintain crisp 1080p/4K resolution
    if (capturedVideoTrack) {
      if ('contentHint' in capturedVideoTrack) {
        capturedVideoTrack.contentHint = 'detail';
      }
      finalStream.addTrack(capturedVideoTrack);
    }

    // Audio routing
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      // CRITICAL: Only create these nodes ONCE per <video> element
      if (!mediaElementSourceRef.current) {
        mediaElementSourceRef.current = audioCtx.createMediaElementSource(video);
        mediaStreamDestinationRef.current = audioCtx.createMediaStreamDestination();

        mediaElementSourceRef.current.connect(mediaStreamDestinationRef.current);
        // Connect to destination so the local streamer can still hear the movie
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

    // Use CallContext's startMovieShare to send the movie stream via PeerJS
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

  const copyToClipboard = () => {
    navigator.clipboard.writeText(peerId);
  };

  const toggleFullscreen = () => {
    const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement;
    if (!isFull) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else if (containerRef.current?.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Derive connection status string from context
  const connectionStatus = isConnected ? 'Connected' : (callStatus || 'Disconnected');
  const isCalling = callStatus === 'Ringing...';

  return (
    <div className="watch-party-room">
      <style>{`
        body.dark-mode {
          background-color: #121212 !important;
          color: #e5e5e5 !important;
        }
        body.dark-mode .watch-party-room {
          background-color: #121212 !important;
        }
        body.dark-mode button.btn-join, body.dark-mode .connect-btn {
          background-color: #1f2937 !important;
          color: #e5e5e5 !important;
          border-color: #374151 !important;
        }
        body.dark-mode button.btn-join.active {
          background-color: #2563eb !important;
          color: #ffffff !important;
          border-color: #1d4ed8 !important;
        }
        body.dark-mode .room-id-panel, body.dark-mode .friend-connect-panel, body.dark-mode .connected-panel-wrap {
          background-color: #1e1e1e !important;
          border-color: #333 !important;
          color: #e5e5e5 !important;
        }
        body.dark-mode .room-id-label, body.dark-mode .room-id-code, body.dark-mode .friend-id-input {
          color: #e5e5e5 !important;
          background-color: transparent !important;
        }
        body.dark-mode .friend-id-input {
          background-color: #1f2937 !important;
          border-color: #374151 !important;
        }
        body.dark-mode .player-panel {
          background-color: #1a1a1a !important;
          box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.8) !important;
        }
      `}</style>

      <div className="connection-row top-controls-row" style={{ display: 'flex', gap: '1rem', width: '100%', maxWidth: '1600px', marginBottom: '0.25rem', alignItems: 'flex-end' }}>
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="action-area" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap', width: '100%' }}>
            <button className="btn-join" onClick={() => navigate('/party')} style={{ flex: 1, whiteSpace: 'nowrap', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.65rem 0.5rem' }}>
              <svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              JOIN A PARTY
            </button>
            <button className="btn-join" onClick={() => navigate('/local-sync')} style={{ flex: 1, whiteSpace: 'nowrap', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.65rem 0.5rem' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              SYNC LOCAL VIDEO
            </button>
            <button className="btn-join" onClick={() => navigate('/screen-share')} style={{ flex: 1, whiteSpace: 'nowrap', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.65rem 0.5rem' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              SHARE SCREEN
            </button>
            <button className="btn-join active" onClick={() => navigate('/watch-party')} style={{ flex: 1, whiteSpace: 'nowrap', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0.65rem 0.5rem' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
              WEBRTC PARTY
            </button>
          </div>

          <div style={{ display: 'flex', gap: '1rem', margin: 0, height: '52px', alignItems: 'center' }}>
            <label className="btn btn-join" style={{ 
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem", 
              fontSize: '0.85rem', padding: '0.65rem 1.25rem', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', margin: 0, height: '100%'
            }}>
              <FolderOpen size={16} />
              UPLOAD VIDEO
              <input type="file" accept="video/mp4,video/webm" onChange={handleFileChange} style={{ display: "none" }} />
            </label>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: '100%', marginLeft: '0.5rem' }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", color: "#475569", whiteSpace: "nowrap", flex: 1 }}>
                <strong>Your File:</strong> &nbsp;{fileName || "None"}
              </div>
            </div>
          </div>
        </div>

        <div className="room-id-panel" style={{ flex: 1, margin: 0, height: '52px', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
          <span className="room-id-label" style={{ whiteSpace: 'nowrap' }}>
            {isConnected ? "Active Room ID:" : "Your Room ID:"}
          </span>
          <code className="room-id-code">{peerId || "Generating..."}</code>
          <button onClick={copyToClipboard} className="copy-id-btn" title="Copy Room ID">
            <Copy size={16} />
          </button>
        </div>

        <div className="friend-connect-panel" style={{ flex: 1, margin: 0, height: '52px', position: 'relative', display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
          <div style={{ position: 'absolute', top: '-60px', right: '0', display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div 
              onClick={() => setIsDarkMode(!isDarkMode)}
              style={{
                width: '64px', height: '38px', borderRadius: '19px', 
                backgroundColor: isDarkMode ? '#374151' : '#cbd5e1',
                display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'relative',
                transition: 'background-color 0.3s',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'absolute', left: isDarkMode ? '29px' : '3px', transition: 'left 0.3s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
              }}>
                {isDarkMode ? <Moon size={18} color="#000" /> : <Sun size={18} color="#000" />}
              </div>
            </div>

            <div ref={profileDropdownRef} style={{ position: 'relative' }}>
              <button 
                onClick={() => setShowProfile(!showProfile)}
                style={{
                  width: '38px', height: '38px', borderRadius: '50%', backgroundColor: '#e2e8f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
              >
                <User size={18} color="#475569" />
              </button>
            
              {showProfile && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
                  backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem',
                  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                  width: '180px', padding: '1rem', zIndex: 50,
                  display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{userInfo.name}</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{userInfo.username}</span>
                  </div>
                  <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: 0 }} />
                  <button 
                    onClick={() => {
                      localStorage.removeItem('token');
                      window.location.href='/';
                    }} 
                    style={{
                      backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '0.25rem',
                      padding: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500, width: '100%'
                    }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>

          {isConnected ? (
            <div className="connected-panel-wrap">
              <div className="connected-badge" style={{ whiteSpace: 'nowrap' }}>
                <CheckCircle2 size={18} className="text-green-600" />
                <span>Connected to <strong>Partner</strong></span>
              </div>
              <button onClick={leaveCall} className="leave-btn" title="Leave Call">
                <PhoneOff size={16} />
                Leave Call
              </button>
            </div>
          ) : isCalling ? (
            <div className="connected-panel-wrap">
              <div className="connected-badge" style={{ whiteSpace: 'nowrap', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                <PhoneCall size={18} className="animate-pulse" />
                <span>Calling <strong>{friendId}</strong>...</span>
              </div>
              <button onClick={leaveCall} className="leave-btn" style={{ backgroundColor: '#ef4444' }} title="Cancel Call">
                <PhoneOff size={16} />
                Cancel
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Paste Friend's ID here..."
                value={friendId}
                onChange={(e) => setFriendId(e.target.value.toUpperCase())}
                className="friend-id-input"
                style={{ textTransform: "uppercase", height: '36px' }}
              />
              <button onClick={callFriend} disabled={!friendId.trim()} className="connect-btn" style={{ whiteSpace: 'nowrap', height: '36px' }}>
                <PhoneCall size={16} />
                Connect
              </button>
            </>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={isFullscreen ? "video-shell is-fullscreen" : "video-shell"}
      >
        <div className={isFullscreen ? "player-panel is-fullscreen" : "player-panel"}>
          <div
            className="local-video-host"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ width: "100%", height: isFullscreen ? "100%" : "auto", aspectRatio: isFullscreen ? "auto" : "16 / 9", backgroundColor: isDarkMode ? '#1a1a1a' : '#000', position: "relative", cursor: controlsVisible ? "default" : "none" }}
          >
            <video 
              ref={videoRef}
              playsInline
              onClick={togglePlayPause}
              onLoadedMetadata={handleVideoLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPlay={handlePlayPauseEvent}
              onPause={handlePlayPauseEvent}
              onWaiting={handleWaiting}
              style={{ width: "100%", height: "100%", objectFit: "contain", cursor: controlsVisible ? "pointer" : "none", display: videoUrlRef.current || (isConnected && !isStreamer) ? "block" : "none" }}
            />
            {incomingCall && (
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                  padding: "2rem",
                  borderRadius: "1rem",
                  boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "1.5rem",
                  zIndex: 100,
                  border: isDarkMode ? '1px solid #374151' : '1px solid #e5e7eb'
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div style={{ display: "inline-flex", padding: "1rem", borderRadius: "9999px", backgroundColor: "#dbeafe", color: "#2563eb", marginBottom: "1rem" }}>
                    <PhoneCall size={32} className="animate-pulse" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: "600", color: isDarkMode ? '#f8fafc' : '#1e293b' }}>Incoming Call</h3>
                  <p style={{ margin: "0.5rem 0 0 0", color: isDarkMode ? '#94a3b8' : '#64748b' }}>
                    <strong style={{ color: isDarkMode ? '#e2e8f0' : '#334155' }}>{incomingCall.callerId || "Someone"}</strong> wants to connect.
                  </p>
                </div>
                <div style={{ display: "flex", gap: "1rem", width: "100%" }}>
                  <button onClick={rejectCall} style={{ flex: 1, padding: "0.75rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#fee2e2", color: "#ef4444", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fecaca'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}>
                    Reject
                  </button>
                  <button onClick={acceptCall} style={{ flex: 1, padding: "0.75rem", borderRadius: "0.5rem", border: "none", backgroundColor: "#dcfce3", color: "#16a34a", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#bbf7d0'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dcfce3'}>
                    Accept
                  </button>
                </div>
              </div>
            )}
            {(!videoUrlRef.current && (!isConnected || (isConnected && isStreamer && !videoUrlRef.current))) && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  color: "#9ca3af",
                  flexDirection: "column",
                  gap: "0.5rem",
                  position: "absolute",
                  inset: 0
                }}
              >
                <FolderOpen size={48} />
                <p>Please select a local video file above or connect to a partner.</p>
              </div>
            )}

            <div 
              className="player-controls-overlay" 
              onClick={(e) => e.stopPropagation()}
              style={{ 
                display: 'flex', flexDirection: 'column', gap: '0.5rem', 
                background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', 
                padding: '1rem', boxSizing: 'border-box', position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
                opacity: controlsVisible ? 1 : 0,
                pointerEvents: controlsVisible ? 'auto' : 'none',
                transition: 'opacity 0.3s ease'
              }}
            >
              <div className="flex items-center gap-2 w-full">
                <span className="text-xs text-gray-200 font-mono w-10 text-right">{formatTime(currentTime)}</span>
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 100}
                  value={currentTime || 0}
                  onMouseDown={() => setIsScrubbing(true)}
                  onTouchStart={() => setIsScrubbing(true)}
                  onMouseUp={() => setIsScrubbing(false)}
                  onTouchEnd={() => setIsScrubbing(false)}
                  onChange={handleSeek}
                  style={{
                    background: `linear-gradient(to right, #3b82f6 ${duration ? (currentTime / duration) * 100 : 0}%, #4b5563 ${duration ? (currentTime / duration) * 100 : 0}%)`
                  }}
                  className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
                />
                <span className="text-xs text-gray-200 font-mono w-10">{formatTime(duration)}</span>
              </div>
              <div className="flex items-center justify-between mt-1 px-1 w-full">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={togglePlayPause}
                    className="text-white hover:text-blue-400 transition-colors flex items-center justify-center w-8 h-8"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
                  >
                    {isPaused ? (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M8 5v14l11-7z"/></svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    )}
                  </button>
                  
                  <div className="text-xs text-gray-300 font-medium bg-gray-800/80 px-2 py-1 rounded">
                    Role: {isStreamer ? <span className="text-green-400">Streamer</span> : <span className="text-blue-400">Viewer</span>}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button type="button" onClick={toggleFullscreen} className="text-gray-300 hover:text-white transition-colors" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
                    {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={isFullscreen ? "camera-column is-fullscreen" : "camera-column"}>
          <Draggable
            bounds="parent"
            nodeRef={user1Ref}
            disabled={!isFullscreen}
            position={isFullscreen ? cam1Pos : { x: 0, y: 0 }}
            onDrag={(e, data) => setCam1Pos({ x: data.x, y: data.y })}
          >
            <div
              ref={user1Ref}
              className={`video-card video-card--self ${isFullscreen ? "is-fullscreen" : "is-inline"}`}
            >
              <div className="video-surface">
                <video
                  ref={localVideoCamRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#333', transform: 'scaleX(-1)' }}
                />
                {!user1Media.cam && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Camera Off</span>
                  </div>
                )}
                <div className="participant-tag-wrap" style={{ zIndex: 30 }}>
                  <span className="participant-tag">You</span>
                  <div className="local-volume-meter">
                    <div ref={volumeBarRef} className="local-volume-fill" />
                  </div>
                </div>
              </div>
              <div className="media-controls">
                <button
                  onClick={toggleLocalMic}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`media-toggle-btn ${user1Media.mic ? "is-on" : "is-off"}`}
                  title={user1Media.mic ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {user1Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  onClick={toggleLocalCam}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`media-toggle-btn ${user1Media.cam ? "is-on" : "is-off"}`}
                  title={user1Media.cam ? "Turn Off Camera" : "Turn On Camera"}
                >
                  {user1Media.cam ? <VideoIcon size={18} /> : <VideoOff size={18} />}
                </button>
              </div>
            </div>
          </Draggable>

          <Draggable
            bounds="parent"
            nodeRef={user2Ref}
            disabled={!isFullscreen}
            position={isFullscreen ? cam2Pos : { x: 0, y: 0 }}
            onDrag={(e, data) => setCam2Pos({ x: data.x, y: data.y })}
          >
            <div
              ref={user2Ref}
              className={`video-card video-card--friend ${isFullscreen ? "is-fullscreen" : "is-inline"}`}
            >
              <div className="video-surface video-surface--friend">
                <video
                  ref={remoteVideoCamRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#222' }}
                />

                {!isConnected && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Waiting for friend...</span>
                  </div>
                )}
                {isConnected && !user2Media.cam && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Friend's camera is off</span>
                  </div>
                )}
                <div className="participant-tag-wrap participant-tag-wrap--friend">
                  <span className="participant-tag">Friend</span>
                </div>
              </div>
              <div className="media-controls media-controls--friend">
                <div
                  className={`media-indicator-badge ${user2Media.mic ? "is-on" : "is-off"}`}
                  title={user2Media.mic ? "Partner's Mic is On" : "Partner is Muted"}
                >
                  {user2Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </div>
                <div
                  className={`media-indicator-badge ${user2Media.cam ? "is-on" : "is-off"}`}
                  title={user2Media.cam ? "Partner's Camera is On" : "Partner's Camera is Off"}
                >
                  {user2Media.cam ? <VideoIcon size={18} /> : <VideoOff size={18} />}
                </div>
              </div>
            </div>
          </Draggable>
        </div>
      </div>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize, Minimize, Mic, MicOff, Video as VideoIcon, VideoOff,
  FolderOpen, Play, Pause,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCallContext } from './context/CallContext';
import RoomHeader from './components/RoomHeader';
import IncomingCallModal from './components/IncomingCallModal';
import DraggableVideoFeeds from './components/DraggableVideoFeeds';

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
    localVideoDOM, remoteVideoDOM,
    activeRoomId
  } = useCallContext();

  // UI & Player State
  const [fileName, setFileName] = useState("");
  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });

  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);

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
    let audioContext, analyser, source, animationFrameIdLocal;
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
        animationFrameIdLocal = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } else if (volumeBarRef.current) {
      volumeBarRef.current.style.height = "0%";
    }
    return () => {
      if (animationFrameIdLocal) cancelAnimationFrame(animationFrameIdLocal);
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

  return (
    <div className="watch-party-room">
      <RoomHeader
        activeTab="watch-party"
        navigate={navigate}
        peerId={peerId}
        isConnected={isConnected}
        activeRoomId={activeRoomId}
        friendId={friendId}
        setFriendId={setFriendId}
        callFriend={callFriend}
        leaveCall={leaveCall}
        callStatus={callStatus}
        friendIdDisabled={!friendId.trim()}
        customActionWidget={
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
        }
      />

      <IncomingCallModal
        incomingCall={incomingCall}
        acceptCall={acceptCall}
        rejectCall={rejectCall}
      />

      <div
        ref={containerRef}
        className={isFullscreen ? "video-shell is-fullscreen" : "video-shell"}
      >
        <div className={isFullscreen ? "player-panel is-fullscreen" : "player-panel"}>
          <div
            className="local-video-host"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ width: "100%", height: isFullscreen ? "100%" : "auto", aspectRatio: isFullscreen ? "auto" : "16 / 9", backgroundColor: '#000', position: "relative", cursor: controlsVisible ? "default" : "none" }}
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

        <DraggableVideoFeeds
          isFullscreen={isFullscreen}
          user1Ref={user1Ref}
          user2Ref={user2Ref}
          cam1Pos={cam1Pos}
          setCam1Pos={setCam1Pos}
          cam2Pos={cam2Pos}
          setCam2Pos={setCam2Pos}
          volumeBarRef={volumeBarRef}
          user1Media={user1Media}
          user2Media={user2Media}
          toggleLocalMic={toggleLocalMic}
          toggleLocalCam={toggleLocalCam}
          remoteStream={remoteStream}
          isConnected={isConnected}
          useIsConnectedForRemote={true}
          localVideoContent={
            <video
              ref={localVideoCamRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#333', transform: 'scaleX(-1)' }}
            />
          }
          remoteVideoContent={
            <video
              ref={remoteVideoCamRef}
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: '#222' }}
            />
          }
        />
      </div>
    </div>
  );
}
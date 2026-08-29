import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';

export default function WebRTCWatchParty() {
  const [peerId, setPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState('');
  const [connection, setConnection] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  
  // UI & Player State
  const [isStreamer, setIsStreamer] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPaused, setIsPaused] = useState(true);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [networkQuality, setNetworkQuality] = useState('Good');
  
  const ignoreSyncUntil = useRef(0);

  // Refs
  const peerInstance = useRef(null);
  const mediaCallRef = useRef(null);
  const connectionRef = useRef(null);
  const streamRef = useRef(null);
  
  // Fallback Refs
  const canvasRef = useRef(null);
  const animationFrameId = useRef(null);
  const audioContextRef = useRef(null);
  const mediaElementSourceRef = useRef(null);
  const mediaStreamDestinationRef = useRef(null);
  const statsIntervalRef = useRef(null);
  
  const videoUrlRef = useRef(''); // Local object URL
  const videoRef = useRef(null);
  
  // Throttle state for updates
  const lastSyncTime = useRef(0);

  // Synchronize connection reference for callbacks
  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

  // Prevent stale closures in WebRTC callbacks
  const handleIncomingDataRef = useRef(null);
  useEffect(() => {
    handleIncomingDataRef.current = handleIncomingData;
  });

  const cleanupMediaAndCalls = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    
    if (mediaElementSourceRef.current) {
      mediaElementSourceRef.current.disconnect();
    }
    
    if (mediaStreamDestinationRef.current) {
      mediaStreamDestinationRef.current.disconnect();
      mediaStreamDestinationRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    if (mediaCallRef.current) {
      mediaCallRef.current.close();
      mediaCallRef.current = null;
    }
    
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
    
    setNetworkQuality('Good');
  };

  useEffect(() => {
    let isMounted = true;

    const initPeer = async () => {
      let iceServers = [{ urls: 'stun:stun.l.google.com:19302' }];
      
      const backendUrlStr = import.meta.env.VITE_BACKEND_URL || 'https://watch-party-74e5.onrender.com';
      
      try {
        const fetchUrl = backendUrlStr ? `${backendUrlStr}/api/turn-credentials` : '/api/turn-credentials';
        const response = await fetch(fetchUrl);
        if (response.ok) {
          const data = await response.json();
          if (data.iceServers) {
            iceServers = data.iceServers;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch TURN credentials, falling back to public STUN.', err);
      }

      if (!isMounted) return;

      const isDev = import.meta.env.DEV;
      
      const peerOptions = {
        path: '/myapp',
        config: { iceServers }
      };

      if (isDev) {
        peerOptions.host = 'localhost';
        peerOptions.port = 9000;
        peerOptions.secure = false;
      } else {
        if (backendUrlStr) {
          try {
            const url = new URL(backendUrlStr);
            peerOptions.host = url.hostname;
          } catch(e) {}
        } else {
          peerOptions.host = window.location.hostname;
        }
        peerOptions.port = 443;
        peerOptions.secure = true;
      }

      const peer = new Peer(peerOptions);
      peerInstance.current = peer;

      peer.on('open', (id) => {
        if (isMounted) setPeerId(id);
      });

      peer.on('connection', (conn) => {
        if (!isMounted) return;
        // Incoming data connection
        setConnectionStatus('Connecting...');
        
        conn.on('open', () => {
          if (isMounted) {
            setConnectionStatus(`Connected to ${conn.peer}`);
            setConnection(conn);
          }
        });

        conn.on('data', (data) => {
          if (handleIncomingDataRef.current) handleIncomingDataRef.current(data);
        });

        conn.on('close', () => {
          if (isMounted) {
             setConnectionStatus('Disconnected');
             setConnection(null);
          }
        });
        
        conn.on('error', (err) => {
          console.error('Connection error:', err);
          if (isMounted) setConnectionStatus('Error');
        });
      });

      peer.on('call', (call) => {
        if (!isMounted) return;
        // Incoming media call
        call.answer(); // Answer without local stream

        call.on('stream', (remoteStream) => {
          // Double check we're not the streamer
          if (videoRef.current) {
            videoRef.current.removeAttribute('src');
            videoRef.current.srcObject = remoteStream;
            videoRef.current.play().catch(e => console.error("Autoplay blocked:", e));
            
            startStatsMonitoring(call, false);
          }
        });
      });

      peer.on('error', (err) => {
        console.error('Peer error:', err);
        if (isMounted) setConnectionStatus(`Error: ${err.type}`);
      });
    };

    initPeer();

    // Cleanup on unmount
    return () => {
      isMounted = false;
      cleanupMediaAndCalls();
      if (peerInstance.current) {
        peerInstance.current.destroy();
        peerInstance.current = null;
      }
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  const handleIncomingData = (data) => {
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
    }
    else if (data.type === 'SYNC_STATE') {
      // If we are not the streamer, and we are not currently scrubbing, update our UI state
      if (!isStreamer && !isScrubbing && Date.now() > ignoreSyncUntil.current) {
        setCurrentTime(data.currentTime);
        setDuration(data.duration);
        setIsPaused(data.isPaused);
      }
    }
    else if (data.type === 'COMMAND') {
      // If we ARE the streamer, execute the action on our local video
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
  };

  const connectToPeer = () => {
    if (!remotePeerId.trim()) return;
    const peer = peerInstance.current;
    if (!peer) return;

    setConnectionStatus('Connecting...');
    const conn = peer.connect(remotePeerId);

    conn.on('open', () => {
      setConnectionStatus(`Connected to ${conn.peer}`);
      setConnection(conn);
    });

    conn.on('data', (data) => {
      if (handleIncomingDataRef.current) handleIncomingDataRef.current(data);
    });

    conn.on('close', () => {
      setConnectionStatus('Disconnected');
      setConnection(null);
    });
    
    conn.on('error', (err) => {
      console.error('Connection error:', err);
      setConnectionStatus('Error');
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
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

      // Notify remote peer of takeover
      if (connectionRef.current && connectionRef.current.open) {
        connectionRef.current.send({ type: 'STREAM_TAKEOVER' });
      }
    }
  };

  const startStatsMonitoring = (call, isStreamerRole) => {
    if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
    
    statsIntervalRef.current = setInterval(async () => {
      if (!call.peerConnection) return;
      try {
        const stats = await call.peerConnection.getStats();
        let isPoor = false;
        
        stats.forEach(report => {
          if (isStreamerRole && report.type === 'outbound-rtp' && report.kind === 'video') {
            if (report.qualityLimitationReason && report.qualityLimitationReason !== 'none') {
              isPoor = true;
            }
          } else if (!isStreamerRole && report.type === 'inbound-rtp' && report.kind === 'video') {
             if (report.packetsLost > 50 || report.fractionLost > 0.1) {
               isPoor = true;
             }
          }
        });
        
        setNetworkQuality(isPoor ? 'Poor' : 'Good');
      } catch (e) {
        // ignore
      }
    }, 3000);
  };

  const handleVideoLoadedMetadata = () => {
    if (!isStreamer) return; // Only streamer captures and sends stream
    const video = videoRef.current;
    if (!video) return;

    cleanupMediaAndCalls();

    if (!peerInstance.current || !connectionRef.current) return;

    let finalStream = new MediaStream();
    let fallbackToCanvas = false;
    let capturedVideoTrack = null;
    let originalAudioTrack = null;
    
    try {
      const captured = video.captureStream ? video.captureStream() : (video.mozCaptureStream ? video.mozCaptureStream() : null);
      if (captured && captured.getVideoTracks().length > 0) {
        capturedVideoTrack = captured.getVideoTracks()[0];
        if (captured.getAudioTracks().length > 0) {
          originalAudioTrack = captured.getAudioTracks()[0];
        }
      } else {
        fallbackToCanvas = true;
      }
    } catch (e) {
      console.warn("captureStream failed, falling back to canvas", e);
      fallbackToCanvas = true;
    }

    if (fallbackToCanvas) {
      console.log("Using Canvas + Web Audio fallback");
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');

      const loop = () => {
        if (!video.paused && !video.ended) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
        animationFrameId.current = requestAnimationFrame(loop);
      };
      animationFrameId.current = requestAnimationFrame(loop);
      
      const canvasStream = canvas.captureStream(30);
      if (canvasStream.getVideoTracks().length > 0) {
        finalStream.addTrack(canvasStream.getVideoTracks()[0]);
      }
    } else if (capturedVideoTrack) {
      finalStream.addTrack(capturedVideoTrack);
    }

    // ALWAYS use Web Audio Routing for reliable audio extraction (bypasses captureStream bugs)
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      
      if (!mediaElementSourceRef.current) {
        mediaElementSourceRef.current = audioCtx.createMediaElementSource(video);
      }
      
      mediaElementSourceRef.current.disconnect();
      
      const destination = audioCtx.createMediaStreamDestination();
      mediaStreamDestinationRef.current = destination;
      
      mediaElementSourceRef.current.connect(destination);
      mediaElementSourceRef.current.connect(audioCtx.destination);
      
      if (destination.stream.getAudioTracks().length > 0) {
        finalStream.addTrack(destination.stream.getAudioTracks()[0]);
      }
    } catch (e) {
      console.error("Web Audio fallback failed, attempting to use native audio track:", e);
      if (originalAudioTrack) {
        finalStream.addTrack(originalAudioTrack);
      }
    }
    
    if (!finalStream) {
      console.error('Failed to capture stream.');
      return;
    }

    streamRef.current = finalStream;

    const call = peerInstance.current.call(connectionRef.current.peer, finalStream);
    mediaCallRef.current = call;
    startStatsMonitoring(call, true);
  };

  // --- Synchronization Engine (Streamer Source of Truth) ---
  const sendSyncState = () => {
    if (!isStreamer || !videoRef.current || !connectionRef.current || !connectionRef.current.open) return;
    const video = videoRef.current;
    
    const now = Date.now();
    // Throttle to 250ms to avoid flooding
    if (now - lastSyncTime.current < 250) return;
    lastSyncTime.current = now;

    connectionRef.current.send({
      type: 'SYNC_STATE',
      currentTime: video.currentTime,
      duration: video.duration || 0,
      isPaused: video.paused
    });
    
    // Also update local UI state immediately
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);
    setIsPaused(video.paused);
  };

  const handleTimeUpdate = () => {
    if (isStreamer) {
      sendSyncState();
    }
  };

  const handlePlayPauseEvent = () => {
    if (isStreamer) {
      // Force sync bypass throttle
      const video = videoRef.current;
      if (!video || !connectionRef.current || !connectionRef.current.open) return;
      
      connectionRef.current.send({
        type: 'SYNC_STATE',
        currentTime: video.currentTime,
        duration: video.duration || 0,
        isPaused: video.paused
      });
      setCurrentTime(video.currentTime);
      setDuration(video.duration || 0);
      setIsPaused(video.paused);
      lastSyncTime.current = Date.now();
    }
  };

  const handleWaiting = () => {
    if (isStreamer) {
      sendSyncState();
    }
  };

  // --- Custom Control Handlers ---
  const togglePlayPause = () => {
    if (isStreamer) {
      const video = videoRef.current;
      if (video) {
        if (video.paused) video.play().catch(console.error);
        else video.pause();
      }
    } else {
      // Receiver sends command
      if (connectionRef.current && connectionRef.current.open) {
        connectionRef.current.send({ type: 'COMMAND', action: isPaused ? 'play' : 'pause' });
      }
      // Optimistically update local UI
      setIsPaused(!isPaused);
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime); // Update locally while scrubbing

    if (isStreamer) {
      if (videoRef.current) videoRef.current.currentTime = newTime;
      sendSyncState();
    } else {
      // Suspend incoming sync updates for 500ms to prevent jitter
      ignoreSyncUntil.current = Date.now() + 500;
      // Receiver sends command
      if (connectionRef.current && connectionRef.current.open) {
        connectionRef.current.send({ type: 'COMMAND', action: 'seek', value: newTime });
      }
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

  return (
    <div className="flex flex-col items-center p-8 max-w-5xl mx-auto w-full">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">WebRTC Watch Party</h1>
      
      {/* Connection UI Header (Minimal) */}
      <div className="w-full bg-white p-4 rounded-lg mb-6 shadow-sm border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div>
            <div className="text-xs text-gray-500 mb-1">Your ID</div>
            <div className="flex items-center">
              <span className="font-mono bg-gray-100 px-2 py-1 rounded text-sm select-all">{peerId || '...'}</span>
              <button onClick={copyToClipboard} className="ml-2 text-blue-600 hover:text-blue-800 text-sm font-medium">Copy</button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {!connectionStatus.startsWith('Connected') && (
            <>
              <input 
                type="text" 
                value={remotePeerId}
                onChange={(e) => setRemotePeerId(e.target.value)}
                placeholder="Partner's ID" 
                className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
              />
              <button 
                onClick={connectToPeer}
                disabled={!remotePeerId.trim()}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50"
              >
                Connect
              </button>
            </>
          )}
          <div className="flex items-center gap-2">
            {connectionStatus.startsWith('Connected') && (
              <div title={`Network Quality: ${networkQuality}`} className={`flex items-center justify-center w-5 h-5 rounded-full ${networkQuality === 'Poor' ? 'bg-red-100' : 'bg-green-100'}`}>
                <svg viewBox="0 0 24 24" fill="currentColor" className={`w-3 h-3 ${networkQuality === 'Poor' ? 'text-red-500' : 'text-green-500'}`}>
                  <path d="M12 21a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm-4.2-4.2a1 1 0 011.4-1.4 4 4 0 015.6 0 1 1 0 01-1.4 1.4 2 2 0 00-2.8 0zm-3-3a1 1 0 011.4-1.4 8 8 0 0111.3 0 1 1 0 01-1.4 1.4 6 6 0 00-8.5 0zm-3-3a1 1 0 011.4-1.4 12 12 0 0117 0 1 1 0 01-1.4 1.4 10 10 0 00-14.2 0z"/>
                </svg>
              </div>
            )}
            <div className={`w-2.5 h-2.5 rounded-full ${
              connectionStatus.startsWith('Connected') ? 'bg-green-500' : 
              connectionStatus === 'Connecting...' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium text-gray-700">{connectionStatus}</span>
          </div>
        </div>
      </div>

      {/* Unified Player Area */}
      <div className="w-full bg-black rounded-xl overflow-hidden shadow-2xl relative border border-gray-800">
        <div className="aspect-video relative bg-black flex items-center justify-center">
          <video 
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            onLoadedMetadata={handleVideoLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlayPauseEvent}
            onPause={handlePlayPauseEvent}
            onWaiting={handleWaiting}
          />
          {!isStreamer && !videoRef.current?.srcObject && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 font-medium">
              Waiting for stream...
            </div>
          )}
        </div>

        {/* Custom Control Bar */}
        <div className="bg-gray-900 text-white p-3 flex flex-col gap-2 relative z-10 border-t border-gray-800">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-mono w-10 text-right">{formatTime(currentTime)}</span>
            <input 
              type="range" 
              min="0" 
              max={duration || 100} // Fallback to 100 if duration is 0
              value={currentTime || 0}
              onMouseDown={() => setIsScrubbing(true)}
              onTouchStart={() => setIsScrubbing(true)}
              onMouseUp={() => setIsScrubbing(false)}
              onTouchEnd={() => setIsScrubbing(false)}
              onChange={handleSeek}
              className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
            />
            <span className="text-xs text-gray-400 font-mono w-10">{formatTime(duration)}</span>
          </div>
          <div className="flex items-center justify-between mt-1 px-1">
            <div className="flex items-center gap-4">
              <button 
                onClick={togglePlayPause}
                className="text-white hover:text-blue-400 transition-colors flex items-center justify-center w-8 h-8"
              >
                {isPaused ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M8 5v14l11-7z"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                )}
              </button>
              
              <div className="text-xs text-gray-400 font-medium bg-gray-800 px-2 py-1 rounded">
                Role: {isStreamer ? <span className="text-green-400">Streamer</span> : <span className="text-blue-400">Viewer</span>}
              </div>
            </div>

            <div className="flex items-center">
              <label className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm font-medium cursor-pointer transition-colors shadow-sm">
                Upload Video
                <input 
                  type="file" 
                  accept="video/mp4,video/webm" 
                  onChange={handleFileChange} 
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

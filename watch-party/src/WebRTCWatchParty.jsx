import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import Draggable from 'react-draggable';
import {
  Maximize, Minimize, Mic, MicOff, Video as VideoIcon, VideoOff,
  FolderOpen, Copy, PhoneCall, PhoneOff, CheckCircle2, Play, Pause,
  User, Sun, Moon, Globe
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function WebRTCWatchParty() {
  const navigate = useNavigate();
  const [peerId, setPeerId] = useState('');
  const [remotePeerId, setRemotePeerId] = useState('');
  const [connection, setConnection] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  
  // UI & Player State
  const [fileName, setFileName] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [showProfile, setShowProfile] = useState(false);
  const [userInfo] = useState({ name: 'Guest User', username: '@guest' });
  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });
  const [user1Media, setUser1Media] = useState({ mic: true, cam: true });
  const [user2Media, setUser2Media] = useState({ mic: false, cam: false });
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);
  const profileDropdownRef = useRef(null);

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

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
  
  const videoUrlRef = useRef('');
  const videoRef = useRef(null);
  const lastSyncTime = useRef(0);

  useEffect(() => {
    connectionRef.current = connection;
  }, [connection]);

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

      const customId = Math.random().toString(36).substring(2, 8).toLowerCase();
      const peer = new Peer(customId, peerOptions);
      peerInstance.current = peer;

      peer.on('open', (id) => {
        if (isMounted) setPeerId(id);
      });

      peer.on('connection', (conn) => {
        if (!isMounted) return;
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
        call.answer();

        call.on('stream', (remoteStream) => {
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
    if (!isStreamer) return;
    const video = videoRef.current;
    if (!video) return;

    cleanupMediaAndCalls();

    if (!peerInstance.current || !connectionRef.current) return;

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
      if (originalAudioTrack) {
        finalStream.addTrack(originalAudioTrack);
      }
    }
    
    if (!finalStream) return;

    streamRef.current = finalStream;

    const call = peerInstance.current.call(connectionRef.current.peer, finalStream);
    mediaCallRef.current = call;
    
    // Elevate bitrate & quality parameters on the WebRTC connection
    if (call.peerConnection) {
      applyHighQualitySenderSettings(call.peerConnection);
      call.peerConnection.addEventListener('connectionstatechange', () => {
        if (call.peerConnection.connectionState === 'connected') {
          applyHighQualitySenderSettings(call.peerConnection);
        }
      });
    }

    startStatsMonitoring(call, true);
  };

  const sendSyncState = () => {
    if (!isStreamer || !videoRef.current) return;
    
    const video = videoRef.current;
    setCurrentTime(video.currentTime);
    setDuration(video.duration || 0);
    setIsPaused(video.paused);

    if (!connectionRef.current || !connectionRef.current.open) return;

    const now = Date.now();
    if (now - lastSyncTime.current < 250) return;
    lastSyncTime.current = now;

    connectionRef.current.send({
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

      if (!connectionRef.current || !connectionRef.current.open) return;
      
      connectionRef.current.send({
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
      if (connectionRef.current && connectionRef.current.open) {
        connectionRef.current.send({ type: 'COMMAND', action: isPaused ? 'play' : 'pause' });
      }
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

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
          <div className="action-area" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'nowrap' }}>
            <button className="btn-join" onClick={() => navigate('/party')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path>
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon>
              </svg>
              JOIN A PARTY
            </button>
            <button className="btn-join" onClick={() => navigate('/local-video')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
              SYNC LOCAL VIDEO
            </button>
            <button className="btn-join" onClick={() => navigate('/screen-share')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', width: '16px', height: '16px' }}>
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              SHARE SCREEN
            </button>
            <button className="btn-join active" onClick={() => navigate('/webrtc')}>
              <Globe style={{ marginRight: '6px', width: '16px', height: '16px' }} />
              WEBRTC PAGE
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

        <div className="room-id-panel" style={{ flex: 1, margin: 0, height: '52px' }}>
          <span className="room-id-label" style={{ whiteSpace: 'nowrap' }}>
            {connectionStatus.startsWith('Connected') ? "Active Room ID:" : "Your Room ID:"}
          </span>
          <code className="room-id-code">{peerId || "Generating..."}</code>
          <button onClick={copyToClipboard} className="copy-id-btn" title="Copy Room ID">
            <Copy size={16} />
          </button>
        </div>

        <div className="friend-connect-panel" style={{ flex: 1, margin: 0, height: '52px', position: 'relative' }}>
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

          {connectionStatus.startsWith('Connected') ? (
            <div className="connected-panel-wrap">
              <div className="connected-badge" style={{ whiteSpace: 'nowrap' }}>
                <CheckCircle2 size={18} className="text-green-600" />
                <span>Connected to <strong>{connectionRef.current?.peer || "Partner"}</strong></span>
              </div>
              <button onClick={() => { if (connection) connection.close(); }} className="leave-btn" title="Leave Call">
                <PhoneOff size={16} />
                Leave Call
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Partner's ID"
                value={remotePeerId}
                onChange={(e) => setRemotePeerId(e.target.value)}
                className="friend-id-input"
                style={{ textTransform: "uppercase", height: '36px' }}
              />
              <button onClick={connectToPeer} disabled={!remotePeerId.trim()} className="connect-btn" style={{ whiteSpace: 'nowrap', height: '36px' }}>
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
            style={{ width: "100%", height: "100%", backgroundColor: isDarkMode ? '#1a1a1a' : '#000', position: "relative" }}
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
              style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "pointer", display: videoUrlRef.current || (connectionStatus.startsWith('Connected') && !isStreamer) ? "block" : "none" }}
            />
            {(!videoUrlRef.current && (!connectionStatus.startsWith('Connected') || (connectionStatus.startsWith('Connected') && isStreamer && !videoUrlRef.current))) && (
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
              style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', padding: '1rem', boxSizing: 'border-box', position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50, pointerEvents: 'auto' }}
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
                  <button onClick={toggleFullscreen} className="text-gray-300 hover:text-white transition-colors" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
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
                <div style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden', backgroundColor: '#333' }} />
                {!user1Media.cam && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Camera Off</span>
                  </div>
                )}
                <div className="participant-tag-wrap" style={{ zIndex: 30 }}>
                  <span className="participant-tag">You</span>
                  <div className="local-volume-meter">
                    <div className="local-volume-fill" style={{ height: user1Media.mic ? '50%' : '0%' }} />
                  </div>
                </div>
              </div>
              <div className="media-controls">
                <button
                  onClick={() => setUser1Media({ ...user1Media, mic: !user1Media.mic })}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`media-toggle-btn ${user1Media.mic ? "is-on" : "is-off"}`}
                  title={user1Media.mic ? "Mute Microphone" : "Unmute Microphone"}
                >
                  {user1Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  onClick={() => setUser1Media({ ...user1Media, cam: !user1Media.cam })}
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
                <div style={{ width: '100%', height: '100%', display: 'flex', overflow: 'hidden', backgroundColor: '#222' }} />

                {!connectionStatus.startsWith('Connected') && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Waiting for partner...</span>
                  </div>
                )}
                {connectionStatus.startsWith('Connected') && !user2Media.cam && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Partner's camera is off</span>
                  </div>
                )}
                <div className="participant-tag-wrap participant-tag-wrap--friend">
                  <span className="participant-tag">Partner</span>
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
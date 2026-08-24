import { useRef, useState } from "react";
import Draggable from "react-draggable";
import {
  Maximize,
  Minimize,
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  FolderOpen,
  Copy,
  PhoneCall,
  PhoneOff,
  CheckCircle2,
  FileCheck,
  Play,
  Pause
} from "lucide-react";
import useLocalVideoParty from "./hooks/useLocalVideoParty";
import useWatchPartyCall from "./hooks/useWatchPartyCall";

export default function LocalVideoPartyRoom() {
  const dataConnRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const volumeBarRef = useRef(null);

  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });

  // Notice the updated destructured variables here to power the custom controls
  const {
    videoSrc,
    fileName,
    peerFileName,
    isFullscreen,
    isPlaying,
    currentTime,
    duration,
    handleFileSelect,
    handleReceiveData,
    togglePlayPause,
    handleSeek,
    toggleFullscreen,
  } = useLocalVideoParty({
    videoRef: videoPlayerRef,
    dataConnRef,
    containerRef,
  });

  const {
    remoteStream,
    peerId,
    friendId,
    setFriendId,
    user1Media,
    user2Media,
    toggleLocalMic,
    toggleLocalCam,
    callFriend,
    acceptCall,
    rejectCall,
    leaveCall,
    incomingCall,
    callStatus,
    isConnected,
    activeRoomId,
  } = useWatchPartyCall({
    dataConnRef,
    onReceiveData: handleReceiveData,
    videoId: null,
    localVideoRef,
    remoteVideoRef,
    volumeBarRef,
  });

  const displayedRoomId = isConnected ? activeRoomId : peerId;

  // Helper to format seconds into M:SS
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const m = Math.floor(timeInSeconds / 60);
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="watch-party-room">
      {/* File Selection Header */}
      <div className="watch-party-form" style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
        <label
          className="load-video-btn"
          style={{
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.6rem 1.2rem",
          }}
        >
          <FolderOpen size={18} />
          Choose Video File
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: "none" }}
          />
        </label>
        
        <div style={{ display: "flex", flexDirection: "column", fontSize: "0.85rem", color: "#666" }}>
          <span><strong>Your File:</strong> {fileName || "None selected"}</span>
          {peerFileName && (
            <span style={{ color: "#16a34a", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <FileCheck size={14} /> Friend loaded: {peerFileName}
            </span>
          )}
        </div>
      </div>

      {/* Connection Panel */}
      <div className="connection-row">
        <div className="room-id-panel">
          <span className="room-id-label">{isConnected ? "Active Room ID:" : "Your Room ID:"}</span>
          <code className="room-id-code">{displayedRoomId || "Generating..."}</code>
          <button
            onClick={() => navigator.clipboard.writeText(displayedRoomId)}
            className="copy-id-btn"
            title="Copy Room ID"
          >
            <Copy size={16} />
          </button>
        </div>

        <div className="friend-connect-panel">
          {isConnected ? (
            <div className="connected-panel-wrap">
              <div className="connected-badge">
                <CheckCircle2 size={18} className="text-green-600" />
                <span>Connected in Room <strong>{activeRoomId}</strong></span>
              </div>
              <button onClick={leaveCall} className="leave-btn" title="Leave Call">
                <PhoneOff size={16} /> Leave Call
              </button>
            </div>
          ) : (
            <>
              <input
                type="text"
                placeholder="Paste Friend's ID here..."
                value={friendId}
                onChange={(e) => setFriendId(e.target.value)}
                className="friend-id-input"
                style={{ textTransform: "uppercase" }}
              />
              <button onClick={callFriend} className="connect-btn">
                <PhoneCall size={16} /> Connect
              </button>
            </>
          )}
        </div>
      </div>

      {callStatus && <div className="call-status-alert">{callStatus}</div>}

      {incomingCall && (
        <div className="incoming-call-modal">
          <span>Incoming request from: <strong>{incomingCall.callerId}</strong></span>
          <div className="incoming-call-actions">
            <button onClick={acceptCall} className="accept-btn">Accept</button>
            <button onClick={rejectCall} className="reject-btn">Reject</button>
          </div>
        </div>
      )}

      {/* Main Player & Draggable Feeds */}
      <div
        ref={containerRef}
        className={isFullscreen ? "video-shell is-fullscreen" : "video-shell"}
      >
        <div className={isFullscreen ? "player-panel is-fullscreen" : "player-panel"}>
          <div
            className="local-video-host"
            style={{ width: "100%", height: "100%", backgroundColor: "#000", position: "relative" }}
          >
            {videoSrc ? (
              <video
                ref={videoPlayerRef}
                src={videoSrc}
                playsInline
                onClick={togglePlayPause}
                style={{ width: "100%", height: "100%", objectFit: "contain", cursor: "pointer" }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  color: "#9ca3af",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <FolderOpen size={48} />
                <p>Please select a local video file above to start watching.</p>
              </div>
            )}
          </div>

          {/* CUSTOM SHARED CONTROLS OVERLAY */}
          <div 
            className="player-controls-overlay" 
            style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              alignItems: "center",
              gap: "1.5rem",
              background: "linear-gradient(to top, rgba(0,0,0,0.9), transparent)"
            }}
          >
            <div className="controls-click-target" style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1 }}>
              
              <button 
                onClick={togglePlayPause} 
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "white", display: "flex" }}
                disabled={!videoSrc}
              >
                {isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" />}
              </button>

              <span style={{ color: "white", fontSize: "0.875rem", fontFamily: "monospace", minWidth: "80px" }}>
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <input 
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                disabled={!videoSrc}
                style={{ flex: 1, cursor: "pointer", height: "4px", accentColor: "#2563eb" }}
              />
            </div>

            <div className="controls-click-target">
              <button onClick={toggleFullscreen} className="fullscreen-toggle" style={{ background: "transparent", border: "none", display: "flex" }}>
                {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Floating / Column Cameras */}
        <div className={isFullscreen ? "camera-column is-fullscreen" : "camera-column"}>
          {/* User 1: Local Stream */}
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
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`video-feed video-feed--local ${user1Media.cam ? "is-visible" : "is-hidden"}`}
                />
                {!user1Media.cam && <VideoOff className="video-off-icon" />}
                <div className="participant-tag-wrap">
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

          {/* User 2: Friend Stream */}
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
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`video-feed video-feed--remote ${
                    remoteStream && user2Media.cam ? "is-visible" : "is-hidden"
                  }`}
                />
                {!remoteStream && (
                  <div className="waiting-overlay">
                    <VideoOff className="waiting-icon" />
                    <span className="waiting-text">Waiting for friend...</span>
                  </div>
                )}
                {remoteStream && !user2Media.cam && (
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
                  title={user2Media.mic ? "Friend's Mic is On" : "Friend is Muted"}
                >
                  {user2Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </div>
                <div
                  className={`media-indicator-badge ${user2Media.cam ? "is-on" : "is-off"}`}
                  title={user2Media.cam ? "Friend's Camera is On" : "Friend's Camera is Off"}
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
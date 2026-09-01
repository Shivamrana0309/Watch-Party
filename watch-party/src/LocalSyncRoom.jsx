import { useRef, useState, useEffect } from "react";
import {
  Maximize,
  Minimize,
  FolderOpen,
  Play,
  Pause,
} from "lucide-react";
import useLocalVideoParty from "./hooks/useLocalVideoParty";
import { useCallContext } from "./context/CallContext";
import { useNavigate } from "react-router-dom";
import RoomHeader from "./components/RoomHeader";
import IncomingCallModal from "./components/IncomingCallModal";
import DraggableVideoFeeds from "./components/DraggableVideoFeeds";

export default function LocalSyncRoom() {
  const navigate = useNavigate();
  const videoPlayerRef = useRef(null);
  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const volumeBarRef = useRef(null);

  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });

  const {
    localStream,
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
    dataConnRef,
    subscribeToData,
    localVideoDOM,
    remoteVideoDOM,
  } = useCallContext();

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

  // Stream playback logic - Append persistent DOM nodes
  useEffect(() => {
    if (localVideoRef.current && localVideoDOM) {
      localVideoRef.current.appendChild(localVideoDOM);
      localVideoDOM.className = `video-feed video-feed--local ${user1Media.cam ? "is-visible" : "is-hidden"}`;
      localVideoDOM.play().catch(() => {});
    }
  }, [localVideoDOM, user1Media.cam]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteVideoDOM) {
      remoteVideoRef.current.appendChild(remoteVideoDOM);
      remoteVideoDOM.className = `video-feed video-feed--remote ${user2Media.cam ? "is-visible" : "is-hidden"}`;
      remoteVideoDOM.play().catch(() => {});
    }
  }, [remoteVideoDOM, user2Media.cam]);

  // Subscribe to generic data for WatchPartyVideo sync
  useEffect(() => {
    const unsub = subscribeToData((data) => {
      handleReceiveData(data);
    });
    return unsub;
  }, [handleReceiveData, subscribeToData]);

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

  // Helper to format seconds into M:SS
  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const m = Math.floor(timeInSeconds / 60);
    const s = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="watch-party-room">
      <RoomHeader
        activeTab="local-sync"
        navigate={navigate}
        peerId={peerId}
        isConnected={isConnected}
        activeRoomId={activeRoomId}
        friendId={friendId}
        setFriendId={setFriendId}
        callFriend={callFriend}
        leaveCall={leaveCall}
        callStatus={callStatus}
        customActionWidget={
          <div style={{ display: 'flex', gap: '1rem', margin: 0, height: '52px', alignItems: 'center' }}>
            <label className="btn btn-join" style={{ 
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem", 
              fontSize: '0.85rem', padding: '0.65rem 1.25rem', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', margin: 0, height: '100%'
            }}>
              <FolderOpen size={16} />
              UPLOAD VIDEO
              <input type="file" accept="video/*" onChange={handleFileSelect} style={{ display: "none" }} />
            </label>

            <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: '100%', marginLeft: '0.5rem' }}>
              <div style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", color: "#475569", whiteSpace: "nowrap", flex: 1 }}>
                <strong>Your File:</strong> &nbsp;{fileName || "None"}
              </div>
              <div style={{ display: "flex", alignItems: "center", fontSize: "0.85rem", color: "#16a34a", whiteSpace: "nowrap", flex: 1 }}>
                <strong>Friend's File:</strong> &nbsp;{peerFileName || "None"}
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

      {/* Main Player & Draggable Feeds */}
      <div
        ref={containerRef}
        className={isFullscreen ? "video-shell is-fullscreen" : "video-shell"}
      >
        <div className={isFullscreen ? "player-panel is-fullscreen" : "player-panel"}>
          <div
            className="local-video-host"
            style={{ width: "100%", height: "100%", backgroundColor: '#000', position: "relative" }}
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
        <DraggableVideoFeeds
          isFullscreen={isFullscreen}
          user1Ref={user1Ref}
          user2Ref={user2Ref}
          cam1Pos={cam1Pos}
          setCam1Pos={setCam1Pos}
          cam2Pos={cam2Pos}
          setCam2Pos={setCam2Pos}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          volumeBarRef={volumeBarRef}
          user1Media={user1Media}
          user2Media={user2Media}
          toggleLocalMic={toggleLocalMic}
          toggleLocalCam={toggleLocalCam}
          remoteStream={remoteStream}
          isConnected={isConnected}
        />
      </div>
    </div>
  );
}
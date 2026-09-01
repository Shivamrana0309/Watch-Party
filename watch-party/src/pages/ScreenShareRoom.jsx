import { useRef, useState, useEffect } from "react";
import {
  Maximize,
  Minimize,
  MonitorUp,
  MonitorOff,
} from "lucide-react";
import { useCallContext } from "../context/CallContext";
import { useNavigate } from "react-router-dom";
import RoomHeader from "../components/RoomHeader";
import IncomingCallModal from "../components/IncomingCallModal";
import DraggableVideoFeeds from "../components/DraggableVideoFeeds";

export default function ScreenShareRoom() {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const mainScreenRef = useRef(null);
  const volumeBarRef = useRef(null);

  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const {
    localStream,
    remoteStream,
    localScreenStream,
    remoteScreenStream,
    peerId,
    friendId,
    setFriendId,
    user1Media,
    user2Media,
    toggleLocalMic,
    toggleLocalCam,
    toggleScreenShare,
    callFriend,
    acceptCall,
    rejectCall,
    leaveCall,
    incomingCall,
    callStatus,
    isConnected,
    activeRoomId,
    localVideoDOM,
    remoteVideoDOM,
  } = useCallContext();

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

  const isSharingScreen = !!localScreenStream;
  const activeScreenStream = remoteScreenStream || localScreenStream;

  // Mount the active screen stream to the large video player
  useEffect(() => {
    if (mainScreenRef.current) {
      mainScreenRef.current.srcObject = activeScreenStream;
    }
  }, [activeScreenStream]);

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
      <RoomHeader
        activeTab="screen-share"
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
            <button className={`btn-join ${isSharingScreen ? 'active' : ''}`} onClick={toggleScreenShare} style={{ 
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.5rem", 
              fontSize: '0.85rem', padding: '0.65rem 1.25rem', margin: 0, height: '100%',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)'
            }}>
              {isSharingScreen ? <MonitorOff size={16} /> : <MonitorUp size={16} />}
              {isSharingScreen ? 'STOP PRESENTING' : 'START PRESENTING'}
            </button>
          </div>
        }
      />

      <IncomingCallModal
        incomingCall={incomingCall}
        acceptCall={acceptCall}
        rejectCall={rejectCall}
      />

      <div ref={containerRef} className={isFullscreen ? "video-shell is-fullscreen" : "video-shell"}>
        <div className={isFullscreen ? "player-panel is-fullscreen" : "player-panel"}>
          <div className="screen-share-host" style={{ width: "100%", height: "100%", backgroundColor: '#000', position: "relative" }}>
            <video
              ref={mainScreenRef}
              autoPlay
              playsInline
              muted={isSharingScreen}
              className={`shared-screen-feed ${activeScreenStream ? "is-visible" : "is-hidden"}`}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
            {!activeScreenStream && (
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, color: "white", display: "flex", justifyContent: "center", alignItems: "center" }}>
                No screen is currently being shared.
              </div>
            )}
          </div>
          <div className="player-controls-overlay">
            <div className="controls-click-target">
              <button onClick={toggleFullscreen} className="fullscreen-toggle">
                {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
              </button>
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
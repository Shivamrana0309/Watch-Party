import { useRef, useState, useEffect } from "react";
import YouTube from "react-youtube";
import {
  Maximize,
  Minimize,
  Link,
} from "lucide-react";
import useWatchPartyVideo from "../hooks/useWatchPartyVideo";
import { useCallContext } from "../context/CallContext";
import { useNavigate } from "react-router-dom";
import RoomHeader from "../components/RoomHeader";
import IncomingCallModal from "../components/IncomingCallModal";
import { useVolumeMeter } from "../hooks/useVolumeMeter";
import { useAttachVideoDOM } from "../hooks/useAttachVideoDOM";
import DraggableVideoFeeds from "../components/DraggableVideoFeeds";

const EXTRA_DARK_CSS = `
  body.dark-mode .load-video-btn {
    background-color: #1f2937 !important;
    color: #e5e5e5 !important;
    border-color: #374151 !important;
  }
  body.dark-mode .url-input {
    background-color: #1f2937 !important;
    color: #e5e5e5 !important;
    border-color: #374151 !important;
  }
`;

export default function YouTubeRoom() {
  const navigate = useNavigate();
  const playerRef = useRef(null);
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

  const {
    videoId,
    inputUrl,
    setInputUrl,
    isFullscreen,
    handleReceiveData,
    handleUrlSubmit,
    handlePlay,
    handlePause,
    toggleFullscreen,
  } = useWatchPartyVideo({
    playerRef,
    dataConnRef,
    containerRef,
  });

  // Stream playback logic - Append persistent DOM nodes
  useAttachVideoDOM(
    localVideoRef,
    localVideoDOM,
    `video-feed video-feed--local ${user1Media.cam ? "is-visible" : "is-hidden"}`
  );

  useAttachVideoDOM(
    remoteVideoRef,
    remoteVideoDOM,
    `video-feed video-feed--remote ${user2Media.cam ? "is-visible" : "is-hidden"}`
  );

  // Subscribe to generic data for WatchPartyVideo sync
  useEffect(() => {
    const unsub = subscribeToData((data) => {
      handleReceiveData(data);
    });
    return unsub;
  }, [handleReceiveData, subscribeToData]);

  // Volume Bar Logic
  useVolumeMeter(localStream, user1Media.mic, volumeBarRef);

  return (
    <div className="watch-party-room">
      <RoomHeader
        activeTab="party"
        navigate={navigate}
        peerId={peerId}
        isConnected={isConnected}
        activeRoomId={activeRoomId}
        friendId={friendId}
        setFriendId={setFriendId}
        callFriend={callFriend}
        leaveCall={leaveCall}
        callStatus={callStatus}
        extraDarkModeCSS={EXTRA_DARK_CSS}
        customActionWidget={
          <form onSubmit={handleUrlSubmit} className="watch-party-form" style={{ margin: 0, padding: 0 }}>
            <div className="url-input-wrap">
              <div className="url-input-icon">
                <Link size={20} className="url-input-icon-svg" />
              </div>
              <input
                type="text"
                placeholder="Paste YouTube URL here..."
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="url-input"
                style={{ height: '52px' }}
              />
            </div>
            <button type="submit" className="load-video-btn" style={{ height: '52px' }}>
              Load Video
            </button>
          </form>
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
          <div className="youtube-host">
            <YouTube
              videoId={videoId}
              ref={playerRef}
              opts={{
                width: "100%",
                height: "100%",
                playerVars: { autoplay: 0, modestbranding: 1, rel: 0, fs: 0 },
              }}
              onPlay={handlePlay}
              onPause={handlePause}
              className="youtube-iframe"
              iframeClassName="youtube-iframe"
            />
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
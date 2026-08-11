import { useRef, useState } from "react";
import Draggable from "react-draggable";
import YouTube from "react-youtube";
import {
  Maximize,
  Minimize,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Link,
  Copy,
  PhoneCall,
} from "lucide-react";
import useWatchPartyVideo from "./hooks/useWatchPartyVideo";
import useWatchPartyCall from "./hooks/useWatchPartyCall";

export default function WatchPartyRoomRefactored() {
  const dataConnRef = useRef(null);
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

  const {
    remoteStream,
    peerId,
    friendId,
    setFriendId,
    user1Media,
    user2Media,
    setUser2Media,
    toggleLocalMic,
    toggleLocalCam,
    callFriend,
  } = useWatchPartyCall({
    dataConnRef,
    onReceiveData: handleReceiveData,
    videoId,
    localVideoRef,
    remoteVideoRef,
    volumeBarRef,
  });

  return (
    <div className="w-full flex flex-col items-center gap-6 pb-10">
      <form
        onSubmit={handleUrlSubmit}
        className="w-full max-w-[1600px] px-4 md:px-8 flex items-center gap-3"
      >
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Link size={20} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Paste YouTube URL here..."
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-semibold px-6 py-3 rounded-xl shadow-sm transition-all whitespace-nowrap"
        >
          Load Video
        </button>
      </form>

      <div className="w-full max-w-[1600px] px-4 md:px-8 flex flex-col md:flex-row items-center gap-4">
        <div className="flex items-center gap-2 flex-1 w-full bg-blue-50 p-3 rounded-xl border border-blue-100 shadow-sm">
          <span className="text-sm font-semibold text-blue-800">
            Your Room ID:
          </span>
          <code className="bg-white px-3 py-1.5 rounded text-sm font-mono text-blue-900 flex-1 border border-blue-200 overflow-hidden text-ellipsis">
            {peerId || "Generating..."}
          </code>
          <button
            onClick={() => navigator.clipboard.writeText(peerId)}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition shadow-sm"
            title="Copy ID"
          >
            <Copy size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-1 w-full bg-green-50 p-3 rounded-xl border border-green-100 shadow-sm">
          <input
            type="text"
            placeholder="Paste Friend's ID here..."
            value={friendId}
            onChange={(e) => setFriendId(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-green-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={callFriend}
            className="bg-green-600 hover:bg-green-700 active:scale-95 text-white font-semibold px-4 py-1.5 rounded-lg transition shadow-sm flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <PhoneCall size={16} />
            Connect
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className={
          isFullscreen
            ? "w-screen h-screen bg-black overflow-hidden relative"
            : "flex flex-col xl:flex-row gap-6 w-full max-w-[1600px] px-4 md:px-8"
        }
      >
        <div
          className={
            isFullscreen
              ? "absolute inset-0 w-full h-full z-0"
              : "relative flex-1 aspect-video bg-black rounded-xl shadow-2xl overflow-hidden"
          }
        >
          <div className="absolute inset-0 w-full h-full pointer-events-auto">
            <YouTube
              videoId={videoId}
              ref={playerRef}
              opts={{
                width: "100%",
                height: "100%",
                playerVars: {
                  autoplay: 0,
                  modestbranding: 1,
                  rel: 0,
                  fs: 0,
                },
              }}
              onPlay={handlePlay}
              onPause={handlePause}
              className="w-full h-full"
              iframeClassName="w-full h-full"
            />
          </div>
          <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 via-black/20 to-transparent px-6 pb-4 pt-16 transition-opacity duration-300 z-40 pointer-events-none flex justify-end">
            <div className="pointer-events-auto">
              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-gray-300 transition shadow-lg"
              >
                {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
              </button>
            </div>
          </div>
        </div>

        <div
          className={
            isFullscreen
              ? "absolute inset-0 pointer-events-none z-50"
              : "w-full xl:w-80 flex flex-col gap-6 shrink-0"
          }
        >
          <Draggable
            bounds="parent"
            nodeRef={user1Ref}
            disabled={!isFullscreen}
            position={isFullscreen ? cam1Pos : { x: 0, y: 0 }}
            onDrag={(e, data) => setCam1Pos({ x: data.x, y: data.y })}
          >
            <div
              ref={user1Ref}
              className={`aspect-video bg-gray-800 overflow-hidden relative group pointer-events-auto ${
                isFullscreen
                  ? "absolute top-6 left-[calc(100%-14rem)] w-48 rounded-lg border border-gray-600 shadow-2xl cursor-move"
                  : "w-full rounded-xl border border-gray-200 shadow-lg"
              }`}
            >
              <div className="flex-1 flex items-center justify-center bg-gray-900 w-full h-full">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${
                    user1Media.cam ? "block" : "hidden"
                  }`}
                />
                {!user1Media.cam && <VideoOff className="text-red-500 absolute" />}
                <div className="absolute bottom-3 left-3 flex items-end gap-1.5">
                  <span className="text-xs font-medium text-white bg-black/60 px-2 py-1 rounded shadow">
                    You
                  </span>
                  <div className="h-5 w-2 bg-black/60 rounded-sm overflow-hidden flex items-end pb-[1px] px-[1px]">
                    <div
                      ref={volumeBarRef}
                      className="w-full bg-green-500 rounded-sm"
                      style={{ height: "0%" }}
                    />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-3 right-3 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={toggleLocalMic}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`p-2 rounded-full shadow-lg ${
                    user1Media.mic
                      ? "bg-gray-700/80 text-white hover:bg-gray-600"
                      : "bg-red-500/90 text-white hover:bg-red-600"
                  }`}
                >
                  {user1Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  onClick={toggleLocalCam}
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`p-2 rounded-full shadow-lg ${
                    user1Media.cam
                      ? "bg-gray-700/80 text-white hover:bg-gray-600"
                      : "bg-red-500/90 text-white hover:bg-red-600"
                  }`}
                >
                  {user1Media.cam ? <Video size={18} /> : <VideoOff size={18} />}
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
              className={`aspect-video bg-gray-800 overflow-hidden relative group pointer-events-auto ${
                isFullscreen
                  ? "absolute top-40 left-[calc(100%-14rem)] w-48 rounded-lg border border-gray-600 shadow-2xl cursor-move"
                  : "w-full rounded-xl border border-gray-200 shadow-lg"
              }`}
            >
              <div className="flex-1 flex items-center justify-center bg-gray-900 w-full h-full relative">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {!remoteStream && (
                  <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center z-20">
                    <VideoOff className="text-red-500 mb-2" />
                    <span className="text-gray-400 text-sm">
                      Waiting for friend...
                    </span>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 flex items-end gap-1.5 z-30 pointer-events-none">
                  <span className="text-xs font-medium text-white bg-black/60 px-2 py-1 rounded shadow">
                    Friend
                  </span>
                </div>
              </div>

              <div className="absolute bottom-3 right-3 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <button
                  onClick={() =>
                    setUser2Media({ ...user2Media, mic: !user2Media.mic })
                  }
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`p-2 rounded-full shadow-lg ${
                    user2Media.mic
                      ? "bg-gray-700/80 text-white hover:bg-gray-600"
                      : "bg-red-500/90 text-white hover:bg-red-600"
                  }`}
                >
                  {user2Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button
                  onClick={() =>
                    setUser2Media({ ...user2Media, cam: !user2Media.cam })
                  }
                  onMouseDown={(e) => e.stopPropagation()}
                  className={`p-2 rounded-full shadow-lg ${
                    user2Media.cam
                      ? "bg-gray-700/80 text-white hover:bg-gray-600"
                      : "bg-red-500/90 text-white hover:bg-red-600"
                  }`}
                >
                  {user2Media.cam ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              </div>
            </div>
          </Draggable>
        </div>
      </div>
    </div>
  );
}
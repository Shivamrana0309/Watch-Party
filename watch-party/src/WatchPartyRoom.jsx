import React, { useState, useRef, useEffect } from "react";
import Draggable from "react-draggable";
import {
  Maximize, Minimize, Mic, MicOff, Video, VideoOff, Link
} from "lucide-react";

export default function WatchPartyRoom() {
  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);
  const localVideoRef = useRef(null);
  const volumeBarRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [user1Media, setUser1Media] = useState({ mic: true, cam: true });
  const [user2Media, setUser2Media] = useState({ mic: true, cam: true });

  const [cam1Pos, setCam1Pos] = useState({ x: 0, y: 0 });
  const [cam2Pos, setCam2Pos] = useState({ x: 0, y: 0 });

  // NEW: State to hold just the 11-character YouTube ID
  const [videoId, setVideoId] = useState("LXb3EKWsInQ");
  const [inputUrl, setInputUrl] = useState("");

  // NEW: Helper function to extract the Video ID from any YouTube URL format
  const extractVideoId = (url) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault(); 
    const newUrl = inputUrl.trim();

    if (newUrl !== "") {
      const extractedId = extractVideoId(newUrl);
      if (extractedId) {
        setVideoId(extractedId); // Save the clean ID
        setInputUrl(""); // Clear the box
      } else {
        alert("Please enter a valid YouTube URL.");
      }
    }
  };

  useEffect(() => {
    if (!isFullscreen) {
      setCam1Pos({ x: 0, y: 0 });
      setCam2Pos({ x: 0, y: 0 });
    }
  }, [isFullscreen]);

  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Camera access denied or failed:", err);
      }
    };
    getMedia();
    return () => {
      if (localStream) localStream.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    let audioContext;
    let analyser;
    let source;
    let animationFrameId;

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
        const volumePercentage = Math.min((average * 1.5), 100);

        if (volumeBarRef.current) volumeBarRef.current.style.height = `${volumePercentage}%`;
        animationFrameId = requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } else {
      if (volumeBarRef.current) volumeBarRef.current.style.height = '0%';
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (audioContext && audioContext.state !== 'closed') audioContext.close();
    };
  }, [localStream, user1Media.mic]);

  const toggleLocalMic = () => {
    setUser1Media(prev => {
      const newState = !prev.mic;
      if (localStream) localStream.getAudioTracks().forEach(track => track.enabled = newState);
      return { ...prev, mic: newState };
    });
  };

  const toggleLocalCam = async () => {
    if (user1Media.cam) {
      if (localStream) {
        localStream.getVideoTracks().forEach(track => {
          track.stop(); 
          localStream.removeTrack(track);
        });
      }
      setUser1Media(prev => ({ ...prev, cam: false }));
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newVideoTrack = newStream.getVideoTracks()[0];
        
        if (localStream) {
          localStream.addTrack(newVideoTrack);
          if (localVideoRef.current) localVideoRef.current.srcObject = localStream;
        } else {
          setLocalStream(newStream);
          if (localVideoRef.current) localVideoRef.current.srcObject = newStream;
        }
        setUser1Media(prev => ({ ...prev, cam: true }));
      } catch (err) {
        console.error("Could not restart camera:", err);
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.error(err));
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
          {/* UPDATED: Removed ReactPlayer and replaced with a native iframe */}
          <div className="absolute inset-0 w-full h-full">
            <iframe
              key={videoId} // Forces iframe to rebuild on new video
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&fs=0&modestbranding=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen={false} // Kept false so users must use our custom fullscreen button
            ></iframe>
          </div>

          <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 via-black/20 to-transparent px-6 pb-4 pt-16 transition-opacity duration-300 z-40 pointer-events-none flex justify-end">
            <div className="pointer-events-auto">
              <button
                onClick={toggleFullscreen}
                className="text-white hover:text-gray-300 transition"
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
          {/* USER 1 (YOU) */}
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
                  className={`w-full h-full object-cover ${user1Media.cam ? "block" : "hidden"}`}
                />
                {!user1Media.cam && <VideoOff className="text-red-500 absolute" />}
                
                <div className="absolute bottom-3 left-3 flex items-end gap-1.5">
                  <span className="text-xs font-medium text-white bg-black/60 px-2 py-1 rounded shadow">You</span>
                  <div className="h-5 w-2 bg-black/60 rounded-sm overflow-hidden flex items-end pb-[1px] px-[1px]">
                    <div ref={volumeBarRef} className="w-full bg-green-500 rounded-sm" style={{ height: '0%' }} />
                  </div>
                </div>
              </div>
              
              <div className="absolute bottom-3 right-3 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={toggleLocalMic} onMouseDown={(e) => e.stopPropagation()} className={`p-2 rounded-full shadow-lg ${user1Media.mic ? 'bg-gray-700/80 text-white hover:bg-gray-600' : 'bg-red-500/90 text-white hover:bg-red-600'}`}>
                  {user1Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button onClick={toggleLocalCam} onMouseDown={(e) => e.stopPropagation()} className={`p-2 rounded-full shadow-lg ${user1Media.cam ? 'bg-gray-700/80 text-white hover:bg-gray-600' : 'bg-red-500/90 text-white hover:bg-red-600'}`}>
                  {user1Media.cam ? <Video size={18} /> : <VideoOff size={18} />}
                </button>
              </div>
            </div>
          </Draggable>

          {/* USER 2 (FRIEND) */}
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
              <div className="flex-1 flex items-center justify-center bg-gray-900 w-full h-full">
                {user2Media.cam ? <span className="text-gray-400 text-sm">Friend</span> : <VideoOff className="text-red-500 absolute" />}
                
                <div className="absolute bottom-3 left-3 flex items-end gap-1.5">
                  <span className="text-xs font-medium text-white bg-black/60 px-2 py-1 rounded shadow">Friend</span>
                </div>
              </div>
              
              <div className="absolute bottom-3 right-3 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => setUser2Media({...user2Media, mic: !user2Media.mic})} onMouseDown={(e) => e.stopPropagation()} className={`p-2 rounded-full shadow-lg ${user2Media.mic ? 'bg-gray-700/80 text-white hover:bg-gray-600' : 'bg-red-500/90 text-white hover:bg-red-600'}`}>
                  {user2Media.mic ? <Mic size={18} /> : <MicOff size={18} />}
                </button>
                <button onClick={() => setUser2Media({...user2Media, cam: !user2Media.cam})} onMouseDown={(e) => e.stopPropagation()} className={`p-2 rounded-full shadow-lg ${user2Media.cam ? 'bg-gray-700/80 text-white hover:bg-gray-600' : 'bg-red-500/90 text-white hover:bg-red-600'}`}>
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
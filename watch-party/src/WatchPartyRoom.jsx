import React, { useState, useRef, useEffect } from "react";
import Draggable from "react-draggable";
import Peer from "peerjs";
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

export default function WatchPartyRoom() {
  const containerRef = useRef(null);
  const user1Ref = useRef(null);
  const user2Ref = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const volumeBarRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const [user1Media, setUser1Media] = useState({
    mic: true,
    cam: true,
  });

  const [user2Media, setUser2Media] = useState({
    mic: true,
    cam: true,
  });

  const [cam1Pos, setCam1Pos] = useState({
    x: 0,
    y: 0,
  });

  const [cam2Pos, setCam2Pos] = useState({
    x: 0,
    y: 0,
  });

  const [videoId, setVideoId] = useState("LXb3EKWsInQ");
  const [inputUrl, setInputUrl] = useState("");

  const [peerId, setPeerId] = useState("");
  const [friendId, setFriendId] = useState("");

  const peerInstance = useRef(null);

  // ============================================================
  // YOUTUBE VIDEO
  // ============================================================

  const extractVideoId = (url) => {
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;

    const match = url.match(regExp);

    return match && match[2].length === 11 ? match[2] : null;
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();

    const newUrl = inputUrl.trim();

    if (newUrl !== "") {
      const extractedId = extractVideoId(newUrl);

      if (extractedId) {
        setVideoId(extractedId);
        setInputUrl("");
      } else {
        alert("Please enter a valid YouTube URL.");
      }
    }
  };

  // ============================================================
  // WEBRTC + PEERJS INITIALIZATION
  // ============================================================

  useEffect(() => {
    let myStream;
    let peer;
    
    // 1. ADDED isMounted FLAG FOR REACT STRICT MODE CLEANUP
    let isMounted = true; 

    const initMediaAndPeer = async () => {
      try {
        console.log("=================================");
        console.log("🎥 STARTING CAMERA INITIALIZATION");
        console.log("=================================");

        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        // 2. CHECK IF COMPONENT UNMOUNTED DURING ASYNC CAMERA LOAD
        if (!isMounted) {
          console.warn("⚠️ Component unmounted before camera finished loading. Aborting.");
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        myStream = stream;

        console.log("✅ Local camera/microphone obtained");
        console.log("Local stream:", myStream);

        const localVideoTracks = myStream.getVideoTracks();
        const localAudioTracks = myStream.getAudioTracks();

        console.log("Local video tracks:", localVideoTracks);
        console.log("Local audio tracks:", localAudioTracks);

        localVideoTracks.forEach((track) => {
          console.log("=================================");
          console.log("🎥 LOCAL VIDEO TRACK");
          console.log("Track ID:", track.id);
          console.log("Track kind:", track.kind);
          console.log("Track state:", track.readyState);
          console.log("Track enabled:", track.enabled);
          console.log("Track muted:", track.muted);
          console.log("Track settings:", track.getSettings());
          console.log("=================================");
        });

        setLocalStream(myStream);

        // Attach local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = myStream;
          console.log("✅ Local stream attached to local video");
        }

        // ========================================================
        // CREATE PEER
        // ========================================================

        peer = new Peer({
          config: {
            iceServers: [
              {
                urls: "stun:stun.l.google.com:19302",
              },
              {
                urls: "stun:stun1.l.google.com:19302",
              },
              {
                urls: "stun:stun.relay.metered.ca:80",
              },
              {
                urls: "turn:global.relay.metered.ca:80",
                username: "b461f0d5bee907774c5ef65d",
                credential: "qAiBN0l27YJTAiOu",
              },
              {
                urls: "turn:global.relay.metered.ca:80?transport=tcp",
                username: "b461f0d5bee907774c5ef65d",
                credential: "qAiBN0l27YJTAiOu",
              },
              {
                urls: "turn:global.relay.metered.ca:443",
                username: "b461f0d5bee907774c5ef65d",
                credential: "qAiBN0l27YJTAiOu",
              },
              {
                urls: "turns:global.relay.metered.ca:443?transport=tcp",
                username: "b461f0d5bee907774c5ef65d",
                credential: "qAiBN0l27YJTAiOu",
              },
            ],
          },
        });

        peerInstance.current = peer;

        // ========================================================
        // PEER OPEN
        // ========================================================

        peer.on("open", (id) => {
          if (!isMounted) return; // ONLY SET STATE IF MOUNTED
          
          console.log("=================================");
          console.log("✅ PEER CONNECTED");
          console.log("Your Peer ID:", id);
          console.log("=================================");

          setPeerId(id);
        });

        // ========================================================
        // INCOMING CALL
        // ========================================================

        peer.on("call", (call) => {
          console.log("=================================");
          console.log("📞 INCOMING CALL");
          console.log("Caller ID:", call.peer);
          console.log("=================================");

          if (!myStream) {
            console.error(
              "❌ Cannot answer call because local stream is missing"
            );
            return;
          }

          // ======================================================
          // CHECK FRIEND'S LOCAL STREAM
          // ======================================================

          console.log("=================================");
          console.log("🎥 CHECKING MY LOCAL STREAM BEFORE ANSWERING");
          console.log("=================================");

          console.log("Local video tracks:", myStream.getVideoTracks());

          myStream.getVideoTracks().forEach((track) => {
            console.log("Local video track ID:", track.id);
            console.log("Local track state:", track.readyState);
            console.log("Local track enabled:", track.enabled);
            console.log("Local track muted:", track.muted);
            console.log("Local track settings:", track.getSettings());
          });

          console.log("=================================");
          console.log("📤 ANSWERING CALL WITH LOCAL STREAM");

          call.answer(myStream);

          console.log("✅ Call answered");

          // ======================================================
          // RECEIVE CALLER STREAM
          // ======================================================

          call.on("stream", (userVideoStream) => {
            if (!isMounted) return; // ONLY SET STATE IF MOUNTED

            console.log("=================================");
            console.log("🎥 SUCCESS! RECEIVED CALLER STREAM");
            console.log("=================================");

            console.log("Remote stream:", userVideoStream);
            console.log("Remote video tracks:", userVideoStream.getVideoTracks());
            console.log("Remote audio tracks:", userVideoStream.getAudioTracks());

            userVideoStream.getVideoTracks().forEach((track) => {
              console.log("Remote track ID:", track.id);
              console.log("Remote track state:", track.readyState);
              console.log("Remote track enabled:", track.enabled);
              console.log("Remote track muted:", track.muted);
            });

            setRemoteStream(userVideoStream);
          });

          // ======================================================
          // CALL EVENTS
          // ======================================================

          call.on("close", () => {
            console.log("📞 Incoming call closed");
          });

          call.on("error", (err) => {
            console.error("❌ Incoming call error:", err);
          });
        });

        // ========================================================
        // PEER ERROR
        // ========================================================

        peer.on("error", (err) => {
          console.error("❌ PEERJS ERROR:", err);
        });

        peer.on("disconnected", () => {
          console.warn("⚠️ PEER DISCONNECTED");
        });

        peer.on("close", () => {
          console.log("🔴 PEER CONNECTION CLOSED");
        });
      } catch (err) {
        console.error("❌ Camera access denied or failed:", err);
      }
    };

    initMediaAndPeer();

    return () => {
      // 3. SET isMounted TO FALSE ON CLEANUP
      isMounted = false; 
      
      console.log("🧹 Cleaning up PeerJS and media...");

      if (myStream) {
        myStream.getTracks().forEach((track) => track.stop());
      }

      if (peer) {
        peer.destroy();
      }
    };
  }, []);

  // ============================================================
  // CALL FRIEND
  // ============================================================

  const callFriend = () => {
    if (friendId.trim() === "") {
      alert("Please enter a Friend's ID first!");
      return;
    }

    if (!peerInstance.current) {
      console.error("❌ Peer instance does not exist");
      alert("Peer connection is not ready yet. Please wait a few seconds.");
      return;
    }

    if (!localStream) {
      console.error("❌ Local stream does not exist");
      alert("Camera/microphone is not ready yet.");
      return;
    }

    console.log("=================================");
    console.log("📞 INITIATING CALL");
    console.log("Friend ID:", friendId.trim());
    console.log("My ID:", peerId);
    console.log("=================================");

    console.log("Local stream being sent:", localStream);
    console.log("Video tracks being sent:", localStream.getVideoTracks());

    localStream.getVideoTracks().forEach((track) => {
      console.log("Sending video track:");
      console.log("Track ID:", track.id);
      console.log("Track state:", track.readyState);
      console.log("Track enabled:", track.enabled);
      console.log("Track muted:", track.muted);
      console.log("Track settings:", track.getSettings());
    });

    const call = peerInstance.current.call(friendId.trim(), localStream);

    if (!call) {
      console.error("❌ PeerJS did not create a call");
      return;
    }

    console.log("✅ Call object created");

    // ==========================================================
    // WEBRTC CONNECTION EVENTS
    // ==========================================================

    const monitorPeerConnection = () => {
      if (!call.peerConnection) {
        console.warn("⚠️ call.peerConnection not available yet");
        return;
      }

      const pc = call.peerConnection;

      console.log("=================================");
      console.log("🔎 WEBRTC CONNECTION STATUS");
      console.log("=================================");

      console.log("Connection state:", pc.connectionState);
      console.log("ICE connection state:", pc.iceConnectionState);
      console.log("ICE gathering state:", pc.iceGatheringState);
      console.log("Signaling state:", pc.signalingState);

      pc.onconnectionstatechange = () => {
        console.log("🔄 Connection state changed:", pc.connectionState);
      };

      pc.oniceconnectionstatechange = () => {
        console.log("🔄 ICE state changed:", pc.iceConnectionState);
      };

      pc.onicegatheringstatechange = () => {
        console.log("🔄 ICE gathering state:", pc.iceGatheringState);
      };
    };

    setTimeout(monitorPeerConnection, 1000);

    // ==========================================================
    // RECEIVE FRIEND STREAM
    // ==========================================================

    call.on("stream", (userVideoStream) => {
      console.log("=================================");
      console.log("🎥 SUCCESS! RECEIVED FRIEND STREAM");
      console.log("=================================");

      console.log("Remote stream:", userVideoStream);

      const videoTracks = userVideoStream.getVideoTracks();
      const audioTracks = userVideoStream.getAudioTracks();

      console.log("Remote video tracks:", videoTracks);
      console.log("Remote audio tracks:", audioTracks);

      if (videoTracks.length === 0) {
        console.error("❌ REMOTE STREAM HAS NO VIDEO TRACK!");
      } else {
        console.log("✅ Remote video track exists");
      }

      videoTracks.forEach((track) => {
        console.log("=================================");
        console.log("🎥 REMOTE VIDEO TRACK");
        console.log("=================================");

        console.log("Track ID:", track.id);
        console.log("Track state:", track.readyState);
        console.log("Track enabled:", track.enabled);
        console.log("Track muted:", track.muted);
        console.log("Track settings:", track.getSettings());

        track.onunmute = () => {
          console.log("🟢 REMOTE VIDEO TRACK UNMUTED!");
        };

        track.onmute = () => {
          console.warn("🔴 REMOTE VIDEO TRACK MUTED!");
        };

        track.onended = () => {
          console.warn("🔴 REMOTE VIDEO TRACK ENDED!");
        };
      });

      // ========================================================
      // WEBRTC CONNECTION STATUS
      // ========================================================

      console.log("=================================");
      console.log("🔎 WEBRTC CONNECTION STATUS");
      console.log("=================================");

      if (call.peerConnection) {
        console.log("Connection state:", call.peerConnection.connectionState);
        console.log("ICE connection state:", call.peerConnection.iceConnectionState);
        console.log("ICE gathering state:", call.peerConnection.iceGatheringState);
        console.log("Signaling state:", call.peerConnection.signalingState);
      } else {
        console.warn("⚠️ call.peerConnection is not available");
      }

      setRemoteStream(userVideoStream);
    });

    call.on("close", () => {
      console.log("📞 Outgoing call closed");
    });

    call.on("error", (err) => {
      console.error("❌ OUTGOING CALL ERROR:", err);
    });
  };

  // ============================================================
  // REMOTE VIDEO HANDLING
  // ============================================================

  useEffect(() => {
    if (!remoteStream) {
      console.log("ℹ️ No remote stream yet");
      return;
    }

    console.log("=================================");
    console.log("🔵 PROCESSING REMOTE STREAM");
    console.log("=================================");

    console.log("Remote stream:", remoteStream);

    const video = remoteVideoRef.current;

    if (!video) {
      console.error("❌ remoteVideoRef.current is NULL");
      return;
    }

    console.log("✅ Remote video element found");

    const videoTracks = remoteStream.getVideoTracks();
    console.log("Video tracks:", videoTracks);

    const audioTracks = remoteStream.getAudioTracks();
    console.log("Audio tracks:", audioTracks);

    videoTracks.forEach((track) => {
      console.log("=================================");
      console.log("🎥 REMOTE TRACK INFORMATION");
      console.log("=================================");

      console.log("Track ID:", track.id);
      console.log("Track kind:", track.kind);
      console.log("Track state:", track.readyState);
      console.log("Track enabled:", track.enabled);
      console.log("Track muted:", track.muted);
      console.log("Track settings:", track.getSettings());

      track.onunmute = () => {
        console.log("🟢 REMOTE VIDEO TRACK UNMUTED!");
        console.log("Track state:", track.readyState);
        console.log("Track enabled:", track.enabled);
        console.log("Track muted:", track.muted);

        video
          .play()
          .then(() => {
            console.log("🎥 VIDEO STARTED AFTER TRACK UNMUTED");
          })
          .catch((err) => {
            console.error("❌ PLAY FAILED AFTER UNMUTE:", err);
          });
      };

      track.onmute = () => {
        console.warn("🔴 REMOTE VIDEO TRACK MUTED!");
      };

      track.onended = () => {
        console.warn("🔴 REMOTE VIDEO TRACK ENDED!");
      };
    });

    // ==========================================================
    // ATTACH STREAM
    // ==========================================================

    video.srcObject = remoteStream;

    console.log("✅ Remote stream attached to <video>");

    // ==========================================================
    // VIDEO EVENTS
    // ==========================================================

    video.onloadedmetadata = () => {
      console.log("🟢 REMOTE VIDEO METADATA LOADED");
      console.log("Video width:", video.videoWidth);
      console.log("Video height:", video.videoHeight);
      console.log("Video readyState:", video.readyState);

      video
        .play()
        .then(() => {
          console.log("🎥 REMOTE VIDEO PLAYING");
        })
        .catch((err) => {
          console.error("❌ VIDEO PLAY FAILED:", err);
        });
    };

    video.oncanplay = () => {
      console.log("🟢 REMOTE VIDEO CAN PLAY");
    };

    video.onplaying = () => {
      console.log("🟢 REMOTE VIDEO PLAYING EVENT");
    };

    video.onwaiting = () => {
      console.warn("🟡 REMOTE VIDEO WAITING FOR DATA");
    };

    video.onstalled = () => {
      console.warn("🟡 REMOTE VIDEO STALLED");
    };

    video.onerror = (err) => {
      console.error("❌ REMOTE VIDEO ERROR:", err);
    };

    // ==========================================================
    // 3 SECOND DIAGNOSTIC
    // ==========================================================

    const timer = setTimeout(() => {
      console.log("=================================");
      console.log("🔎 VIDEO ELEMENT CHECK");
      console.log("=================================");

      console.log("video.readyState:", video.readyState);
      console.log("video.networkState:", video.networkState);
      console.log("video.videoWidth:", video.videoWidth);
      console.log("video.videoHeight:", video.videoHeight);
      console.log("video.paused:", video.paused);
      console.log("video.currentTime:", video.currentTime);
      console.log("video.duration:", video.duration);
      console.log("video.srcObject:", video.srcObject);

      console.log("=================================");
    }, 3000);

    // ==========================================================
    // 8 SECOND DIAGNOSTIC
    // ==========================================================

    const timer2 = setTimeout(() => {
      console.log("=================================");
      console.log("🔎 SECOND VIDEO ELEMENT CHECK");
      console.log("=================================");

      console.log("video.readyState:", video.readyState);
      console.log("video.videoWidth:", video.videoWidth);
      console.log("video.videoHeight:", video.videoHeight);
      console.log("video.paused:", video.paused);

      videoTracks.forEach((track) => {
        console.log("Remote track still live:", track.readyState);
        console.log("Remote track still enabled:", track.enabled);
        console.log("Remote track still muted:", track.muted);
      });

      console.log("=================================");
    }, 8000);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);

      video.onloadedmetadata = null;
      video.oncanplay = null;
      video.onplaying = null;
      video.onwaiting = null;
      video.onstalled = null;
      video.onerror = null;

      videoTracks.forEach((track) => {
        track.onunmute = null;
        track.onmute = null;
        track.onended = null;
      });
    };
  }, [remoteStream]);

  // ============================================================
  // AUDIO VISUALIZER
  // ============================================================

  useEffect(() => {
    let audioContext;
    let analyser;
    let source;
    let animationFrameId;

    if (localStream && user1Media.mic) {
      const AudioContext =
        window.AudioContext || window.webkitAudioContext;

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
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }

        const average = sum / dataArray.length;
        const volumePercentage = Math.min(average * 1.5, 100);

        if (volumeBarRef.current) {
          volumeBarRef.current.style.height = `${volumePercentage}%`;
        }

        animationFrameId = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } else {
      if (volumeBarRef.current) {
        volumeBarRef.current.style.height = "0%";
      }
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (audioContext && audioContext.state !== "closed") {
        audioContext.close();
      }
    };
  }, [localStream, user1Media.mic]);

  // ============================================================
  // LOCAL MIC
  // ============================================================

  const toggleLocalMic = () => {
    setUser1Media((prev) => {
      const newState = !prev.mic;
      if (localStream) {
        localStream
          .getAudioTracks()
          .forEach((track) => (track.enabled = newState));
      }
      return {
        ...prev,
        mic: newState,
      };
    });
  };

  // ============================================================
  // LOCAL CAMERA
  // ============================================================

  const toggleLocalCam = () => {
    setUser1Media((prev) => {
      const newState = !prev.cam;
      if (localStream) {
        localStream
          .getVideoTracks()
          .forEach((track) => (track.enabled = newState));
      }
      return {
        ...prev,
        cam: newState,
      };
    });
  };

  // ============================================================
  // FULLSCREEN
  // ============================================================

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="w-full flex flex-col items-center gap-6 pb-10">
      {/* ========================================================
          YOUTUBE URL
      ======================================================== */}
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

      {/* ========================================================
          PEER IDS
      ======================================================== */}
      <div className="w-full max-w-[1600px] px-4 md:px-8 flex flex-col md:flex-row items-center gap-4">
        {/* YOUR ID */}
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

        {/* FRIEND ID */}
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

      {/* ========================================================
          MAIN AREA
      ======================================================== */}
      <div
        ref={containerRef}
        className={
          isFullscreen
            ? "w-screen h-screen bg-black overflow-hidden relative"
            : "flex flex-col xl:flex-row gap-6 w-full max-w-[1600px] px-4 md:px-8"
        }
      >
        {/* ======================================================
            YOUTUBE
        ====================================================== */}
        <div
          className={
            isFullscreen
              ? "absolute inset-0 w-full h-full z-0"
              : "relative flex-1 aspect-video bg-black rounded-xl shadow-2xl overflow-hidden"
          }
        >
          <div className="absolute inset-0 w-full h-full">
            <iframe
              key={videoId}
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&fs=0&modestbranding=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen={false}
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

        {/* ======================================================
            CAMERA AREA
        ====================================================== */}
        <div
          className={
            isFullscreen
              ? "absolute inset-0 pointer-events-none z-50"
              : "w-full xl:w-80 flex flex-col gap-6 shrink-0"
          }
        >
          {/* ====================================================
              LOCAL CAMERA
          ==================================================== */}
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
                  className={`w-full h-full object-cover ${
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

          {/* ====================================================
              REMOTE CAMERA
          ==================================================== */}
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
                {/* ==================================================
                    REMOTE VIDEO
                ================================================== */}
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  // controls
                  className="absolute inset-0 w-full h-full object-cover"
                />

                {/* WAITING MESSAGE */}
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

              {/* REMOTE CONTROLS */}
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
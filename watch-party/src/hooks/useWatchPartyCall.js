import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";

export default function useWatchPartyCall({
  dataConnRef,
  onReceiveData,
  videoId,
  localVideoRef,
  remoteVideoRef,
  volumeBarRef,
}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [peerId, setPeerId] = useState("");
  const [friendId, setFriendId] = useState("");
  const [user1Media, setUser1Media] = useState({ mic: true, cam: true });
  const [user2Media, setUser2Media] = useState({ mic: true, cam: true });

  // Connected state & shared active room ID
  const [isConnected, setIsConnected] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("");

  const peerInstance = useRef(null);
  const videoIdRef = useRef(videoId);
  const user1MediaRef = useRef(user1Media);

  useEffect(() => {
    videoIdRef.current = videoId;
  }, [videoId]);

  useEffect(() => {
    user1MediaRef.current = user1Media;
  }, [user1Media]);

  const generateShortId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  // Helper to send media state over data connection
  const broadcastMediaState = (mediaState) => {
    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send({
        type: "MEDIA_STATE",
        mic: mediaState.mic,
        cam: mediaState.cam,
      });
    }
  };

  useEffect(() => {
    let myStream;
    let peer;
    let isMounted = true;

    const initMediaAndPeer = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
            frameRate: { ideal: 20, max: 30 },
          },
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        myStream = stream;
        setLocalStream(myStream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = myStream;
        }

        const res = await fetch("https://watch-party-74e5.onrender.com/api/turn-credentials");
        const turnData = await res.json();
        const shortId = generateShortId();

        peer = new Peer(shortId, {
          host: "watch-party-74e5.onrender.com",
          port: 443,
          path: "/myapp",
          secure: true,
          config: {
            iceServers: turnData.iceServers,
          },
        });

        peerInstance.current = peer;

        peer.on("open", (id) => {
          if (!isMounted) return;
          setPeerId(id);
        });

        peer.on("connection", (conn) => {
          dataConnRef.current = conn;

          conn.on("data", (data) => {
            if (data.type === "CALL_REQUEST") {
              setIncomingCall({ callerId: data.callerId, conn });
            } else if (data.type === "MEDIA_STATE") {
              setUser2Media({ mic: data.mic, cam: data.cam });
            } else {
              onReceiveData(data);
            }
          });
        });

        peer.on("call", (call) => {
          if (!myStream) return;
          call.answer(myStream);

          call.on("stream", (userVideoStream) => {
            if (!isMounted) return;
            setRemoteStream(userVideoStream);
          });
        });

        peer.on("error", (err) => {
          console.error("PeerJS error:", err);
          if (err.type === "peer-unavailable") {
            setCallStatus("Friend's Room ID not found or offline.");
            setTimeout(() => setCallStatus(""), 4000);
          }
        });
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };

    initMediaAndPeer();

    return () => {
      isMounted = false;
      if (myStream) myStream.getTracks().forEach((track) => track.stop());
      if (peer) peer.destroy();
    };
  }, [onReceiveData, localVideoRef, dataConnRef]);

  // Video track playback listeners
  useEffect(() => {
    if (!remoteStream) return;
    const video = remoteVideoRef.current;
    if (!video) return;

    const videoTracks = remoteStream.getVideoTracks();
    video.srcObject = remoteStream;

    videoTracks.forEach((track) => {
      track.onunmute = () => video.play().catch(() => {});
    });

    video.onloadedmetadata = () => video.play().catch(() => {});

    return () => {
      video.onloadedmetadata = null;
      videoTracks.forEach((track) => {
        track.onunmute = null;
      });
    };
  }, [remoteStream, remoteVideoRef]);

  // Volume Bar Meter
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
        const volumePercentage = Math.min(average * 1.5, 100);

        if (volumeBarRef.current) volumeBarRef.current.style.height = `${volumePercentage}%`;
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
  }, [localStream, user1Media.mic, volumeBarRef]);

  // Mute / Unmute Mic
  const toggleLocalMic = () => {
    setUser1Media((prev) => {
      const newState = !prev.mic;
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = newState;
        });
      }
      const updated = { ...prev, mic: newState };
      broadcastMediaState(updated);
      return updated;
    });
  };

  // Turn Cam On / Off
  const toggleLocalCam = () => {
    setUser1Media((prev) => {
      const newState = !prev.cam;
      if (localStream) {
        localStream.getVideoTracks().forEach((track) => {
          track.enabled = newState;
        });
      }
      const updated = { ...prev, cam: newState };
      broadcastMediaState(updated);
      return updated;
    });
  };

  // Caller initiates connection
  const callFriend = () => {
    const friendIdClean = friendId.trim().toUpperCase();
    if (friendIdClean === "") return alert("Please enter a Friend's ID first!");
    if (!peerInstance.current || !localStream) return alert("System not ready yet.");

    setCallStatus("Negotiating network connection...");
    const dataConn = peerInstance.current.connect(friendIdClean);
    dataConnRef.current = dataConn;

    dataConn.on("open", () => {
      setCallStatus("Ringing friend's device...");
      dataConn.send({ type: "CALL_REQUEST", callerId: peerId });

      dataConn.on("data", (data) => {
        if (data.type === "CALL_ACCEPTED") {
          setIsConnected(true);
          setActiveRoomId(friendIdClean);
          setCallStatus("Connected!");

          const call = peerInstance.current.call(friendIdClean, localStream);
          call.on("stream", (userVideoStream) => setRemoteStream(userVideoStream));

          // Send current video & local media state
          dataConn.send({ type: "LOAD_VIDEO", videoId: videoIdRef.current });
          dataConn.send({ type: "MEDIA_STATE", ...user1MediaRef.current });

          setTimeout(() => setCallStatus(""), 3000);
        } else if (data.type === "CALL_REJECTED") {
          setIsConnected(false);
          setCallStatus("Call rejected by friend.");
          dataConnRef.current = null;
          setTimeout(() => setCallStatus(""), 4000);
        } else if (data.type === "MEDIA_STATE") {
          setUser2Media({ mic: data.mic, cam: data.cam });
        } else {
          onReceiveData(data);
        }
      });
    });
  };

  // Receiver accepts connection
  const acceptCall = () => {
    if (incomingCall) {
      dataConnRef.current = incomingCall.conn;
      setIsConnected(true);
      setActiveRoomId(peerId);

      incomingCall.conn.send({ type: "CALL_ACCEPTED" });
      // Send receiver's current media state
      incomingCall.conn.send({ type: "MEDIA_STATE", ...user1MediaRef.current });

      incomingCall.conn.on("data", (data) => {
        if (data.type === "MEDIA_STATE") {
          setUser2Media({ mic: data.mic, cam: data.cam });
        } else if (data.type !== "CALL_REQUEST") {
          onReceiveData(data);
        }
      });

      setIncomingCall(null);
    }
  };

  const rejectCall = () => {
    if (incomingCall) {
      incomingCall.conn.send({ type: "CALL_REJECTED" });
      setIncomingCall(null);
    }
  };

  return {
    localStream,
    remoteStream,
    peerId,
    friendId,
    setFriendId,
    user1Media,
    setUser1Media,
    user2Media,
    setUser2Media,
    toggleLocalMic,
    toggleLocalCam,
    callFriend,
    incomingCall,
    acceptCall,
    rejectCall,
    callStatus,
    isConnected,
    activeRoomId,
  };
}
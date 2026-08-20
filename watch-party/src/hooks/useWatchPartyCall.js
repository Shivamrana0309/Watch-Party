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

  const [isConnected, setIsConnected] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [callStatus, setCallStatus] = useState("");

  const peerInstance = useRef(null);
  const currentCallRef = useRef(null);
  const videoIdRef = useRef(videoId);
  const user1MediaRef = useRef(user1Media);

  useEffect(() => {
    videoIdRef.current = videoId;
  }, [videoId]);

  useEffect(() => {
    user1MediaRef.current = user1Media;
  }, [user1Media]);

  // Generate a fresh 6-char ID every time the page loads
  const generatePeerId = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

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

        // Use the new fresh ID generator to prevent the refresh deadlock!
        const freshId = generatePeerId();

        peer = new Peer(freshId, {
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

        // Listen for incoming Data Connections
        peer.on("connection", (conn) => {
          dataConnRef.current = conn;

          conn.on("data", (data) => {
            if (data.type === "CALL_REQUEST") {
              setIncomingCall({ callerId: data.callerId, conn });
            } else {
              handleIncomingData(data, conn, myStream);
            }
          });
        });

        peer.on("call", (call) => {
          if (!myStream) return;
          currentCallRef.current = call;
          call.answer(myStream);

          call.on("stream", (userVideoStream) => {
            if (!isMounted) return;
            setRemoteStream(userVideoStream);
          });
        });

        peer.on("error", (err) => {
          console.error("PeerJS error:", err);
          if (err.type === "peer-unavailable") {
            setCallStatus("Friend is offline or left the room.");
            setTimeout(() => setCallStatus(""), 4000);
          }
        });
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };

    const handleIncomingData = (data, conn, stream) => {
      if (data.type === "MEDIA_STATE") {
        setUser2Media({ mic: data.mic, cam: data.cam });
      } else if (data.type === "CALL_REJECTED") {
        leaveCall();
        setCallStatus("Call was rejected.");
        setTimeout(() => setCallStatus(""), 4000);
      } else if (data.type === "CALL_LEAVE") {
        // Handle friend leaving
        if (currentCallRef.current) currentCallRef.current.close();
        setRemoteStream(null);
        setIsConnected(false);
        setActiveRoomId("");
        setFriendId("");
        setUser2Media({ mic: true, cam: true });
        setCallStatus("Friend left the call.");
        setTimeout(() => setCallStatus(""), 4000);
      } else {
        onReceiveData(data);
      }
    };

    initMediaAndPeer();

    return () => {
      isMounted = false;
      if (myStream) myStream.getTracks().forEach((track) => track.stop());
      if (peer) peer.destroy();
    };
  }, [onReceiveData, localVideoRef, dataConnRef]);

  // Video track playback
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

  // Volume Bar
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
          currentCallRef.current = call;
          call.on("stream", (userVideoStream) => setRemoteStream(userVideoStream));

          dataConn.send({ type: "LOAD_VIDEO", videoId: videoIdRef.current });
          dataConn.send({ type: "MEDIA_STATE", ...user1MediaRef.current });

          setTimeout(() => setCallStatus(""), 3000);
        } else if (data.type === "CALL_REJECTED") {
          leaveCall();
          setCallStatus("Call rejected by friend.");
          setTimeout(() => setCallStatus(""), 4000);
        } else if (data.type === "MEDIA_STATE") {
          setUser2Media({ mic: data.mic, cam: data.cam });
        } else if (data.type === "CALL_LEAVE") {
          leaveCall();
        } else {
          onReceiveData(data);
        }
      });
    });
  };

  const acceptCall = () => {
    if (incomingCall) {
      dataConnRef.current = incomingCall.conn;
      setIsConnected(true);
      setActiveRoomId(peerId);

      incomingCall.conn.send({ type: "CALL_ACCEPTED" });
      incomingCall.conn.send({ type: "MEDIA_STATE", ...user1MediaRef.current });

      incomingCall.conn.on("data", (data) => {
        if (data.type === "MEDIA_STATE") {
          setUser2Media({ mic: data.mic, cam: data.cam });
        } else if (data.type === "CALL_LEAVE") {
          leaveCall();
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

  // Leave and reset call completely
  const leaveCall = () => {
    if (dataConnRef.current && dataConnRef.current.open) {
      try {
        dataConnRef.current.send({ type: "CALL_LEAVE" });
      } catch {}
      dataConnRef.current.close();
      dataConnRef.current = null;
    }

    if (currentCallRef.current) {
      currentCallRef.current.close();
      currentCallRef.current = null;
    }

    setRemoteStream(null);
    setIsConnected(false);
    setActiveRoomId("");
    setFriendId("");
    setUser2Media({ mic: true, cam: true });
    setCallStatus("You left the call.");

    setTimeout(() => setCallStatus(""), 3000);
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
    acceptCall,
    rejectCall,
    leaveCall,
    incomingCall,
    callStatus,
    isConnected,
    activeRoomId,
  };
}
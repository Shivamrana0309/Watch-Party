import { useEffect, useRef, useState } from "react";
import Peer from "peerjs";

export default function useScreenShareCall({
  dataConnRef,
  localVideoRef,
  remoteVideoRef,
  volumeBarRef,
}) {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localScreenStream, setLocalScreenStream] = useState(null);
  const [remoteScreenStream, setRemoteScreenStream] = useState(null);
  
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
  const screenCallRef = useRef(null);
  const user1MediaRef = useRef(user1Media);

  useEffect(() => {
    user1MediaRef.current = user1Media;
  }, [user1Media]);

  const generatePeerId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const broadcastMediaState = (mediaState) => {
    if (dataConnRef.current && dataConnRef.current.open) {
      dataConnRef.current.send({ type: "MEDIA_STATE", mic: mediaState.mic, cam: mediaState.cam });
    }
  };

  useEffect(() => {
    let myStream;
    let peer;
    let isMounted = true;

    const initMediaAndPeer = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 20 } },
          audio: true,
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        myStream = stream;
        setLocalStream(myStream);

        if (localVideoRef.current) localVideoRef.current.srcObject = myStream;

        const res = await fetch("https://watch-party-74e5.onrender.com/api/turn-credentials");
        const turnData = await res.json();
        const freshId = generatePeerId();

        peer = new Peer(freshId, {
          host: "watch-party-74e5.onrender.com",
          port: 443,
          path: "/myapp",
          secure: true,
          config: { iceServers: turnData.iceServers },
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
            } else {
              handleIncomingData(data, conn, myStream);
            }
          });
        });

        // Answer incoming calls
        peer.on("call", (call) => {
          // If it's a screen share call, we answer but don't send our webcam stream back on this connection
          if (call.metadata && call.metadata.type === "SCREEN_SHARE") {
            call.answer(); 
            call.on("stream", (screenStream) => {
              if (isMounted) setRemoteScreenStream(screenStream);
            });
          } else {
            // Standard webcam call
            if (!myStream) return;
            currentCallRef.current = call;
            call.answer(myStream);
            call.on("stream", (userVideoStream) => {
              if (isMounted) setRemoteStream(userVideoStream);
            });
          }
        });

        peer.on("error", (err) => {
          if (err.type === "peer-unavailable") {
            setCallStatus("Friend is offline.");
            setTimeout(() => setCallStatus(""), 4000);
          }
        });
      } catch (err) {
        console.error("Initialization error:", err);
      }
    };

    const handleIncomingData = (data) => {
      if (data.type === "MEDIA_STATE") {
        setUser2Media({ mic: data.mic, cam: data.cam });
      } else if (data.type === "SCREEN_SHARE_STOPPED") {
        setRemoteScreenStream(null);
      } else if (data.type === "CALL_REJECTED") {
        leaveCall();
        setCallStatus("Call was rejected.");
        setTimeout(() => setCallStatus(""), 4000);
      } else if (data.type === "CALL_LEAVE") {
        leaveCall();
        setCallStatus("Friend left the call.");
        setTimeout(() => setCallStatus(""), 4000);
      }
    };

    initMediaAndPeer();

    return () => {
      isMounted = false;
      if (myStream) myStream.getTracks().forEach((track) => track.stop());
      if (peer) peer.destroy();
    };
  }, [localVideoRef, dataConnRef]);

  // Video track playback logic
  useEffect(() => {
    if (!remoteStream) return;
    const video = remoteVideoRef.current;
    if (!video) return;

    video.srcObject = remoteStream;
    const videoTracks = remoteStream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.onunmute = () => video.play().catch(() => {});
    });
    video.onloadedmetadata = () => video.play().catch(() => {});
  }, [remoteStream, remoteVideoRef]);

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
  }, [localStream, user1Media.mic, volumeBarRef]);

  // --- Screen Sharing Functionality ---
  const toggleScreenShare = async () => {
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(t => t.stop());
      setLocalScreenStream(null);
      if (screenCallRef.current) screenCallRef.current.close();
      if (dataConnRef.current) dataConnRef.current.send({ type: "SCREEN_SHARE_STOPPED" });
    } else {
      try {
        // const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: "always" }, audio: true });
        const stream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { 
                cursor: "always",
                frameRate: { ideal: 15, max: 24 }, // Lower max to 24 for a cinematic standard
                width: { ideal: 1280, max: 1920 }, // Prefer 720p, cap at 1080p
                height: { ideal: 720, max: 1080 }
            }, 
            audio: true 
        });

        // ADD THIS: Tell the encoder to prioritize smooth video playback
        // const videoTrack = stream.getVideoTracks()[0];
        //     if ("contentHint" in videoTrack) {
        //     videoTrack.contentHint = "motion"; // Change to "detail" if you are sharing code/text
        // }
        setLocalScreenStream(stream);

        // If we are connected to someone, immediately call them with the screen track
        if (isConnected && activeRoomId) {
          const call = peerInstance.current.call(activeRoomId, stream, { metadata: { type: "SCREEN_SHARE" } });
          screenCallRef.current = call;
        }

        // Handle the user clicking "Stop sharing" on the browser's native popup
        stream.getVideoTracks()[0].onended = () => {
          setLocalScreenStream(null);
          if (screenCallRef.current) screenCallRef.current.close();
          if (dataConnRef.current) dataConnRef.current.send({ type: "SCREEN_SHARE_STOPPED" });
        };
      } catch (err) {
        console.error("Screen sharing failed", err);
      }
    }
  };

  const toggleLocalMic = () => {
    setUser1Media((prev) => {
      const newState = !prev.mic;
      if (localStream) localStream.getAudioTracks().forEach((track) => track.enabled = newState);
      const updated = { ...prev, mic: newState };
      broadcastMediaState(updated);
      return updated;
    });
  };

  const toggleLocalCam = () => {
    setUser1Media((prev) => {
      const newState = !prev.cam;
      if (localStream) localStream.getVideoTracks().forEach((track) => track.enabled = newState);
      const updated = { ...prev, cam: newState };
      broadcastMediaState(updated);
      return updated;
    });
  };

  const callFriend = () => {
    const friendIdClean = friendId.trim().toUpperCase();
    if (!friendIdClean || !peerInstance.current || !localStream) return;

    setCallStatus("Ringing...");
    const dataConn = peerInstance.current.connect(friendIdClean);
    dataConnRef.current = dataConn;

    dataConn.on("open", () => {
      dataConn.send({ type: "CALL_REQUEST", callerId: peerId });
      dataConn.on("data", (data) => {
        if (data.type === "CALL_ACCEPTED") {
          setIsConnected(true);
          setActiveRoomId(friendIdClean);
          setCallStatus("Connected!");

          const call = peerInstance.current.call(friendIdClean, localStream);
          currentCallRef.current = call;
          call.on("stream", (userVideoStream) => setRemoteStream(userVideoStream));
          
          dataConn.send({ type: "MEDIA_STATE", ...user1MediaRef.current });

          // If you were already sharing your screen before calling, send it now
          if (localScreenStream) {
            screenCallRef.current = peerInstance.current.call(friendIdClean, localScreenStream, { metadata: { type: "SCREEN_SHARE" } });
          }

          setTimeout(() => setCallStatus(""), 3000);
        } else if (data.type === "CALL_REJECTED") {
          leaveCall();
          setCallStatus("Call rejected.");
        } else if (data.type === "MEDIA_STATE") {
          setUser2Media({ mic: data.mic, cam: data.cam });
        } else if (data.type === "SCREEN_SHARE_STOPPED") {
          setRemoteScreenStream(null);
        } else if (data.type === "CALL_LEAVE") {
          leaveCall();
        }
      });
    });
  };

  const acceptCall = () => {
    if (incomingCall) {
      dataConnRef.current = incomingCall.conn;
      setIsConnected(true);
      setActiveRoomId(incomingCall.callerId);

      incomingCall.conn.send({ type: "CALL_ACCEPTED" });
      incomingCall.conn.send({ type: "MEDIA_STATE", ...user1MediaRef.current });

      // Send screen share if already active
      if (localScreenStream) {
          screenCallRef.current = peerInstance.current.call(incomingCall.callerId, localScreenStream, { metadata: { type: "SCREEN_SHARE" } });
      }

      incomingCall.conn.on("data", (data) => {
        if (data.type === "MEDIA_STATE") setUser2Media({ mic: data.mic, cam: data.cam });
        else if (data.type === "SCREEN_SHARE_STOPPED") setRemoteScreenStream(null);
        else if (data.type === "CALL_LEAVE") leaveCall();
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

  const leaveCall = () => {
    if (dataConnRef.current && dataConnRef.current.open) {
      try { dataConnRef.current.send({ type: "CALL_LEAVE" }); } catch {}
      dataConnRef.current.close();
      dataConnRef.current = null;
    }
    if (currentCallRef.current) currentCallRef.current.close();
    if (screenCallRef.current) screenCallRef.current.close();

    setRemoteStream(null);
    setRemoteScreenStream(null);
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(t => t.stop());
      setLocalScreenStream(null);
    }

    setIsConnected(false);
    setActiveRoomId("");
    setFriendId("");
    setUser2Media({ mic: true, cam: true });
    setCallStatus("You left the call.");
    setTimeout(() => setCallStatus(""), 3000);
  };

  return {
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
  };
}
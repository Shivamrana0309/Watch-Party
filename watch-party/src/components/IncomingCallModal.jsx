import React from "react";

export default function IncomingCallModal({ incomingCall, acceptCall, rejectCall }) {
  if (!incomingCall) return null;

  return (
    <div className="incoming-call-modal">
      <span>
        Incoming request from: <strong>{incomingCall.callerId}</strong>
      </span>
      <div className="incoming-call-actions">
        <button onClick={acceptCall} className="accept-btn">
          Accept
        </button>
        <button onClick={rejectCall} className="reject-btn">
          Reject
        </button>
      </div>
    </div>
  );
}

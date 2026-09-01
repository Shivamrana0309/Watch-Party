import React from 'react';
import { Maximize, Minimize } from 'lucide-react';

export default function VideoPlayerControls({
  controlsVisible,
  currentTime,
  duration,
  isPaused,
  isStreamer,
  setIsScrubbing,
  handleSeek,
  togglePlayPause,
  formatTime,
  toggleFullscreen,
  isFullscreen
}) {
  return (
    <div 
      className="player-controls-overlay" 
      onClick={(e) => e.stopPropagation()}
      style={{ 
        display: 'flex', flexDirection: 'column', gap: '0.5rem', 
        background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', 
        padding: '1rem', boxSizing: 'border-box', position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
        opacity: controlsVisible ? 1 : 0,
        pointerEvents: controlsVisible ? 'auto' : 'none',
        transition: 'opacity 0.3s ease'
      }}
    >
      <div className="flex items-center gap-2 w-full">
        <span className="text-xs text-gray-200 font-mono w-10 text-right">{formatTime(currentTime)}</span>
        <input 
          type="range" 
          min="0" 
          max={duration || 100}
          value={currentTime || 0}
          onMouseDown={() => setIsScrubbing(true)}
          onTouchStart={() => setIsScrubbing(true)}
          onMouseUp={() => setIsScrubbing(false)}
          onTouchEnd={() => setIsScrubbing(false)}
          onChange={handleSeek}
          style={{
            background: `linear-gradient(to right, #3b82f6 ${duration ? (currentTime / duration) * 100 : 0}%, #4b5563 ${duration ? (currentTime / duration) * 100 : 0}%)`
          }}
          className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:h-2 transition-all"
        />
        <span className="text-xs text-gray-200 font-mono w-10">{formatTime(duration)}</span>
      </div>
      <div className="flex items-center justify-between mt-1 px-1 w-full">
        <div className="flex items-center gap-4">
          <button 
            onClick={togglePlayPause}
            className="text-white hover:text-blue-400 transition-colors flex items-center justify-center w-8 h-8"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          >
            {isPaused ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M8 5v14l11-7z"/></svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            )}
          </button>
          
          <div className="text-xs text-gray-300 font-medium bg-gray-800/80 px-2 py-1 rounded">
            Role: {isStreamer ? <span className="text-green-400">Streamer</span> : <span className="text-blue-400">Viewer</span>}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="button" onClick={toggleFullscreen} className="text-gray-300 hover:text-white transition-colors" style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
        </div>
      </div>
    </div>
  );
}

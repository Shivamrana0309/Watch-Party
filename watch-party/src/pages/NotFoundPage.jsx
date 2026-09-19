import React from 'react';
import { Link } from 'react-router-dom';

const NotFoundPage = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: '#121212' }}>
      <h1 
        className="text-8xl md:text-[10rem] mb-2" 
        style={{ color: '#FFFFFF', fontFamily: "'Playfair Display', 'Merriweather', serif" }}
      >
        404
      </h1>
      <h2 
        className="text-xl md:text-2xl mb-12 text-center" 
        style={{ color: '#CCCCCC', fontFamily: "'Playfair Display', 'Merriweather', serif" }}
      >
        The page you're looking for doesn't exist
      </h2>
      <br></br>
      <Link 
        to="/" 
        className="flex items-center justify-center rounded-xl transition-opacity hover:opacity-90 shadow-lg"
        style={{ backgroundColor: '#2563eb', width: '220px', height: '50px', textDecoration: 'none' }}
      >
        <div 
          className="font-bold text-base md:text-lg uppercase tracking-wider"
          style={{ color: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}
        >
          RETURN TO HOME
        </div>
      </Link>
    </div>
  );
};

export default NotFoundPage;

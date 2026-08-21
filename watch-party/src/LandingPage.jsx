import React from 'react';
import './LandingPage.css';

// Change your component definition to look like this:
export default function LandingPage({ onLoginClick, onSignupClick }) {
    return (
        <div className="landing-body">
            <div className="landing-container">
                {/* Navigation */}
                <nav className="navbar">
                    <div className="nav-left">
                        <div className="logo"></div>
                        <div className="nav-links">
                            <a href="#">Products</a>
                            <a href="#">App</a>
                            <a href="#">About</a>
                            <a href="#">FAQ</a>
                        </div>
                    </div>
                    <div className="nav-right">
                        <button className="btn btn-login" onClick={onLoginClick}>LOG IN</button>
                        <button className="btn btn-signup" onClick={onSignupClick}>SIGN UP</button>
                    </div>
                </nav>

                {/* Main Content Grid */}
                <main className="bento-grid">
                    
                    {/* Left Large Card */}
                    <div className="bento-card dark-card">
                        <div>
                            <div className="small-text" style={{ color: '#888' }}>
                                Synchronized Viewing Platform
                            </div>
                            <h1>Connect. Sync.<br />And watch<br />together.</h1>
                        </div>
                        
                        <div className="dark-card-graphics"></div>

                        <div className="action-area">
                            <button className="btn btn-join">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="9" cy="21" r="1" />
                                    <circle cx="20" cy="21" r="1" />
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                                </svg>
                                JOIN A PARTY
                            </button>
                            <span className="explore-text">EXPLORE PLANS</span>
                        </div>
                    </div>

                    {/* Right Column */}
                    <div className="right-column">
                        
                        {/* Blog Card */}
                        <div className="bento-card blog-card">
                            <div className="small-text">Streaming Community Insights</div>
                            <h2>View our blog</h2>
                            
                            <div className="planet-large"></div>
                            <div className="planet-small"></div>
                            
                            <svg className="icon-top-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M7 17L17 7M17 7H7M17 7V17" />
                            </svg>
                        </div>

                        {/* Bottom Row (About & Contact) */}
                        <div className="bottom-row">
                            
                            {/* About Us Card */}
                            <div className="bento-card info-card purple-card">
                                <div className="small-text">Discover<br />Our Vision</div>
                                <h2>About us</h2>
                                
                                <svg className="icon-top-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="18" cy="5" r="3" />
                                    <circle cx="6" cy="12" r="3" />
                                    <circle cx="18" cy="19" r="3" />
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                </svg>
                            </div>

                            {/* Contact Card */}
                            <div className="bento-card info-card green-card">
                                <div className="small-text">Support Team<br />On Standby</div>
                                <h2>Contact us</h2>
                                
                                <svg className="icon-top-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                                </svg>
                            </div>
                        </div>

                    </div>
                </main>
            </div>
        </div>
    );
}
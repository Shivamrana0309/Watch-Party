import React, { useState } from 'react';
import './LoginPage.css';

export default function LoginPage({ onLoginSuccess, onNavigateSignup }) {
    const [credentials, setCredentials] = useState({ emailOrMobile: '', password: '' });

    const handleChange = (e) => {
        setCredentials({ ...credentials, [e.target.id]: e.target.value });
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        
        try {
            const response = await fetch('https://watch-party-74e5.onrender.com/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(credentials)
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.token); // Save JWT token
                onLoginSuccess(); // Enter the Watch Party room
            } else {
                alert("Invalid credentials.");
            }
        } catch (error) {
            console.error("Login error:", error);
            alert("Server error. Make sure your backend is running.");
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="login-container">
                <div className="login-logo">
                    <h1>WatchParty</h1>
                    <p>Watch together, wherever you are.</p>
                </div>

                <form onSubmit={handleLogin}>
                    <div className="input-group">
                        <label htmlFor="emailOrMobile">Email or Mobile No.</label>
                        <input type="text" id="emailOrMobile" placeholder="you@example.com" required onChange={handleChange} />
                    </div>
                    
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password" placeholder="••••••••" required onChange={handleChange} />
                    </div>

                    <button type="submit" className="login-btn btn-primary">Sign In</button>

                    <div className="links">
                        <a href="#" onClick={(e) => { e.preventDefault(); onNavigateSignup(); }}>Create Account</a>
                        <a href="#">Forgot Password?</a>
                    </div>

                    <div className="divider">OR</div>

                    <div className="input-group" style={{ marginBottom: 0 }}>
                        <input 
                            type="text" 
                            id="roomCode" 
                            placeholder="Enter 6-digit Room Code" 
                            maxLength="6" 
                            style={{ textAlign: 'center', letterSpacing: '2px', fontWeight: 'bold' }} 
                        />
                    </div>
                    <button type="button" className="login-btn btn-secondary" onClick={onLoginSuccess}>
                        Join as Guest
                    </button>
                </form>
            </div>
        </div>
    );
}
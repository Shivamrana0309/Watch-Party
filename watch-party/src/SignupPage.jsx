import React, { useState } from 'react';
import './LoginPage.css'; // Reusing the same CSS for consistency

export default function SignupPage({ onSignupSuccess, onNavigateLogin }) {
    const [formData, setFormData] = useState({
        name: '',
        username: '',
        emailOrMobile: '',
        password: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSignup = async (e) => {
        e.preventDefault();
        
        try {
            const response = await fetch('https://watch-party-74e5.onrender.com/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                alert("Account created successfully! Please log in.");
                onNavigateLogin();
            } else {
                const data = await response.json();
                alert(data.message || "Registration failed");
            }
        } catch (error) {
            console.error("Signup error:", error);
            alert("Server error. Make sure your backend is running.");
        }
    };

    return (
        <div className="login-page-wrapper">
            <div className="login-container">
                <div className="login-logo">
                    <h1>Create Account</h1>
                    <p>Join the watch party community.</p>
                </div>

                <form onSubmit={handleSignup}>
                    <div className="input-group">
                        <label htmlFor="name">Full Name</label>
                        <input type="text" id="name" placeholder="John Doe" required onChange={handleChange} />
                    </div>

                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input type="text" id="username" placeholder="johndoe123" required onChange={handleChange} />
                    </div>
                    
                    <div className="input-group">
                        <label htmlFor="emailOrMobile">Email or Mobile No.</label>
                        <input type="text" id="emailOrMobile" placeholder="you@example.com" required onChange={handleChange} />
                    </div>
                    
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password" placeholder="••••••••" required onChange={handleChange} />
                    </div>

                    <button type="submit" className="login-btn btn-primary">Sign Up</button>

                    <button 
                        type="button" 
                        className="login-btn btn-secondary" 
                        style={{ marginTop: '10px', display: 'flex', justifyContent: 'center', gap: '10px', alignItems: 'center' }}
                        onClick={() => alert("Google OAuth requires Google Cloud Console setup. Implement Firebase or Passport.js here.")}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Sign up with Google
                    </button>

                    <div className="links" style={{ justifyContent: 'center', marginTop: '1.5rem' }}>
                        <span style={{ color: '#94a3b8', marginRight: '5px' }}>Already have an account?</span>
                        <a href="#" onClick={(e) => { e.preventDefault(); onNavigateLogin(); }}>Log in</a>
                    </div>
                </form>
            </div>
        </div>
    );
}
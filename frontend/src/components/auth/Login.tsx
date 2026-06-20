import React, { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import api from "../../utils/api";
import qs from "qs";
import '../../styles/Register.css';
import Logo from '../common/Logo';

const Login: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await api.post("/auth/login", qs.stringify({
                username: email,
                password: password,
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            });
            navigate("/chat");
        } catch (err) {
            setError("Invalid email or password");
        } finally {
            setLoading(false);
        }
    }, [email, password, navigate]);

    return (
        <div className="auth-page-bg">
            <div className="w-full max-w-md px-4" style={{ position: 'relative' }}>
                <div className="register-card">
                    <div className="text-center">
                        <div className="register-logo">
                            <Logo size={56} />
                        </div>
                        <h1 className="register-title">Welcome Back</h1>
                        <p className="register-subtitle">Sign in to ChatNova</p>
                    </div>
                    {error ? <div className="register-error">{error}</div> : null}
                    <form onSubmit={handleSubmit} className="register-form">
                        <div>
                            <label htmlFor="email" className="register-label">Email</label>
                            <input
                                id="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="register-input"
                                placeholder="Enter your email"
                                autoComplete="email"
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="register-label">Password</label>
                            <div className="register-input-wrapper">
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="register-input"
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="register-button"
                            disabled={loading}
                        >
                            {loading ? "Signing in..." : "Log In"}
                        </button>
                    </form>
                </div>
                <div className="register-link-container">
                    Need an account? <Link to="/register" className="register-link">Sign Up</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;

import React, { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import api from "../../utils/api";
import '../../styles/Register.css';
import Logo from '../common/Logo';

const Register: React.FC = () => {
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
            await api.post("/auth/register", {
                email: email,
                password: password,
            });
            navigate("/login");
        } catch (err: any) {
            if (err.response?.status === 422) {
                const detail = err.response.data?.detail;
                if (Array.isArray(detail)) {
                    setError(detail[0]?.msg || "Invalid input");
                } else if (typeof detail === 'string') {
                    setError(detail);
                } else {
                    setError("Validation error occurred");
                }
            } else if (err.response?.data?.detail) {
                setError(err.response.data.detail);
            } else {
                setError("Failed to create an account");
            }
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
                        <h1 className="register-title">Join ChatNova</h1>
                        <p className="register-subtitle">Create your account to get started</p>
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
                                    placeholder="Create a password"
                                    autoComplete="new-password"
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
                            <p className="register-hint">
                                At least 8 characters, including uppercase, lowercase, and a digit.
                            </p>
                        </div>
                        <button
                            type="submit"
                            className="register-button"
                            disabled={loading}
                        >
                            {loading ? "Creating account..." : "Sign Up"}
                        </button>
                    </form>
                </div>
                <div className="register-link-container">
                    Already have an account? <Link to="/login" className="register-link">Log In</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;

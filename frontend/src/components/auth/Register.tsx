import React, { useState, useCallback } from "react";
import { Form, Button, Container, Row, Col } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import api from "../../utils/api";
import '../../styles/Register.css';
import Logo from '../common/Logo';

const Register: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        try {
            await api.post("/auth/register", {
                email: email,
                password: password,
            });
            navigate("/login");
        } catch (err) {
            setError("Failed to create an account");
        }
    }, [email, password, navigate]);

    return (
        <Container fluid
            className="d-flex align-items-center justify-content-center auth-page-bg"
            style={{ minHeight: "100vh" }}
        >
            <Row className="w-100">
                <Col md={{ span: 6, offset: 3 }}>
                    <div className="register-card">
                        <div className="text-center mb-6">
                            <div className="register-logo">
                                <Logo size={60} />
                            </div>
                            <h2 className="register-title">Join ChatNova</h2>
                            <p className="register-subtitle">Create your account to get started</p>
                        </div>
                        {error ? <div className="register-error">{error}</div> : null}
                        <Form onSubmit={handleSubmit} className="register-form">
                            <Form.Group id="email">
                                <Form.Label className="register-label">Email</Form.Label>
                                <Form.Control
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="register-input"
                                    placeholder="Enter your email"
                                />
                            </Form.Group>
                            <Form.Group id="password">
                                <Form.Label className="register-label">Password</Form.Label>
                                <Form.Control
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="register-input"
                                    placeholder="Create a password"
                                />
                            </Form.Group>
                            <Button type="submit" className="register-button">
                                Sign Up
                            </Button>
                        </Form>
                    </div>
                    <div className="w-100 text-center mt-2 register-link-container">
                        Already have an account? <Link to="/login" className="register-link">Log In</Link>
                    </div>
                </Col>
            </Row>
        </Container>
    );
};

export default Register;

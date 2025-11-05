 import React, { useState } from "react";
 import { Form, Button, Container, Row, Col } from "react-bootstrap";
 import { Link, useNavigate } from "react-router-dom";
import api from "../../utils/api";
import qs from "qs";
import '../../styles/Register.css';
import Logo from '../common/Logo';

const Login: React.FC = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

     const handleSubmit = async (e: React.FormEvent) => {
         e.preventDefault();
         setError("");
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
         }
     };

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
                            <h2 className="register-title">Welcome Back</h2>
                            <p className="register-subtitle">Sign in to ChatNova</p>
                        </div>
                        {error && <div className="register-error">{error}</div>}
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
                                    placeholder="Enter your password"
                                />
                            </Form.Group>
                            <Button type="submit" className="register-button">
                                Log In
                            </Button>
                        </Form>
                    </div>
                    <div className="w-100 text-center mt-2 register-link-container">
                        Need an account? <Link to="/register" className="register-link">Sign Up</Link>
                    </div>
                </Col>
            </Row>
        </Container>
    );
};

export default Login;

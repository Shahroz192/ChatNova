import React from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const Logout: React.FC = () => {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            // Call the logout endpoint to clear the cookie
            await api.post('/auth/logout');
            // After successful logout, redirect to login
            navigate('/login');
        } catch (error) {
            console.error('Logout error:', error);
            // Even if logout fails, redirect to login
            navigate('/login');
        }
    };

    return (
        <Container
            className="d-flex align-items-center justify-content-center"
            style={{ minHeight: '100vh' }}
        >
            <Row className="w-100">
                <Col md={{ span: 6, offset: 3 }}>
                    <Card>
                        <Card.Body className="text-center">
                            <h2 className="mb-4">Logout</h2>
                            <p>Are you sure you want to logout?</p>
                            <Button 
                                variant="primary" 
                                onClick={handleLogout}
                                className="me-2"
                            >
                                Yes, Logout
                            </Button>
                            <Button 
                                variant="secondary" 
                                onClick={() => navigate('/chat')}
                            >
                                Cancel
                            </Button>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default Logout;
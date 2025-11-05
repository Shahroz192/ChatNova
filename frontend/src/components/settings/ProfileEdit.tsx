import React, { useState, useEffect } from "react";
import { Container, Row, Col, Form, Button, Card, Alert } from "react-bootstrap";
import { Save } from "lucide-react";
import api from "../../utils/api";

interface User {
  id: number;
  email: string;
  is_active: boolean;
  created_at: string;
}

const ProfileEdit: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [formData, setFormData] = useState({});

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/users/me");
      setUser(response.data);
      setFormData({});
    } catch (error) {
      setError("Failed to load user profile.");
      console.error("Failed to load user", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put("/users/me", formData);
      setSuccess("Profile updated successfully!");
      loadUser(); // Reload to get updated data
    } catch (error) {
      setError("Failed to update profile.");
      console.error("Failed to update user", error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <Container fluid className="vh-100 d-flex flex-column">
      <Row className="flex-grow-1">
        <Col md={12} className="d-flex flex-column p-4">
          <h2 className="h4 font-weight-bold mb-4">Edit Profile</h2>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}
          {user && (
            <Card>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={user.email} readOnly />
                  <Form.Text className="text-muted">Email cannot be changed.</Form.Text>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Control value={user.is_active ? "Active" : "Inactive"} readOnly />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Created At</Form.Label>
                  <Form.Control value={new Date(user.created_at).toLocaleString()} readOnly />
                </Form.Group>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : <><Save size={16} /> Save Changes</>}
                </Button>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default ProfileEdit;
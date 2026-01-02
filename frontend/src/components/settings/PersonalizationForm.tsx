import React, { useState, useEffect } from "react";
import { Form, Button, Alert, Card } from "react-bootstrap";
import { Save, Sparkles } from "lucide-react";
import api from "../../utils/api";

const PersonalizationForm: React.FC = () => {
    const [instructions, setInstructions] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        fetchUserInstructions();
    }, []);

    const fetchUserInstructions = async () => {
        try {
            const response = await api.get("/users/me");
            setInstructions(response.data.custom_instructions || "");
        } catch (err) {
            console.error("Failed to fetch user instructions", err);
            setError("Failed to load your instructions.");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        setMessage("");

        try {
            await api.patch("/users/me/instructions", {
                custom_instructions: instructions,
            });
            setMessage("Custom instructions updated successfully!");
        } catch (err: any) {
            console.error("Failed to update instructions", err);
            setError(err.response?.data?.detail || "Failed to update instructions.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center p-4">Loading preferences...</div>;

    return (
        <div className="personalization-form">
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2 flex align-items-center gap-2">
                    <Sparkles size={20} className="text-primary" />
                    Personalization
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    What would you like the AI to know about you to provide better responses? 
                    These instructions will be applied to every new chat.
                </p>
            </div>

            {message && <Alert variant="success" className="mb-4">{message}</Alert>}
            {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

            <Form onSubmit={handleSave}>
                <Form.Group className="mb-4">
                    <Form.Label className="fw-medium">Custom Instructions</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={10}
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="Example: I am a senior software engineer. Please be concise and focus on code quality. Always provide examples in Python."
                        className="font-sans"
                        style={{ resize: 'vertical', minHeight: '200px' }}
                    />
                    <Form.Text className="text-muted">
                        These instructions are sent to the AI alongside every message you send.
                    </Form.Text>
                </Form.Group>

                <div className="d-flex justify-content-end">
                    <Button 
                        type="submit" 
                        variant="primary" 
                        disabled={saving}
                        className="d-flex align-items-center gap-2"
                    >
                        {saving ? "Saving..." : <><Save size={18} /> Save Instructions</>}
                    </Button>
                </div>
            </Form>
        </div>
    );
};

export default PersonalizationForm;

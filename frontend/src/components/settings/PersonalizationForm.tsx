import React, { useState, useEffect } from "react";
import { FloppyDisk } from "@phosphor-icons/react";
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

    if (loading) return <div className="settings-hint">Loading preferences...</div>;

    return (
        <div>
            {message && <div className="settings-alert settings-alert-success" style={{ marginBottom: 16 }}>{message}</div>}
            {error && <div className="settings-alert settings-alert-error" style={{ marginBottom: 16 }}>{error}</div>}

            <form onSubmit={handleSave}>
                <div style={{ marginBottom: 16 }}>
                    <label className="settings-label" style={{ marginBottom: 8 }}>
                        Custom Instructions
                    </label>
                    <textarea
                        rows={10}
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        placeholder="Example: I am a senior software engineer. Please be concise and focus on code quality. Always provide examples in Python."
                        className="settings-textarea"
                    />
                    <p className="settings-hint">
                        These instructions are sent to the AI alongside every message you send.
                    </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="submit"
                        disabled={saving}
                        className="settings-btn settings-btn-primary"
                    >
                        {saving ? "Saving..." : <><FloppyDisk size={16} /> Save Instructions</>}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default PersonalizationForm;

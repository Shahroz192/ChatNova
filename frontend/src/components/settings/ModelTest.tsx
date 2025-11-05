import React, { useState } from "react";
import { Container, Row, Col, Form, Button, ListGroup, Alert } from "react-bootstrap";
import { Play } from "lucide-react";
import api from "../../utils/api";

const ModelTest: React.FC = () => {
  const [testInput, setTestInput] = useState("Hello, how are you?");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState("");

  const handleTest = async () => {
    if (!testInput.trim()) {
      setError("Please enter a test input.");
      return;
    }
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const response = await api.post(`/chat/models/test?test_input=${encodeURIComponent(testInput)}`);
      setResults(response.data);
    } catch (error) {
      setError("Failed to test models. Please try again.");
      console.error("Failed to test models", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container fluid className="vh-100 d-flex flex-column">
      <Row className="flex-grow-1">
        <Col md={12} className="d-flex flex-column p-4">
          <h2 className="h4 font-weight-bold mb-4">Test AI Models</h2>
          <div className="mb-4">
            <Form.Group>
              <Form.Label>Test Input</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                placeholder="Enter a test message to send to all models..."
              />
            </Form.Group>
            <Button onClick={handleTest} disabled={loading} className="mt-3">
              {loading ? "Testing..." : <><Play size={16} /> Test All Models</>}
            </Button>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
          {results && (
            <div>
              <h4>Results</h4>
              <p><strong>Input:</strong> {results.input}</p>
              <p><strong>Total Models:</strong> {results.total_models}</p>
              <ListGroup>
                {Object.entries(results.results).map(([model, result]: [string, any]) => (
                  <ListGroup.Item key={model}>
                    <strong>{model}:</strong>
                    {result.status === "success" ? (
                      <div>
                        <p><strong>Response:</strong> {result.response}</p>
                      </div>
                    ) : (
                      <p className="text-danger"><strong>Error:</strong> {result.error}</p>
                    )}
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
};

export default ModelTest;
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useToast } from "../contexts/ToastContext";

export const useChatSessions = (_initialSessionIdFromUrl: string | null) => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [sessionsSkip, setSessionsSkip] = useState(0);
  const [hasMoreSessions, setHasMoreSessions] = useState(true);
  const [sessionsSearch, setSessionsSearch] = useState("");
  const SESSIONS_LIMIT = 20;

  const navigate = useNavigate();
  const { error: showError, success: showSuccess } = useToast();

  const fetchSessions = useCallback(
    async (isLoadMore = false, searchTerm = sessionsSearch) => {
      setIsLoadingSessions(true);
      try {
        const skip = isLoadMore ? sessionsSkip + SESSIONS_LIMIT : 0;
        const params = new URLSearchParams({
          skip: skip.toString(),
          limit: SESSIONS_LIMIT.toString(),
          newest_first: "true",
        });
        if (searchTerm) params.append("search", searchTerm);

        const response = await api.get(`/sessions?${params}`);
        const newSessions = response.data.data;
        const meta = response.data.meta;

        setSessions((prev) =>
          isLoadMore ? [...prev, ...newSessions] : newSessions,
        );
        setSessionsSkip(skip);
        setHasMoreSessions(meta.has_more);
      } catch (error) {
        console.error("Failed to fetch sessions", error);
      } finally {
        setIsLoadingSessions(false);
      }
    },
    [sessionsSkip, sessionsSearch],
  );

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleSearchSessions = useCallback(
    (query: string) => {
      setSessionsSearch(query);
      fetchSessions(false, query);
    },
    [fetchSessions],
  );

  const handleLoadMoreSessions = useCallback(() => {
    if (!isLoadingSessions && hasMoreSessions) {
      fetchSessions(true);
    }
  }, [fetchSessions, isLoadingSessions, hasMoreSessions]);

  const createSession = useCallback(
    async (title: string = "New Chat") => {
      try {
        const response = await api.post("/sessions", {
          title,
          description: "",
        });
        const newSessionId = response.data.id;
        setCurrentSessionId(newSessionId);
        navigate(`/chat?session=${newSessionId}`, { replace: true });
        await fetchSessions();
        return newSessionId;
      } catch (error) {
        showError("Session Error", "Failed to create session.");
        console.error("Failed to create session", error);
        throw error;
      }
    },
    [navigate, showError, fetchSessions],
  );

  const deleteSession = useCallback(
    async (sessionId: number, clearMessages: () => void) => {
      try {
        await api.delete(`/sessions/${sessionId}`);
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (currentSessionId === sessionId) {
          setCurrentSessionId(null);
          clearMessages();
          navigate("/chat", { replace: true });
        }
        showSuccess("Deleted", "Session deleted successfully");
      } catch (error) {
        showError("Delete Error", "Failed to delete session");
      }
    },
    [currentSessionId, navigate, showSuccess, showError],
  );

  return {
    sessions,
    currentSessionId,
    setCurrentSessionId,
    isLoadingSessions,
    hasMoreSessions,
    sessionsSearch,
    fetchSessions,
    handleSearchSessions,
    handleLoadMoreSessions,
    createSession,
    deleteSession,
  };
};

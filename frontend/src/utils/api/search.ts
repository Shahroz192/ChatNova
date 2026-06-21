import api from "../api";
import type { SearchHistoryItem } from "../../types/search";

export const getSearchHistory = async (): Promise<SearchHistoryItem[]> => {
  const response = await api.get("/search/");
  return response.data.map((item: any) => ({
    id: item.id.toString(),
    query: item.query,
    timestamp: item.created_at,
    results_count: 0,
    search_type: item.search_type,
    web_search_enabled: true,
  }));
};

export const addToSearchHistory = async (
  query: string,
  searchType: string = "general",
) => {
  const response = await api.post("/search/", { query, search_type: searchType });
  return response.data;
};

export const clearSearchHistory = async () => {
  const response = await api.delete("/search/");
  return response.data;
};

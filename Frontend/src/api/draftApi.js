import axios from 'axios';

// Upewnij się, że jest http (nie https) i 127.0.0.1
const API_URL = "http://127.0.0.1:8000"; 

export const analyzeDraft = async (draftState) => {
  try {
    // ... reszta kodu bez zmian
    const response = await axios.post(`${API_URL}/analyze`, draftState);
    return response.data;
  } catch (error) {
    console.error("Błąd:", error);
    return { blue_win_probability: 50, red_win_probability: 50, recommended_picks: [] };
  }
};
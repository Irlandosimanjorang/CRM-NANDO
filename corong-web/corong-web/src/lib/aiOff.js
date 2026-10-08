import { createContext, useContext } from "react";

// Owner pemantau (saklar owner_monitor, 9 Okt 2026): fitur AI yang dipakai sendiri disembunyikan
// (draft AI, NEX Pro, rekomendasi, ringkasan kebutuhan, tebak alasan, lead dari link, Smart Import AI).
// Penjagaan sebenarnya ada di server (reserve_edge_function_call); ini hanya merapikan tampilan.
export const AiOffContext = createContext(false);
export const useAiOff = () => useContext(AiOffContext);

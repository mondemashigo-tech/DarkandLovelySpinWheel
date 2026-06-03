import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_URL } from '../config';

const STORAGE_KEY = 'r300_api_url';

const ApiUrlContext = createContext({ apiUrl: DEFAULT_API_URL, updateApiUrl: async () => {} });

export function ApiUrlProvider({ children }) {
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => { if (saved) setApiUrl(saved); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const updateApiUrl = async (url) => {
    const clean = url.trim().replace(/\/$/, '');
    setApiUrl(clean);
    await AsyncStorage.setItem(STORAGE_KEY, clean).catch(() => {});
  };

  if (!ready) return null;

  return (
    <ApiUrlContext.Provider value={{ apiUrl, updateApiUrl }}>
      {children}
    </ApiUrlContext.Provider>
  );
}

export function useApiUrl() {
  return useContext(ApiUrlContext);
}

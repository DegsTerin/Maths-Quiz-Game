export function readStoredPreference(storageProvider, key, allowedValues, fallback) {
  try {
    const value = storageProvider().getItem(key);
    return allowedValues.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

export function storePreference(storageProvider, key, value) {
  try {
    storageProvider().setItem(key, value);
  } catch {
    // The preference still applies for this session when storage is unavailable.
  }
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/proxy/8000').replace(/\/$/, '');

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      ...options,
    });

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      throw new Error(typeof data === 'string' ? data : data.detail || 'Request failed');
    }

    return data;
  } catch (error) {
    // If configured endpoint fails, try direct connection to FastAPI on localhost:8000
    if (!API_BASE_URL.includes(':8000')) {
      try {
        const directUrl = `http://localhost:8000${path}`;
        const directResponse = await fetch(directUrl, {
          headers: {
            ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
            ...options.headers,
          },
          ...options,
        });

        const ct = directResponse.headers.get('content-type') || '';
        const data = ct.includes('application/json') ? await directResponse.json() : await directResponse.text();

        if (directResponse.ok) {
          return data;
        }
      } catch {
        // Fall back to original error
      }
    }

    if (error instanceof Error) {
      throw new Error(`Failed to connect to backend at ${url}: ${error.message}`);
    }
    throw new Error(`Failed to connect to backend at ${url}`);
  }
}

export async function healthCheck() {
  try {
    return await request('/');
  } catch {
    return request('/testing/health');
  }
}

export async function loadSampleAnalytics(aircraftId = null) {
  const query = aircraftId ? `?aircraft_id=${encodeURIComponent(aircraftId)}` : '';
  return request(`/aircraft/sample${query}`);
}

export async function uploadAnalyticsFile(file) {
  const formData = new FormData();
  formData.append('excel_file', file);

  return request('/aircraft/analytics', {
    method: 'POST',
    body: formData,
  });
}

export async function uploadManualFile(file) {
  const formData = new FormData();
  formData.append('manual_file', file);

  return request('/aircraft/upload-manual', {
    method: 'POST',
    body: formData,
  });
}

export async function getMaintenanceRecommendation(analyticsPayload, manualFilename = null) {
  const body = manualFilename
    ? { ...analyticsPayload, manual_filename: manualFilename }
    : analyticsPayload;

  return request('/aircraft/maintenance-prediction', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

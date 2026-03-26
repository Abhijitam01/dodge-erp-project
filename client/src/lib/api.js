import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

const http = axios.create({ baseURL: BASE_URL });

export async function fetchGraph(types = []) {
  const params = types.length ? { types: types.join(',') } : {};
  const { data } = await http.get('/api/graph', { params });
  return data;
}

export async function fetchNode(id) {
  const { data } = await http.get(`/api/nodes/${encodeURIComponent(id)}`);
  return data;
}

export async function sendChat(message) {
  const { data } = await http.post('/api/chat', { message });
  return data;
}

export async function fetchStats() {
  const { data } = await http.get('/api/stats');
  return data;
}

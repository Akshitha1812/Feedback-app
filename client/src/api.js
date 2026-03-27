import axios from 'axios';

// University WiFi networks frequently block client-to-client HTTP connections on 10.x IPs.
// For local testing on this network, we must use localhost directly.
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  // Use relative path for production (Vercel) so it works on any domain
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return '/api';
  }
  return `http://localhost:5001/api`;
};

const api = axios.create({
  baseURL: getApiUrl(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth
export const login = (username, password) => api.post('/auth/login', { username, password });
export const register = (username, password) => api.post('/auth/register', { username, password });
export const getMe = () => api.get('/auth/me');

// Courses
export const getCourses = () => api.get('/courses');
export const createCourse = (name) => api.post('/courses', { name });

// Session Management
export const createSession = (question, question_type, options, course_id) => api.post('/sessions', { question, question_type, options, course_id });
export const getAllSessions = (courseId) => api.get('/sessions', { params: { courseId } });
export const getSession = (sessionId) => api.get(`/sessions/${sessionId}`);
export const getSessionHistory = (sessionId) => api.get(`/sessions/${sessionId}/history`);
export const deleteSession = (sessionId) => api.delete(`/sessions/${sessionId}`);

// Answers
export const submitAnswer = (sessionId, text, studentName = null) =>
  api.post(`/sessions/${sessionId}/answers`, { text, studentName });
export const submitBulkAnswers = (sessionId, answers) =>
  api.post(`/sessions/${sessionId}/answers/bulk`, { answers });
export const getAnswers = (sessionId) => api.get(`/sessions/${sessionId}/answers`);

// AI Assistant
export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};

export const generateAiQuiz = (contextText, constraints, types, count = 3, difficulty = 'medium', focus = 'concept_understanding') =>
  api.post('/ai/generate', { contextText, constraints, types, count, difficulty, focus });

export const runAnalysis = (sessionId, config) =>
  api.post(`/sessions/${sessionId}/analyze`, config);

export const getNetworkIps = () => api.get('/network');

export default api;

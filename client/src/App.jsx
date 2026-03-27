import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import SubmitAnswer from './pages/SubmitAnswer';
import PresentationView from './pages/PresentationView';
import Login from './pages/Login';
import Register from './pages/Register';
import { getMe } from './api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      getMe().then(() => setIsAuthenticated(true)).catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setIsAuthenticated(false);
      });
    }
  }, []);

  const ProtectedRoute = ({ children }) => {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <div className="app-container">
      <Header isAuthenticated={isAuthenticated} setAuth={setIsAuthenticated} />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={!isAuthenticated ? <Login setAuth={setIsAuthenticated} /> : <Navigate to="/dashboard" replace />} />
          <Route path="/register" element={!isAuthenticated ? <Register setAuth={setIsAuthenticated} /> : <Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/submit/:sessionId" element={<SubmitAnswer />} />
          <Route path="/presentation/:sessionId/:historyId" element={<PresentationView />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

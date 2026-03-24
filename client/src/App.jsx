import { Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Dashboard from './pages/Dashboard';
import SubmitAnswer from './pages/SubmitAnswer';
import PresentationView from './pages/PresentationView';

function App() {
  return (
    <div className="app-container">
      <Header />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/submit/:sessionId" element={<SubmitAnswer />} />
          <Route path="/presentation/:sessionId/:historyId" element={<PresentationView />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;

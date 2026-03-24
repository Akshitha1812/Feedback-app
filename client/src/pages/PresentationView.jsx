import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSessionHistory } from '../api';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';

export default function PresentationView() {
  const { sessionId, historyId } = useParams();
  const navigate = useNavigate();
  const [synthesis, setSynthesis] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Add high-contrast mode class to body for better projection visibility
    document.body.classList.add('high-contrast-mode');
    
    // Fetch the specific history record
    const fetchHistory = async () => {
      try {
        const res = await getSessionHistory(sessionId);
        const record = res.data.find(r => r.id.toString() === historyId);
        if (record) {
          setSynthesis(record);
        } else {
          setError("Analysis record not found.");
        }
      } catch (err) {
        setError("Failed to load presentation.");
      }
    };
    
    fetchHistory();

    return () => {
      document.body.classList.remove('high-contrast-mode');
    };
  }, [sessionId, historyId]);

  if (error) {
     return <div style={{ color: 'var(--danger)', padding: '2rem', textAlign: 'center' }}>{error}</div>;
  }

  if (!synthesis) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h2 className="text-gradient animate-fade-in">Loading Presentation...</h2>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ padding: '2rem 4rem', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
         <h1 style={{ margin: 0, fontSize: '2rem' }}>
           <span className="text-gradient">Classroom Insights</span>
         </h1>
         <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
           <ArrowLeft size={16} /> Exit Presentation
         </button>
      </div>

      <div className="markdown-content" style={{ 
        flex: 1, 
        background: 'rgba(255,255,255,0.02)', 
        border: '1px solid var(--border-color)', 
        borderRadius: 'var(--radius-lg)', 
        padding: '3rem 4rem',
        overflowY: 'auto',
        fontSize: '1.25rem', // Larger base font for projection
        lineHeight: 1.8
      }}>
        <div style={{ paddingBottom: '1rem', marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
           <div style={{ color: 'var(--text-muted)' }}>Synethsis Report</div>
           <div style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>Based on {synthesis.answer_count} responses</div>
        </div>
        <ReactMarkdown>{synthesis.markdown_synthesis}</ReactMarkdown>
      </div>
    </div>
  );
}

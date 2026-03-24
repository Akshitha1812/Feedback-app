import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { submitAnswer, getSession } from '../api';
import { CheckCircle2, Loader2 } from 'lucide-react';

export default function SubmitAnswer() {
  const { sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [answer, setAnswer] = useState('');
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await getSession(sessionId);
        setSession(res.data);
      } catch (error) {
        console.error("Failed to load session details");
      } finally {
        setIsLoading(false);
      }
    }
    loadSession();
  }, [sessionId]);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    let finalPayload = answer;

    if (session.question_type === 'multi_question') {
      if (Object.keys(answers).length !== session.options.length) {
        alert("Please answer all questions before submitting.");
        return;
      }
      finalPayload = JSON.stringify(answers);
    } else if (!answer.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await submitAnswer(sessionId, finalPayload);
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      alert("Failed to submit answer. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-muted)' }}>
        <Loader2 className="animate-spin" size={48} />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
        <CheckCircle2 size={64} style={{ color: 'var(--success)', margin: '0 auto 1.5rem' }} />
        <h2 className="text-gradient" style={{ fontSize: '2rem' }}>Response Received!</h2>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>Your feedback has been anonymously submitted to the dashboard.</p>
        <button className="btn btn-secondary" onClick={() => { setSubmitted(false); setAnswer(''); setAnswers({}); }}>
          Submit another response
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--danger)' }}>Session Not Found</h2>
        <p className="text-muted">The link you followed may be invalid or the session has ended.</p>
      </div>
    );
  }

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: '600px', margin: '4rem auto' }}>
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{session.question}</h2>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>Anonymous Submission</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {session.question_type === 'multi_question' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {session.options.map((q, qKey) => (
              <div key={qKey} className="glass-panel" style={{ padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--sjsu-blue)' }}>{qKey + 1}. {q.question}</h3>
                {q.type === 'open_ended' ? (
                  <textarea
                    className="textarea-field"
                    placeholder="Type your answer here..."
                    value={answers[qKey] || ''}
                    onChange={(e) => setAnswers({ ...answers, [qKey]: e.target.value })}
                    required
                    style={{ minHeight: '80px', fontSize: '0.95rem' }}
                  />
                ) : (
                  <div className="radio-group" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    {q.options && q.options.map((opt, idx) => (
                      <label key={idx} className="radio-option" style={{ padding: '0.75rem', border: answers[qKey] === opt ? '2px solid var(--sjsu-blue)' : '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', background: answers[qKey] === opt ? 'rgba(0, 85, 162, 0.05)' : 'var(--secondary-bg)', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <input
                          type="radio"
                          name={`q_${qKey}`}
                          value={opt}
                          checked={answers[qKey] === opt}
                          onChange={(e) => setAnswers({ ...answers, [qKey]: e.target.value })}
                          style={{ marginRight: '0.5rem', accentColor: 'var(--sjsu-blue)' }}
                        />
                        <span style={{ fontSize: '0.95rem' }}>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : session.question_type === 'open_ended' ? (
          <textarea
            className="textarea-field"
            placeholder="Type your answer here..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            required
            autoFocus
            style={{ minHeight: '160px' }}
          />
        ) : (
          <div className="radio-group">
            {session.options && session.options.map((opt, idx) => (
              <label key={idx} className="radio-option glass-panel" style={{ padding: '1rem', border: answer === opt ? '2px solid var(--accent-blue)' : '1px solid var(--border-color)' }}>
                <input
                  type="radio"
                  name="poll"
                  value={opt}
                  checked={answer === opt}
                  onChange={(e) => setAnswer(e.target.value)}
                  style={{ width: '20px', height: '20px' }}
                />
                <span style={{ fontSize: '1.1rem' }}>{opt}</span>
              </label>
            ))}
          </div>
        )}
        <button type="submit" className="btn btn-primary" style={{ padding: '1rem', width: '100%', fontSize: '1rem', fontWeight: 'bold' }}>
          {isSubmitting ? "Submitting..." : "Submit Answers"}
        </button>
      </form>
    </div>
  );
}

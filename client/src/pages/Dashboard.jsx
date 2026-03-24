import { useState, useEffect, useRef } from 'react';
import {
  createSession,
  getAllSessions,
  getSessionHistory,
  deleteSession,
  runAnalysis,
  getAnswers,
  uploadFile,
  generateAiQuiz,
  submitBulkAnswers,
  getNetworkIps
} from '../api';
import {
  Play,
  ClipboardPaste,
  ArrowRight,
  History,
  Download,
  Maximize,
  LayoutDashboard,
  Plus,
  Search,
  FileText,
  Settings,
  MessageSquare,
  Upload,
  ChevronRight,
  FilePlus,
  CheckCircle2,
  AlertCircle,
  Trash2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';

import React from 'react';

class SafeMarkdown extends React.Component {
  render() {
    const text = this.props.children || "";
    // Extremely safe regex markdown parser to avoid any ReactMarkdown crashes
    const htmlLines = text.split('\n').map(line => {
      let parsed = line
        .replace(/^## (.*$)/gim, '<h2 style="color: var(--sjsu-blue); margin-top: 1.5rem; margin-bottom: 0.5rem; border-bottom: 2px solid var(--border-color);">$1</h2>')
        .replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--sjsu-blue);">$1</strong>')
        .replace(/^\* (.*$)/gim, '<li style="margin-bottom: 0.5rem; margin-left: 1.5rem;">$1</li>');
      return parsed;
    });

    const finalHtml = htmlLines.join('<br/>').replace(/(<br\/>)+<h2/g, '<h2').replace(/(<br\/>)+<li/g, '<li');

    return (
      <div
        className={this.props.className}
        style={{ lineHeight: '1.6', color: '#334155' }}
        dangerouslySetInnerHTML={{ __html: finalHtml }}
      />
    );
  }
}

function NetworkQrCode({ sessionId, initialUrl }) {
  const [ips, setIps] = useState([]);
  const [selectedIp, setSelectedIp] = useState('');
  const isProduction = typeof window !== 'undefined' && (window.location.hostname.includes('vercel.app') || !window.location.hostname.includes('localhost'));

  useEffect(() => {
    if (isProduction) return; // Don't fetch local IPs in production

    const browserIp = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    getNetworkIps()
      .then(res => {
        const data = res.data;
        setIps(data);

        let best = data[0]?.ip || 'localhost';
        if (data.find(d => d.ip === browserIp)) {
          best = browserIp;
        } else {
          const hotspot = data.find(d => d.ip.startsWith('192.168.'));
          if (hotspot) best = hotspot.ip;
        }

        if (browserIp !== 'localhost') {
          best = browserIp;
        }

        setSelectedIp(best);
      })
      .catch(() => {
        setSelectedIp(browserIp);
      });
  }, [isProduction]);

  // In production, always use the initialUrl (which is the Vercel domain)
  // In dev, use the selected local IP
  const qrUrl = isProduction
    ? initialUrl
    : (selectedIp === 'localhost' ? initialUrl : `http://${selectedIp}:5173/submit/${sessionId}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '1rem', background: '#fff', borderRadius: '1rem' }}>
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrUrl)}`}
          alt="QR Code"
          style={{ display: 'block', width: '200px', height: '200px' }}
        />
      </div>

      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem', fontWeight: 'bold' }}>SCAN OR VISIT:</p>
        <a
          href={qrUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: '0.85rem', color: 'var(--sjsu-blue)', textDecoration: 'underline', wordBreak: 'break-all' }}
        >
          {qrUrl.replace('https://', '')}
        </a>
      </div>

      {!isProduction && ips.length > 0 && (
        <select
          className="input-field"
          style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.8 }}
          value={selectedIp}
          onChange={(e) => setSelectedIp(e.target.value)}
          title="Select the network IP for student access (Local Dev Only)"
        >
          {ips.map(ip => (
            <option key={ip.ip} value={ip.ip}>{ip.name}: {ip.ip}</option>
          ))}
        </select>
      )}
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Navigation & session state
  const [activeTab, setActiveTab] = useState('create');
  const [sessions, setSessions] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const sessionsPerPage = 5;
  const [currentSession, setCurrentSession] = useState(null);
  const [answersCount, setAnswersCount] = useState(0);
  const [historyLog, setHistoryLog] = useState([]);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);

  // Creation state
  const [question, setQuestion] = useState('');
  const [questionType, setQuestionType] = useState('open_ended');
  const [optionsText, setOptionsText] = useState('');

  // AI assistant state
  const [pdfText, setPdfText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [aiConstraints, setAiConstraints] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiQuestionTypes, setAiQuestionTypes] = useState(['multiple_choice', 'true_false']);
  const [aiQuestionCount, setAiQuestionCount] = useState(3);
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [aiFocus, setAiFocus] = useState('concept_understanding');
  const [bulkInput, setBulkInput] = useState('');

  // Sidebar config
  const [sidebarTab, setSidebarTab] = useState('design'); // 'design' or 'analysis'
  const [includeNames, setIncludeNames] = useState(false);
  const [summaryMode, setSummaryMode] = useState('three_main_ideas');
  const [identifyTraits, setIdentifyTraits] = useState('most_interesting');
  const [includeExplanations, setIncludeExplanations] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentSynthesis, setCurrentSynthesis] = useState(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    let interval;
    if (currentSession) {
      // Fetch immediately so it doesn't show 0 for 5 seconds
      const fetchLiveAnswers = async () => {
        try {
          const res = await getAnswers(currentSession.sessionId);
          setAnswersCount(res.data.length);
        } catch (error) {
          console.error("Failed fetching live answers");
        }
      };
      fetchLiveAnswers();

      interval = setInterval(fetchLiveAnswers, 5000);
      setSidebarTab('analysis');
    } else {
      setSidebarTab('design');
    }
    return () => clearInterval(interval);
  }, [currentSession]);

  const fetchSessions = async () => {
    try {
      const res = await getAllSessions();
      setSessions(res.data);
    } catch (error) {
      console.error("Failed to load sessions");
    }
  };

  const handleStartSession = async (e) => {
    if (e) e.preventDefault();
    if (!question.trim()) return;
    try {
      const optionsArray = (questionType === 'multiple_choice' || questionType === 'true_false')
        ? optionsText.split('\n').map(o => o.trim()).filter(o => o)
        : [];
      const res = await createSession(question, questionType, optionsArray);
      setCurrentSession(res.data);
      fetchSessions();
      setHistoryLog([]);
      setCurrentSynthesis(null);
      setAnswersCount(0);
    } catch (error) {
      console.error(error);
      alert('Failed to start session.');
    }
  };

  const handleStartMultiSession = async () => {
    if (generatedQuestions.length === 0) return;
    try {
      const title = `AI Generated Quiz (${generatedQuestions.length} Questions)`;
      // passing generatedQuestions directly acts as the options payload
      const res = await createSession(title, "multi_question", generatedQuestions);
      setCurrentSession(res.data);
      fetchSessions();
      setHistoryLog([]);
      setCurrentSynthesis(null);
      setAnswersCount(0);
    } catch (error) {
      console.error(error);
      alert('Failed to start multi-question session.');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await uploadFile(file);
      setPdfText(res.data.text);
      setShowAiAssistant(true);
    } catch (error) {
      console.error("PDF Upload Error:", error);
      const msg = error.response?.data?.details || error.message;
      alert(`Failed to process PDF: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const toggleAiQuestionType = (type) => {
    setAiQuestionTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleAiGenerate = async () => {
    if (!pdfText) {
      alert("Please upload a PDF first.");
      return;
    }
    if (aiQuestionTypes.length === 0) {
      alert("Please select at least one question type.");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await generateAiQuiz(pdfText, aiConstraints, aiQuestionTypes, aiQuestionCount, aiDifficulty, aiFocus);
      if (res.data.questions && res.data.questions.length > 0) {
        setGeneratedQuestions(res.data.questions);

        // Auto-select the first one
        const first = res.data.questions[0];
        setQuestion(first.question);
        setQuestionType(first.type);
        setOptionsText(first.options ? first.options.join('\n') : '');
      }
    } catch (error) {
      alert("AI Quiz generation failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRunAnalysis = async () => {
    if (!currentSession) return;
    setIsAnalyzing(true);
    try {
      const res = await runAnalysis(currentSession.sessionId, {
        includeExplanations,
        summaryMode,
        identifyTraits
      });
      setCurrentSynthesis(res.data.markdown_synthesis);
      const histRes = await getSessionHistory(currentSession.sessionId);
      setHistoryLog(histRes.data);
    } catch (error) {
      console.error(error);
      const msg = error.response?.data?.details || error.response?.data?.error || error.message;
      alert(`Analysis failed: ${msg}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="three-pane-container animate-fade-in">
      {/* 1. Nav Sidebar */}
      <div className="nav-sidebar">
        <div className={`nav-item ${activeTab === 'create' ? 'active' : ''}`} title="Create" onClick={() => { setActiveTab('create'); setCurrentSession(null); }}>
          <Plus size={24} />
        </div>
        <div className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} title="History" onClick={() => { setActiveTab('history'); setCurrentSession(null); }}>
          <History size={24} />
        </div>
      </div>

      {/* 2. Main Area */}
      <div className="main-area">
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
          <button className="btn btn-secondary" onClick={() => { setCurrentSession(null); setQuestion(''); setOptionsText(''); setQuestionType('open_ended'); setGeneratedQuestions([]); setCurrentSynthesis(null); setHistoryLog([]); setActiveTab('create'); setSidebarTab('design'); }}>
            <Plus size={18} /> New Session
          </button>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()} disabled={isUploading}>
            <Upload size={18} /> {isUploading ? "Uploading..." : "Import PDF Context"}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            accept="application/pdf"
          />
        </div>

        {!currentSession ? (
          <div>
            <h2 className="text-gradient">{activeTab === 'history' ? 'Session History' : 'Quick Library'}</h2>
            <div style={{ marginTop: '1rem' }} className="glass-panel">
              {sessions.length === 0 ? (
                <p className="text-muted">No sessions yet. Upload a PDF or type a question to start.</p>
              ) : (
                <>
                  {sessions.slice((currentPage - 1) * sessionsPerPage, currentPage * sessionsPerPage).map(s => (
                    <div key={s.id} className="question-list-item" onClick={() => {
                      setCurrentSession({ sessionId: s.id, question: s.question, submitUrl: `${window.location.origin}/submit/${s.id}` });
                      setCurrentSynthesis(null);
                      setHistoryLog([]);
                      setAnswersCount(0);

                      // Auto-load past synthesis
                      getSessionHistory(s.id).then(res => {
                        if (res.data && res.data.length > 0) {
                          setCurrentSynthesis(res.data[0].markdown_synthesis);
                          setHistoryLog(res.data);
                        }
                      }).catch(e => console.error(e));

                      setActiveTab('create');
                    }}>
                      <FileText size={20} className="text-muted" />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600' }}>{s.question}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{s.question_type.replace('_', ' ')} • {new Date(s.created_at).toLocaleDateString()}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem', color: 'var(--text-muted)' }}
                          title="Delete Session"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (window.confirm("Are you sure you want to delete this session and all its answers?")) {
                              try {
                                await deleteSession(s.id);
                                setSessions(prev => prev.filter(session => session.id !== s.id));
                                if (currentSession && currentSession.sessionId === s.id) {
                                  setCurrentSession(null);
                                  setCurrentSynthesis(null);
                                  setHistoryLog([]);
                                  setAnswersCount(0);
                                }
                              } catch (err) {
                                alert("Failed to delete session.");
                              }
                            }
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <ChevronRight size={18} className="text-muted" />
                      </div>
                    </div>
                  ))}
                  {sessions.length > sessionsPerPage && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0 0.5rem' }}>
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}>Previous</button>
                      <span className="text-muted" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Page {currentPage} of {Math.ceil(sessions.length / sessionsPerPage)}</span>
                      <button className="btn btn-secondary" style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }} disabled={currentPage === Math.ceil(sessions.length / sessionsPerPage)} onClick={() => setCurrentPage(prev => prev + 1)}>Next</button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="analysis-view">
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem' }}>
              <h1 className="text-gradient" style={{ fontSize: '2rem', marginBottom: '1rem' }}>{currentSession.question}</h1>
              <div style={{ display: 'flex', gap: '2rem' }}>
                <div style={{ flex: 1 }}>
                  <p className="text-muted" style={{ marginBottom: '1rem' }}>Live analysis of student feedback and responses.</p>
                  <div className="glass-panel" style={{ minHeight: '400px', overflowY: 'auto' }}>
                    {isAnalyzing ? (
                      <div style={{ textAlign: 'center', paddingTop: '6rem' }}>
                        <div className="spinner" style={{ margin: '0 auto 1.5rem' }}></div>
                        <p className="text-gradient">Gemini is synthesizing insights...</p>
                      </div>
                    ) : currentSynthesis ? (
                      <SafeMarkdown className="markdown-content">{currentSynthesis}</SafeMarkdown>
                    ) : (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', paddingTop: '6rem' }}>
                        <LayoutDashboard size={48} style={{ opacity: 0.1, marginBottom: '1rem' }} />
                        <p>Configure analysis in the sidebar to reveal insights.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Quiz Designer & Analysis Sidebar */}
      <div className="config-sidebar">
        <div className="sidebar-tabs">
          <div className={`sidebar-tab ${sidebarTab === 'design' ? 'active' : ''}`} onClick={() => setSidebarTab('design')}>
            Quiz Designer
          </div>
          <div className={`sidebar-tab ${sidebarTab === 'analysis' ? 'active' : ''}`} onClick={() => setSidebarTab('analysis')}>
            Live Analysis
          </div>
        </div>

        {sidebarTab === 'design' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="ai-toggle" onClick={() => setShowAiAssistant(!showAiAssistant)}>
              <div className="ai-badge">AI</div>
              <div style={{ flex: 1, fontWeight: 'bold' }}>AI Quiz Assistant</div>
              <ChevronRight size={18} style={{ transform: showAiAssistant ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>

            {showAiAssistant && (
              <div className="glass-panel" style={{ padding: '1rem', borderStyle: 'dashed' }}>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>Context: {pdfText ? "✓ Document Extracted" : "× No document uploaded"}</p>

                <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Question Types</label>
                <div className="checkbox-group">
                  <label className="checkbox-option">
                    <input type="checkbox" checked={aiQuestionTypes.includes('multiple_choice')} onChange={() => toggleAiQuestionType('multiple_choice')} />
                    MCQ
                  </label>
                  <label className="checkbox-option">
                    <input type="checkbox" checked={aiQuestionTypes.includes('true_false')} onChange={() => toggleAiQuestionType('true_false')} />
                    T/F
                  </label>
                  <label className="checkbox-option">
                    <input type="checkbox" checked={aiQuestionTypes.includes('open_ended')} onChange={() => toggleAiQuestionType('open_ended')} />
                    Fill-in
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Count</label>
                    <input type="number" min="1" max="20" className="input-field" style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem' }} value={aiQuestionCount} onChange={e => setAiQuestionCount(parseInt(e.target.value) || 3)} />
                  </div>
                  <div style={{ flex: 2 }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Difficulty</label>
                    <select className="input-field" style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem' }} value={aiDifficulty} onChange={e => setAiDifficulty(e.target.value)}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginTop: '0.5rem' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>Test Focus</label>
                  <select className="input-field" style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem' }} value={aiFocus} onChange={e => setAiFocus(e.target.value)}>
                    <option value="concept_understanding">Concept Understanding</option>
                    <option value="memory_recall">Memory/Fact Recall</option>
                    <option value="application">Real-world Application</option>
                  </select>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Generation Focus</label>
                  <textarea
                    className="textarea-field"
                    placeholder="e.g. Focus on core thesis..."
                    value={aiConstraints}
                    onChange={(e) => setAiConstraints(e.target.value)}
                    style={{ minHeight: '60px', marginTop: '0.5rem', fontSize: '0.8rem' }}
                  />
                </div>

                <button className="btn btn-secondary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleAiGenerate} disabled={isGenerating || !pdfText}>
                  {isGenerating ? "AI Processing..." : `Generate ${aiQuestionCount} Questions`}
                </button>

                {generatedQuestions.length > 0 && (
                  <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Generated Questions</label>
                    {generatedQuestions.map((q, idx) => (
                      <div key={idx} style={{ padding: '1rem', background: 'rgba(0, 85, 162, 0.03)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--sjsu-blue)', marginBottom: '0.5rem' }}>{q.type.replace('_', ' ').toUpperCase()}</div>
                        <div style={{ fontWeight: '500', marginBottom: '0.75rem', fontSize: '0.9rem' }}>{q.question}</div>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem', width: '100%' }}
                          onClick={() => {
                            setQuestion(q.question);
                            setQuestionType(q.type);
                            setOptionsText(q.options ? q.options.join('\n') : '');
                          }}
                        >
                          Use This Question
                        </button>
                      </div>
                    ))}
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: '0.5rem', background: 'var(--sjsu-gold)', color: '#000' }}
                      onClick={handleStartMultiSession}
                    >
                      🚀 Bundle All into 1 Multi-Question Quiz
                    </button>
                  </div>
                )}
              </div>
            )}

            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Question Prompt</label>
              <textarea
                className="input-field"
                rows={3}
                placeholder="Type your question here or use AI..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Answer Format</label>
              <select className="input-field" style={{ width: '100%' }} value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                <option value="open_ended">Open Ended (Text)</option>
                <option value="multiple_choice">Multiple Choice</option>
                <option value="true_false">True / False</option>
              </select>
            </div>

            {(questionType !== 'open_ended') && (
              <div>
                <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>Options (one per line)</label>
                <textarea
                  className="textarea-field"
                  placeholder="Option A\nOption B..."
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  style={{ minHeight: '100px' }}
                />
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleStartSession}>
              Initialize Session <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {currentSession ? (
              <>
                <div className="qr-live-container">
                  <div className="qr-live-label">LIVE QUIZ</div>

                  {(() => {
                    // Decide the best IP to display for the QR code
                    let bestIp = 'localhost';

                    // If the user accessed the dashboard via an IP, prefer that IP
                    if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
                      bestIp = window.location.hostname;
                    }
                    // Otherwise, try to construct a URL based on known IPs (hotspot over university 10.x)
                    else {
                      // Note: since this is synchronous render, we could use an effect to fetch from /api/network
                      // but we can also securely point them to their actual local URL. 
                    }

                    // Let's use an inline state for network IPs
                    return <NetworkQrCode sessionId={currentSession.sessionId} initialUrl={currentSession.submitUrl} />;
                  })()}

                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--accent-blue)' }}>{answersCount}</div>
                    <div className="text-muted" style={{ color: '#666', fontWeight: 'bold' }}>RESPONSES RECEIVED</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="toggle-group">
                    <span style={{ fontSize: '0.9rem' }}>Include names in summary?</span>
                    <input type="checkbox" checked={includeNames} onChange={(e) => setIncludeNames(e.target.checked)} />
                  </div>

                  <label style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>Summary Depth</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input type="radio" name="depth" checked={summaryMode === 'three_main_ideas'} onChange={() => setSummaryMode('three_main_ideas')} />
                      Standard (3 Ideas)
                    </label>
                    <label className="radio-option">
                      <input type="radio" name="depth" checked={summaryMode === 'two_main_ideas'} onChange={() => setSummaryMode('two_main_ideas')} />
                      Brief (2 Ideas)
                    </label>
                  </div>

                  <label style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: '0.5rem' }}>Insight Focus</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input type="radio" name="trait" checked={identifyTraits === 'most_interesting'} onChange={() => setIdentifyTraits('most_interesting')} />
                      Highlight Interest Points
                    </label>
                    <label className="radio-option">
                      <input type="radio" name="trait" checked={identifyTraits === 'quality_of_decision'} onChange={() => setIdentifyTraits('quality_of_decision')} />
                      Evaluate Quality
                    </label>
                  </div>

                  <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={handleRunAnalysis} disabled={isAnalyzing || answersCount === 0}>
                    {isAnalyzing ? "Synthesizing..." : "Run AI Analysis"}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                <p>Start a session to enable live analysis.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

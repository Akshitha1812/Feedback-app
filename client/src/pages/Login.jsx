import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../api';
import { LogIn } from 'lucide-react';

export default function Login({ setAuth }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await login(username, password);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            setAuth(true);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed');
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <div className="glass-panel" style={{ width: '400px', padding: '2rem' }}>
                <h2 className="text-gradient" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <LogIn style={{ display: 'inline', marginRight: '0.5rem', marginBottom: '-5px' }} />
                    Professor Login
                </h2>

                {error && <div style={{ color: 'red', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>}

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Username</label>
                        <input
                            type="text"
                            className="input-field"
                            style={{ width: '100%', padding: '0.6rem' }}
                            value={username} onChange={e => setUsername(e.target.value)} required
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Password</label>
                        <input
                            type="password"
                            className="input-field"
                            style={{ width: '100%', padding: '0.6rem' }}
                            value={password} onChange={e => setPassword(e.target.value)} required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', padding: '0.8rem', width: '100%', justifyContent: 'center' }}>
                        Login
                    </button>
                </form>
                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
                    Don't have an account? <Link to="/register" style={{ color: 'var(--sjsu-blue)', textDecoration: 'underline' }}>Register</Link>
                </div>
            </div>
        </div>
    );
}

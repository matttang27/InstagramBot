// Login.js
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate(); // To navigate to the dashboard

  useEffect(() => {
    window.electron.onLoginStatus((event, { success, error }) => {
      if (success) {
        setErrorMessage('');
        // Navigate to the dashboard when login is successful
        navigate('/dashboard');
      } else {
        setErrorMessage('Login failed: ' + error);
      }
    });
  }, [navigate]);

  const handleStart = () => {
    window.electron.sendLoginData(username, password);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Instagrammer</h1>

        {/* Subtitle */}
        <h3>Authentic Instagram connections, made easy</h3>

        {/* Username Input */}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ marginBottom: '10px', padding: '10px', width: '200px' }}
        />

        {/* Password Input */}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: '20px', padding: '10px', width: '200px' }}
        />

        {/* Disclaimer */}
        <p style={{ fontSize: '12px' }}>Instagrammer does not save your password</p>

        {/* Start Button */}
        <button
          onClick={handleStart}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Start
        </button>

        {/* Error Message */}
        {errorMessage && (
          <p style={{ color: 'red', marginTop: '20px' }}>{errorMessage}</p>
        )}
      </header>
    </div>
  );
}

export default Login;

import { useState } from 'react';
import './App.css';

function App() {
  // State to manage username and password inputs
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Handle the start button click
  const handleStart = () => {
    console.log('Username:', username);
    console.log('Password:', password);
    window.electron.sendLoginData(username, password);
    // You can add more logic here (e.g., form validation, sending data to backend, etc.)
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Login</h1>

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

        {/* Start Button */}
        <button
          onClick={handleStart}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Start
        </button>
      </header>
    </div>
  );
}

export default App;

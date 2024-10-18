// App.js
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import Dashboard from './Dashboard';
import Login from './Login';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} /> {/* Login Page */}
        <Route path="/dashboard" element={<Dashboard />} /> {/* Dashboard Page */}
      </Routes>
    </Router>
  );
}

export default App;

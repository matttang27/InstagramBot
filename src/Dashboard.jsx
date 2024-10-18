import { useEffect, useState } from 'react';
import './App.css';
function Dashboard() {
    const [metricsReceived, setMetricsReceived] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [actionsHistory, setActionsHistory] = useState([]);

  useEffect(() => {
    // Request data from Electron backend once the dashboard is loaded
    window.electron.requestMetrics(); // Send a request to get metrics

    // Listen for the metrics response
    window.electron.onMetricsReceived((event, data) => {
      setFollowersCount(data.followersCount);
      setActionsHistory(data.actionsHistory);
    });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
      <h1>Dashboard</h1>


      <div>
        <h2>Current Followers: {followersCount}</h2>
      </div>

      <div>
        <h2>Actions History</h2>
        <ul>
          {actionsHistory.map((action, index) => (
            <li key={index}>
              {action.time}: {action.actionType} - {action.target}
            </li>
          ))}
        </ul>
      </div>
      </header>
    </div>
  );
}

export default Dashboard;

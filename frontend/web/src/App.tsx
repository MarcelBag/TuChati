import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import ChatRoom from './pages/ChatRoom'
import Profile from './pages/Profile'

export default function App() {
  return (
    <Router>
      <nav style={{ display: 'flex', gap: '1rem', padding: '1rem', background: '#f7f7f7' }}>
        <Link to="/">Home</Link>
        <Link to="/chat">Chat</Link>
        <Link to="/profile">Profile</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<ChatRoom />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Router>
  )
}

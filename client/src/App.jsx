import React, { useEffect, useState, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { io } from 'socket.io-client';
import './index.css';

const SOCKET_URL = 'http://localhost:3001';
const UPLOAD_URL = 'http://localhost:3001/upload';

// Move reverseImageSearch before renderMessage to avoid unused warning
const reverseImageSearch = url => {
  const googleSearch = `https://www.google.com/searchbyimage?&image_url=${encodeURIComponent(url)}`;
  window.open(googleSearch, '_blank', 'noopener');
};

function App() {
  // ... existing state ...
  const [socket, setSocket] = useState(null);
  const [nickname, setNickname] = useState('');
  const [inputName, setInputName] = useState('');
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [rooms, setRooms] = useState(['Lobby']);
  const [room, setRoom] = useState('Lobby');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [newRoom, setNewRoom] = useState('');
  const messagesEndRef = useRef(null);

  // Contacts state persisted in localStorage
  const [contacts, setContacts] = useState(() => {
    try {
      const stored = localStorage.getItem('chatya-contacts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('chatya-contacts', JSON.stringify(contacts));
  }, [contacts]);

  // Toggle contact
  const toggleContact = user => {
    if (contacts.includes(user)) {
      setContacts(contacts.filter(c => c !== user));
    } else {
      setContacts([...contacts, user]);
    }
  };

  // Add new file state
  const [uploading, setUploading] = useState(false);

  // ... existing effects ...
  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);

    s.on('nickname', name => {
      setNickname(name);
      setInputName(name);
    });
    s.on('users', setUsers);
    s.on('rooms', setRooms);
    s.on('joined-room', r => {
      setRoom(r);
      setMessages([]); // clear chat log on switching rooms
      setShowEmoji(false);
    });
    s.on('message', msg => {
      setMessages(m => [...m, msg]);
    });

    // On mount, join Lobby
    s.emit('join-room', 'Lobby');
    return () => { s.disconnect(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = e => {
    e.preventDefault();
    if (input.trim() && socket) {
      socket.emit('message', input);
      setInput('');
    }
  };

  const handleNameChange = e => setInputName(e.target.value);
  const setNewNickname = e => {
    e.preventDefault();
    if (inputName.trim() && socket) {
      socket.emit('set-nickname', inputName.trim());
      setNickname(inputName.trim());
    }
  };

  const joinRoom = r => {
    if (socket && r !== room) {
      socket.emit('join-room', r);
    }
  };

  const handleCreateRoom = e => {
    e.preventDefault();
    const r = newRoom.trim();
    if (socket && r && !rooms.includes(r)) {
      socket.emit('create-room', r);
      socket.emit('join-room', r);
      setCreatingRoom(false);
      setNewRoom('');
    }
  };

  const addEmoji = emoji => {
    setInput(input + emoji.native);
    setShowEmoji(false);
  };

  // New function: handle file input
  const handleFileChange = async e => {
    if (e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        // Send message with file URL and original filename
        if (socket) {
          socket.emit('message', `📎 File: [${data.originalName}](${data.url})`);
        }
      } else {
        alert('Upload failed');
      }
    } catch(error) {
      alert('Upload error: ' + error.message);
    }
    setUploading(false);
    e.target.value = null; // Reset file input
  };

  // Message rendering helper
  function renderMessage(m, i) {
    const fileLinkMatch = m.text.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (fileLinkMatch) {
      const name = fileLinkMatch[1];
      const url = fileLinkMatch[2];
      const isImage = url.match(/\.(jpe?g|png|gif|bmp|webp|svg)$/i);

      const handleContextMenu = e => {
        if (isImage) {
          e.preventDefault();
          const confirmed = window.confirm('Search this image on Google?');
          if (confirmed) {
            reverseImageSearch(url);
          }
        }
      };

      return (
        <div
          key={i}
          className={m.user === nickname ? 'msg me' : 'msg'}
          onContextMenu={handleContextMenu}
          title={isImage ? 'Right-click to search image' : ''}
        >
          <b>{m.user}:</b>
          {isImage ? (
            <img src={url} alt={name} style={{ maxWidth: '30vw', borderRadius: 8 }} />
          ) : (
            <a href={url} target="_blank" rel="noreferrer" download>
              {name}
            </a>
          )}
        </div>
      );
    }
    return (
      <div key={i} className={m.user === nickname ? 'msg me' : 'msg'}>
        <b>{m.user}:</b> {m.text}
      </div>
    );
  }

  return (
    <div className="chat-container">
      <header>
        <h1>ChatYa Public Room</h1>
        <form className="nickname-form" onSubmit={setNewNickname}>
          <input value={inputName} onChange={handleNameChange} maxLength={16} />
          <button type="submit">Set Nickname</button>
        </form>
        <span className="your-nickname">You are: <b>{nickname}</b></span>
      </header>
      <div className="chat-body">
        <RoomList
          rooms={rooms}
          room={room}
          creatingRoom={creatingRoom}
          newRoom={newRoom}
          setNewRoom={setNewRoom}
          setCreatingRoom={setCreatingRoom}
          joinRoom={joinRoom}
          handleCreateRoom={handleCreateRoom}
        />
        {/* Contacts section */}
        <div style={{ marginTop: 24, borderTop: '1px solid #3c528c', paddingTop: 12 }}>
          <span style={{ fontWeight: 600, color: '#aac9f7' }}>Contacts</span>
          {contacts.length === 0 ? (
            <p style={{ fontSize: 12, color: '#7a8db9', marginTop: 6 }}>
              No contacts yet. Click username to add.
            </p>
          ) : (
            <ul style={{ marginTop: 6, padding: 0, listStyle: 'none' }}>
              {contacts.sort((a,b) => {
                const aOnline = users.includes(a) ? 0 : 1;
                const bOnline = users.includes(b) ? 0 : 1;
                return aOnline - bOnline;
              }).map(u => {
                const online = users.includes(u);
                return (
                  <li
                    key={u}
                    className={u === nickname ? 'me' : ''}
                    data-avatar={u.charAt(0).toUpperCase()}
                    style={{
                      cursor: 'pointer',
                      color: online ? '#b6dbff' : '#8696bf',
                      opacity: online ? 1 : 0.6,
                      fontWeight: online ? 600 : 400,
                      padding: '4px 10px',
                      borderRadius: 6,
                      marginBottom: 4
                    }}
                    title={online ? `${u} (online)` : `${u} (offline)`}
                    onClick={() => toggleContact(u)}
                    aria-label={online ? 'Remove contact' : 'Add contact'}
                  >
                    {u} {online ? "🟢" : "⚪"}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        </aside>
        <aside className="user-list">
          <h4>Users ({users.length})</h4>
          <ul>
            {users.map(u => (
              <li
                key={u}
                className={u === nickname ? 'me' : ''}
                data-avatar={u.charAt(0).toUpperCase()}
                title="Click to add/remove contact"
                onClick={() => toggleContact(u)}
                style={{ cursor: 'pointer' }}
              >
                {u}
              </li>
            ))}
          </ul>
        </aside>
        <main className="messages-section">
          <div className="messages">
            {messages.map((m, i) => renderMessage(m, i))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={sendMessage} className="message-form" style={{position: 'relative'}}>
            <button
              type="button"
              onClick={() => setShowEmoji(e => !e)}
              style={{ fontSize: 20, marginRight: 4 }}
              aria-label="Show emoji picker"
            >😃
            </button>
            {showEmoji && (
              <div style={{ position: 'absolute', bottom: 64, left: 30, zIndex: 1000 }}>
                <Picker data={data} onEmojiSelect={addEmoji} />
              </div>
            )}
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={`Message #${room}`}
              maxLength={256}
            />
            <label htmlFor="file-upload" className="file-upload-label" style={{cursor: 'pointer', marginLeft: 8}} title="Upload file">
              📎
            </label>
            <input
              id="file-upload"
              type="file"
              style={{display: 'none'}}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <button type="submit" disabled={uploading}>
              {uploading ? 'Uploading...' : 'Send'}
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}

export default App;
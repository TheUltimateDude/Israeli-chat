
// Extract user list section into a UserList component
// Move inline styles to CSS classes

import React, { useEffect, useState, useRef } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { io } from 'socket.io-client';
import './index.css';

const SOCKET_URL = 'http://localhost:3001';
const UPLOAD_URL = 'http://localhost:3001/upload';


const reverseImageSearch = url => {
  const googleSearch = `https://www.google.com/searchbyimage?&image_url=${encodeURIComponent(url)}`;
  window.open(googleSearch, '_blank', 'noopener');
};





function ContactsList({contacts, users, nickname, toggleContact}) {
  return (
    <div className="contacts-section">
      <span className="contacts-header">Contacts</span>
      {contacts.length === 0 ? (
        <p className="contacts-empty">No contacts yet. Click username to add.</p>
      ) : (
        <ul className="contacts-list">
          {contacts
            .sort((a, b) => {
              const aOnline = users.includes(a) ? 0 : 1;
              const bOnline = users.includes(b) ? 0 : 1;
              return aOnline - bOnline;
            })
            .map((u) => {
              const online = users.includes(u);
              return (
                <li
                  key={u}
                  className={`${u === nickname ? 'me' : ''} ${online ? 'online' : 'offline'}`}
                  data-avatar={u.charAt(0).toUpperCase()}
                  title={online ? `${u} (online)` : `${u} (offline)`}
                  onClick={() => toggleContact(u)}
                  aria-label={online ? `Remove contact, ${u} is online` : `Add contact, ${u} is offline`}
                  tabIndex={0}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') toggleContact(u);
                  }}
                >
                  <span className="status-dot" aria-hidden="true"></span>
                  {u}
                </li>
              );
            })}
        </ul>
      )}
    </div>
  );
}

function App() {
  const [socket, setSocket] = useState(null);
  const [nickname, setNickname] = useState('');
  const [inputName, setInputName] = useState('');
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [rooms, setRooms] = useState(['Lobby']);
  // const [room, setRoom] = useState('Lobby');
  const [chatTarget, setChatTarget] = useState('Lobby'); // 'Lobby' or user nickname
  const [isPrivate, setIsPrivate] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [newRoom, setNewRoom] = useState('');
  const messagesEndRef = useRef(null);

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

  const toggleContact = (user) => {
    if (contacts.includes(user)) {
      setContacts(contacts.filter((c) => c !== user));
    } else {
      setContacts([...contacts, user]);
    }
  };

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const s = io(SOCKET_URL);
    setSocket(s);

    s.on('nickname', (name) => {
      setNickname(name);
      setInputName(name);
    });
    s.on('users', setUsers);
    s.on('rooms', setRooms);
    s.on('joined-room', (r) => {
      // setRoom(r);
      // Clear message list for joined room only if not private chat
      if (!isPrivate) {
        setMessages([]);
      }
      setShowEmoji(false);
      setChatTarget(r);
      setIsPrivate(false);
    });
    s.on('message', (msg) => {
      setMessages((m) => [...m, msg]);
    });
    s.on('private-message', (msg) => {
      // msg: {from, text, timestamp}
      setMessages((m) => [...m, { user: msg.from, text: msg.text, timestamp: msg.timestamp, private: true }]);
    });

    s.emit('join-room', 'Lobby');
    return () => {
      s.disconnect();
    };
  }, [isPrivate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    if (isPrivate) {
      socket.emit('private-message', { to: chatTarget, text: input });
    } else {
      socket.emit('message', input);
    }
    setInput('');
  };

  const handleNameChange = (e) => setInputName(e.target.value);
  const setNewNickname = (e) => {
    e.preventDefault();
    if (inputName.trim() && socket) {
      socket.emit('set-nickname', inputName.trim());
      setNickname(inputName.trim());
    }
  };

  const joinRoom = (r) => {
    if (socket && r !== chatTarget) {
      socket.emit('join-room', r);
      setChatTarget(r);
      setIsPrivate(false);
    }
  };

  const handleCreateRoom = (e) => {
    e.preventDefault();
    const r = newRoom.trim();
    if (socket && r && !rooms.includes(r)) {
      socket.emit('create-room', r);
      socket.emit('join-room', r);
      setCreatingRoom(false);
      setNewRoom('');
    }
  };

  const addEmoji = (emoji) => {
    setInput(input + emoji.native);
    setShowEmoji(false);
  };

  const handleFileChange = async (e) => {
    if (e.target.files.length === 0) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await fetch(UPLOAD_URL, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        if (socket) {
          if (isPrivate) {
            socket.emit('private-message', { to: chatTarget, text: `📎 File: [${data.originalName}](${data.url})` });
          } else {
            socket.emit('message', `📎 File: [${data.originalName}](${data.url})`);
          }
        }
      } else {
        alert('Upload failed');
      }
    } catch (error) {
      alert('Upload error: ' + error.message);
    }
    setUploading(false);
    e.target.value = null;
  };


  function renderMessage(m, i) {
    const fileLinkMatch = m.text.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const time = m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const privateTag = m.private ? <span className="private-tag">[Private]</span> : null;

    if (fileLinkMatch) {
      const name = fileLinkMatch[1];
      const url = fileLinkMatch[2];
      const isImage = url.match(/\.(jpe?g|png|gif|bmp|webp|svg)$/i);

      const handleContextMenu = (e) => {
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
          <b>{m.user}</b> <span className="message-time">[{time}]</span> {privateTag}:
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
        <b>{m.user}</b> <span className="message-time">[{time}]</span> {privateTag}: {m.text}
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
        <span className="your-nickname">
          You are: <b>{nickname}</b>
        </span>
      </header>
      <div className="chat-body">
        <RoomList
          rooms={rooms}
          room={chatTarget} // Keep here for current target highlight
          creatingRoom={creatingRoom}
          newRoom={newRoom}
          setNewRoom={setNewRoom}
          setCreatingRoom={setCreatingRoom}
          joinRoom={joinRoom}
          handleCreateRoom={handleCreateRoom}
          isPrivate={isPrivate}
        />
        <ContactsList
          contacts={contacts}
          users={users}
          nickname={nickname}
          toggleContact={toggleContact}
          chatTarget={chatTarget}
          setChatTarget={setChatTarget}
          setIsPrivate={setIsPrivate}
        />
        <UserList
          users={users}
          nickname={nickname}
          toggleContact={toggleContact}
          chatTarget={chatTarget}
          setChatTarget={setChatTarget}
          setIsPrivate={setIsPrivate}
        />
        <MessagesSection
          messages={messages}
          nickname={nickname}
          renderMessage={renderMessage}
          showEmoji={showEmoji}
          setShowEmoji={setShowEmoji}
          input={input}
          setInput={setInput}
          sendMessage={sendMessage}
          addEmoji={addEmoji}
          handleFileChange={handleFileChange}
          uploading={uploading}
        />
      </div>
      <style>{`
        .private-tag {
          color: #f50057;
          font-weight: 600;
          margin-left: 4px;
        }
      `}</style>
    </div>
  );
}

function MessagesSection({
  messages,
  nickname,
  renderMessage,
  showEmoji,
  setShowEmoji,
  input,
  setInput,
  sendMessage,
  addEmoji,
  handleFileChange,
  uploading,
}) {
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <main className="messages-section">
      <div className="messages">
        {messages.map((m, i) => renderMessage(m, i))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={sendMessage} className="message-form" style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setShowEmoji((e) => !e)}
          style={{ fontSize: 20, marginRight: 4 }}
          aria-label="Show emoji picker"
        >
          😃
        </button>
        {showEmoji && (
          <div style={{ position: 'absolute', bottom: 64, left: 30, zIndex: 1000 }}>
            <Picker data={data} onEmojiSelect={addEmoji} />
          </div>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message #${nickname}`}
          maxLength={256}
        />
        <label
          htmlFor="file-upload"
          className="file-upload-label"
          style={{ cursor: 'pointer', marginLeft: 8 }}
          title="Upload file"
        >
          📎
        </label>
        <input id="file-upload" type="file" style={{ display: 'none' }} onChange={handleFileChange} disabled={uploading} />
        <button type="submit" disabled={uploading}>
          {uploading ? 'Uploading...' : 'Send'}
        </button>
      </form>
    </main>
  );
}

export default App;
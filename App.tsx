
import React, { useState, useRef, useMemo } from 'react';
import { 
  Home, 
  MessageSquare, 
  PlusSquare, 
  User as UserIcon, 
  Camera, 
  Send, 
  Heart, 
  ChevronLeft,
  Search as SearchIcon,
  LogOut,
  Snowflake,
  MessageCircle,
  Plus,
  Lock,
  Grid,
  Eye,
  Inbox
} from 'lucide-react';
import { 
  User, 
  Post, 
  Message, 
  View, 
  SnowedInNumber, 
  formatSnowNumber,
  parseSnowedInID,
  Comment
} from './types';
import { getNeighborResponse } from './services/geminiService';

const INITIAL_USERS: User[] = [];
const INITIAL_POSTS: Post[] = [];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [registeredUsers, setRegisteredUsers] = useState<User[]>(INITIAL_USERS);
  const [currentView, setCurrentView] = useState<View>('feed');
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isAuthMode, setIsAuthMode] = useState(true);

  // Auth States
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [snowedInID, setSnowedInID] = useState('');

  // Post State
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [newPostCaption, setNewPostCaption] = useState('');
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Chat State
  const [msgInput, setMsgInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAuth = () => {
    if (!authName || !authPassword || !snowedInID) return alert('Please fill in all fields');

    // Special Admin Check (Observer Mode)
    if (snowedInID === '2775N') {
      const adminUser: User = {
        id: 'admin',
        name: authName,
        password: authPassword,
        avatar: 'https://cdn-icons-png.flaticon.com/512/2530/2530005.png',
        snowNumber: { apartment: 0, room: 0, bed: 0 },
        isAdmin: true
      };
      setCurrentUser(adminUser);
      setIsAuthMode(false);
      return;
    }

    const parsed = parseSnowedInID(snowedInID);
    if (!parsed) return alert('Invalid Snowed In number. Use AptRoomBed format (e.g., 3302 or 12401).');

    // Find if a user already exists with this Snowed In Number
    const existingUser = registeredUsers.find(u => 
      u.snowNumber.apartment === parsed.apartment && 
      u.snowNumber.room === parsed.room && 
      u.snowNumber.bed === parsed.bed
    );

    if (existingUser) {
      if (existingUser.name === authName && existingUser.password === authPassword) {
        setCurrentUser(existingUser);
        setIsAuthMode(false);
      } else {
        alert('This Snowed In number is already registered. If it is yours, please enter the correct Name and Password.');
      }
    } else {
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name: authName,
        password: authPassword,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${authName}`,
        snowNumber: parsed
      };
      
      setRegisteredUsers([...registeredUsers, newUser]);
      setCurrentUser(newUser);
      setIsAuthMode(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setAuthName('');
    setAuthPassword('');
    setSnowedInID('');
    setIsAuthMode(true);
    setCurrentView('feed');
    setActiveChatId(null);
  };

  const handlePost = async () => {
    if (!newPostImage || !currentUser || currentUser.isAdmin) return;
    
    const post: Post = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      userSnowNumber: formatSnowNumber(currentUser.snowNumber),
      imageUrl: newPostImage,
      caption: newPostCaption,
      timestamp: Date.now(),
      likes: 0,
      comments: []
    };

    setPosts([post, ...posts]);
    setNewPostImage(null);
    setNewPostCaption('');
    setCurrentView('feed');
  };

  const toggleHeart = (postId: string) => {
    if (currentUser?.isAdmin) return;
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          likes: post.likedByMe ? post.likes - 1 : post.likes + 1,
          likedByMe: !post.likedByMe
        };
      }
      return post;
    }));
  };

  const addComment = (postId: string) => {
    if (!commentInput.trim() || !currentUser || currentUser.isAdmin) return;
    
    const newComment: Comment = {
      id: Date.now().toString(),
      userId: currentUser.id,
      userName: currentUser.name,
      text: commentInput,
      timestamp: Date.now()
    };

    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          comments: [...post.comments, newComment]
        };
      }
      return post;
    }));
    setCommentInput('');
    setActiveCommentPostId(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: 'post' | 'profile') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (target === 'post') {
          setNewPostImage(result);
        } else if (target === 'profile' && currentUser) {
          if (currentUser.isAdmin) return;
          const updatedUser = { ...currentUser, avatar: result };
          setCurrentUser(updatedUser);
          setRegisteredUsers(registeredUsers.map(u => u.id === currentUser.id ? updatedUser : u));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async () => {
    if (!msgInput.trim() || !currentUser || !activeChatId || currentUser.isAdmin) return;

    const newMsg: Message = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      recipientId: activeChatId,
      text: msgInput,
      timestamp: Date.now()
    };

    setMessages([...messages, newMsg]);
    setMsgInput('');

    // Simulate neighbor response if it's a "simulated" behavior
    const recipient = registeredUsers.find(u => u.id === activeChatId);
    if (recipient && recipient.id !== currentUser.id) {
       // In a real app, this would send to a server. 
       // For this demo, Gemini simulates a neighbor response.
      const response = await getNeighborResponse(msgInput, recipient.name, formatSnowNumber(recipient.snowNumber));
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        senderId: activeChatId,
        recipientId: currentUser.id,
        text: response,
        timestamp: Date.now() + 500
      };
      setMessages(prev => [...prev, aiMsg]);
    }
  };

  const filteredSearchUsers = registeredUsers.filter(u => 
    u.id !== currentUser?.id && (
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    formatSnowNumber(u.snowNumber).toLowerCase().includes(searchQuery.toLowerCase())
  ));

  const getUserAvatar = (userId: string, userName: string) => {
    const user = registeredUsers.find(u => u.id === userId);
    return user ? user.avatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userName}`;
  };

  const myPosts = useMemo(() => {
    return posts.filter(p => p.userId === currentUser?.id);
  }, [posts, currentUser]);

  const displayedMessages = useMemo(() => {
    if (!activeChatId) return [];
    if (currentUser?.isAdmin) {
      return messages.filter(m => m.senderId === activeChatId || m.recipientId === activeChatId);
    }
    return messages.filter(m => 
      (m.senderId === currentUser?.id && m.recipientId === activeChatId) ||
      (m.senderId === activeChatId && m.recipientId === currentUser?.id)
    );
  }, [messages, activeChatId, currentUser]);

  if (isAuthMode && !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-blue-50 overflow-y-auto">
        <div className="w-full max-w-md glass p-8 rounded-3xl shadow-xl text-center space-y-6 my-auto">
          <div className="flex justify-center">
            <div className="bg-blue-600 p-4 rounded-2xl shadow-lg">
              <Snowflake size={48} className="text-white animate-pulse" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-slate-800 tracking-tight text-center">Snowed In</h1>
          <p className="text-slate-500 text-sm">A private social network for residents.</p>
          
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Your Name</label>
              <input 
                type="text" 
                value={authName}
                onChange={(e) => setAuthName(e.target.value)}
                placeholder="Full Name" 
                className="w-full p-4 bg-white/50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Password</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Enter password" 
                  className="w-full p-4 pl-12 bg-white/50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              </div>
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1 ml-1">Snowed In Number (e.g., 3302)</label>
              <input 
                type="text" 
                maxLength={6}
                value={snowedInID}
                onChange={(e) => setSnowedInID(e.target.value)}
                placeholder="Ex: 3302" 
                className="w-full p-4 bg-white/50 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-center text-lg font-mono tracking-[0.2em] shadow-sm"
              />
              <p className="text-[10px] text-slate-400 mt-2 italic text-center">*Sign in or register with your complex ID.</p>
            </div>
          </div>

          <button 
            onClick={handleAuth}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg transform transition active:scale-95"
          >
            Enter Complex
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto h-screen bg-slate-50 relative flex flex-col overflow-hidden shadow-2xl pb-safe">
      <header className="sticky top-0 z-40 glass border-b border-slate-200 px-6 py-4 flex items-center justify-between pt-[calc(1rem+env(safe-area-inset-top))]">
        {['chat-detail', 'search', 'post'].includes(currentView) ? (
          <button onClick={() => setCurrentView(currentView === 'search' || currentView === 'post' ? 'feed' : 'chat-list')} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Snowflake className="text-blue-600" size={24} />
            <span className="font-bold text-xl tracking-tight">Snowed In</span>
            {currentUser?.isAdmin && (
              <span className="ml-2 bg-slate-800 text-white text-[8px] px-2 py-0.5 rounded uppercase font-bold tracking-widest flex items-center gap-1">
                <Eye size={10} /> Observer
              </span>
            )}
          </div>
        )}
        
        <div className="flex items-center gap-3">
          {currentView === 'feed' && (
            <button onClick={() => setCurrentView('search')} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
              <SearchIcon size={20} />
            </button>
          )}
          {currentView === 'profile' && (
            <button onClick={handleLogout} className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors flex items-center gap-1">
              <LogOut size={20} />
              <span className="text-xs font-bold">Logout</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scroll-smooth">
        {currentView === 'feed' && (
          <div className="p-4 space-y-6 pb-24">
            {posts.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4">
                <div className="p-6 bg-white rounded-full shadow-inner">
                  <Snowflake size={48} className="opacity-20" />
                </div>
                <p className="font-medium">No posts yet. Be the first to share!</p>
              </div>
            )}
            {posts.map(post => (
              <div key={post.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-100 shadow-sm">
                    <img src={getUserAvatar(post.userId, post.userName)} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm leading-tight">{post.userName}</h3>
                    <p className="text-[10px] text-slate-400 font-medium">{post.userSnowNumber}</p>
                  </div>
                </div>
                <img src={post.imageUrl} alt="" className="w-full aspect-square object-cover" />
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => toggleHeart(post.id)}
                      className={`flex items-center gap-1.5 transition-colors ${post.likedByMe ? 'text-red-500' : 'text-slate-600'} ${currentUser?.isAdmin ? 'cursor-default' : ''}`}
                    >
                      <Heart size={22} fill={post.likedByMe ? 'currentColor' : 'none'} />
                      <span className="text-xs font-bold">{post.likes}</span>
                    </button>
                    <button 
                      onClick={() => {
                        if (currentUser?.isAdmin) return;
                        setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id);
                      }}
                      className={`flex items-center gap-1.5 text-slate-600 ${currentUser?.isAdmin ? 'cursor-default' : ''}`}
                    >
                      <MessageCircle size={22} />
                      <span className="text-xs font-bold">{post.comments.length}</span>
                    </button>
                  </div>
                  
                  <p className="text-sm text-slate-700">
                    <span className="font-bold mr-2">{post.userName}</span>
                    {post.caption}
                  </p>

                  {post.comments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-50">
                      {post.comments.slice(-3).map(comment => (
                        <div key={comment.id} className="text-xs flex gap-2">
                          <span className="font-bold text-slate-800">{comment.userName}</span>
                          <span className="text-slate-600">{comment.text}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!currentUser?.isAdmin && activeCommentPostId === post.id && (
                    <div className="flex gap-2 mt-2">
                      <input 
                        type="text"
                        autoFocus
                        value={commentInput}
                        onChange={(e) => setCommentInput(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addComment(post.id)}
                        placeholder="Add a comment..."
                        className="flex-1 bg-slate-50 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <button 
                        onClick={() => addComment(post.id)}
                        className="text-blue-600 font-bold text-xs px-2"
                      >
                        Post
                      </button>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                    {new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {currentView === 'search' && (
          <div className="p-4 space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search neighbor name or ID..." 
                className="w-full p-4 pl-12 bg-white rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">Residents</h2>
              {filteredSearchUsers.length > 0 ? (
                filteredSearchUsers.map(user => (
                  <button 
                    key={user.id}
                    onClick={() => {
                      setActiveChatId(user.id);
                      setCurrentView('chat-detail');
                    }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-200 active:scale-[0.98]"
                  >
                    <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shadow-sm">
                      <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-bold text-slate-800">{user.name}</h3>
                      <p className="text-[10px] text-blue-500 font-bold">{formatSnowNumber(user.snowNumber)}</p>
                    </div>
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      {currentUser?.isAdmin ? <Eye size={18} /> : <MessageCircle size={18} />}
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-center py-12 text-slate-400">
                  <p className="text-sm">No residents found matching "{searchQuery}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === 'chat-list' && (
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center px-2">
              <h2 className="text-xl font-bold">{currentUser?.isAdmin ? 'Observer Console' : 'Inbox'}</h2>
              {!currentUser?.isAdmin && (
                <button 
                  onClick={() => setCurrentView('search')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-full text-xs font-bold shadow-md hover:bg-blue-700 active:scale-95 transition-all"
                >
                  <Plus size={14} />
                  New Chat
                </button>
              )}
            </div>
            
            <div className="space-y-2">
              {registeredUsers.filter(u => u.id !== currentUser?.id).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-4 text-center px-6">
                  <Inbox size={48} className="opacity-20" />
                  <p className="text-sm">No active conversations. Search for a neighbor to start talking!</p>
                </div>
              ) : (
                registeredUsers.filter(u => u.id !== currentUser?.id).map(user => (
                  <button 
                    key={user.id}
                    onClick={() => {
                      setActiveChatId(user.id);
                      setCurrentView('chat-detail');
                    }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-white rounded-2xl transition-all border border-transparent hover:border-slate-200 active:scale-[0.98]"
                  >
                    <div className="w-14 h-14 rounded-full bg-slate-200 overflow-hidden relative shadow-sm">
                      <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-800">{user.name}</h3>
                        <span className="text-[10px] text-slate-400 font-medium">{formatSnowNumber(user.snowNumber)}</span>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-1">
                        {currentUser?.isAdmin ? 'Click to observe message history' : 'Tap to chat with neighbor'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {currentView === 'chat-detail' && (
          <div className="flex flex-col h-[calc(100vh-140px-env(safe-area-inset-bottom))]">
            <div className="flex-1 p-4 space-y-4 overflow-y-auto pb-8">
              {displayedMessages.map(m => (
                <div key={m.id} className={`flex ${m.senderId === currentUser?.id ? 'justify-end' : (currentUser?.isAdmin && m.senderId !== activeChatId ? 'justify-end' : 'justify-start')}`}>
                  <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                    m.senderId === currentUser?.id || (currentUser?.isAdmin && m.senderId !== activeChatId)
                      ? 'bg-blue-600 text-white rounded-tr-none shadow-md' 
                      : 'bg-white text-slate-800 rounded-tl-none shadow-sm border border-slate-100'
                  }`}>
                    <p className="text-[8px] opacity-60 mb-0.5 uppercase font-bold">
                      {registeredUsers.find(u => u.id === m.senderId)?.name || 'Unknown'}
                    </p>
                    {m.text}
                  </div>
                </div>
              ))}
              {displayedMessages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-4">
                  <MessageSquare size={48} className="opacity-20" />
                  <p className="text-sm">{currentUser?.isAdmin ? 'No message history found.' : 'Say something friendly!'}</p>
                </div>
              )}
            </div>
            {!currentUser?.isAdmin && (
              <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-2 mb-safe">
                <input 
                  type="text" 
                  value={msgInput}
                  onChange={(e) => setMsgInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder="Type a message..." 
                  className="flex-1 p-3 bg-slate-50 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                />
                <button 
                  onClick={sendMessage}
                  className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition active:scale-95 shadow-md"
                >
                  <Send size={18} />
                </button>
              </div>
            )}
            {currentUser?.isAdmin && (
              <div className="p-4 bg-slate-100 border-t border-slate-200 text-center mb-safe">
                <p className="text-[10px] font-bold text-slate-500 flex items-center justify-center gap-2">
                  <Lock size={12} /> READ ONLY MODE
                </p>
              </div>
            )}
          </div>
        )}

        {currentView === 'post' && (
          <div className="p-6 space-y-6 pb-24">
            {currentUser?.isAdmin ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                <Lock size={64} className="text-slate-300" />
                <h2 className="text-2xl font-bold text-slate-800">Observer Mode</h2>
                <p className="text-slate-500 text-sm px-10">Observer accounts cannot post to the feed.</p>
                <button onClick={() => setCurrentView('feed')} className="text-blue-600 font-bold hover:underline">Return to Feed</button>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold">New Post</h2>
                <div 
                  className="aspect-square w-full rounded-3xl bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center relative overflow-hidden group cursor-pointer shadow-inner"
                  onClick={() => document.getElementById('imageInput')?.click()}
                >
                  {newPostImage ? (
                    <img src={newPostImage} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Camera size={48} className="text-slate-400 mb-2" />
                      <p className="text-sm text-slate-500 px-8 text-center font-medium">Capture a snowy moment</p>
                    </>
                  )}
                  <input 
                    id="imageInput" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => handleImageUpload(e, 'post')}
                  />
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase mb-1 block">Caption</label>
                    <textarea 
                      value={newPostCaption}
                      onChange={(e) => setNewPostCaption(e.target.value)}
                      placeholder="What's happening in your part of the complex?" 
                      className="w-full p-4 bg-white border border-slate-200 rounded-2xl h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm resize-none shadow-sm"
                    />
                  </div>
                  <button 
                    onClick={handlePost}
                    disabled={!newPostImage}
                    className={`w-full py-4 rounded-xl font-bold shadow-lg transition active:scale-95 ${
                      newPostImage ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    Post to Feed
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {currentView === 'profile' && currentUser && (
          <div className="p-6 space-y-8 pb-24">
            <div className="flex flex-col items-center text-center space-y-4">
              <div 
                className={`w-32 h-32 rounded-[2.5rem] bg-white p-1.5 shadow-xl rotate-3 relative group transition-transform ${!currentUser.isAdmin ? 'cursor-pointer hover:rotate-0' : ''}`}
                onClick={() => !currentUser.isAdmin && fileInputRef.current?.click()}
              >
                <div className="w-full h-full rounded-[2.1rem] overflow-hidden">
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                </div>
                {!currentUser.isAdmin && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 rounded-[2.5rem] transition-opacity">
                    <div className="text-center text-white">
                      <Camera className="mx-auto mb-1" size={24} />
                      <p className="text-[10px] font-bold">Change</p>
                    </div>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={(e) => handleImageUpload(e, 'profile')}
                />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{currentUser.name}</h2>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold mt-1 shadow-sm uppercase tracking-wider">
                  <Snowflake size={10} />
                  {currentUser.isAdmin ? 'System Observer' : formatSnowNumber(currentUser.snowNumber)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass p-4 rounded-2xl text-center shadow-sm">
                <p className="text-xl font-bold text-slate-800">
                  {currentUser.isAdmin ? posts.length : myPosts.length}
                </p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  {currentUser.isAdmin ? 'Total Complex Posts' : 'My Posts'}
                </p>
              </div>
              <div className="glass p-4 rounded-2xl text-center shadow-sm">
                <p className="text-xl font-bold text-slate-800">{registeredUsers.filter(u => !u.isAdmin).length}</p>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Neighbors</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Grid size={18} className="text-slate-400" />
                <h3 className="font-bold text-slate-800">{currentUser.isAdmin ? 'Global Archive' : 'My Posts'}</h3>
              </div>
              
              {(currentUser.isAdmin ? posts : myPosts).length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {(currentUser.isAdmin ? posts : myPosts).map(post => (
                    <div key={post.id} className="aspect-square relative group overflow-hidden rounded-xl bg-slate-200 shadow-inner">
                      <img src={post.imageUrl} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" alt="" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <Heart size={14} className="text-white fill-current" />
                        <span className="text-white text-[10px] ml-1 font-bold">{post.likes}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400">
                  <PlusSquare size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No activity to show.</p>
                  {!currentUser.isAdmin && (
                    <button 
                      onClick={() => setCurrentView('post')}
                      className="mt-4 text-xs font-bold text-blue-600 hover:underline"
                    >
                      Create your first post
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 w-full max-w-md glass border-t border-slate-200 px-6 py-3 flex justify-between items-center z-50 rounded-t-[2.5rem] shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <button 
          onClick={() => setCurrentView('feed')}
          className={`flex flex-col items-center gap-1 transition-all ${currentView === 'feed' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-500'}`}
        >
          <Home size={22} fill={currentView === 'feed' ? 'currentColor' : 'none'} />
          <span className="text-[10px] font-bold">Feed</span>
        </button>
        <button 
          onClick={() => setCurrentView('chat-list')}
          className={`flex flex-col items-center gap-1 transition-all ${currentView === 'chat-list' || currentView === 'chat-detail' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-500'}`}
        >
          <MessageSquare size={22} fill={currentView === 'chat-list' || currentView === 'chat-detail' ? 'currentColor' : 'none'} />
          <span className="text-[10px] font-bold">{currentUser?.isAdmin ? 'Observe' : 'Inbox'}</span>
        </button>
        {!currentUser?.isAdmin && (
          <button 
            onClick={() => setCurrentView('post')}
            className="bg-blue-600 text-white p-3 rounded-2xl -mt-10 shadow-xl shadow-blue-200 active:scale-90 transition-all border-4 border-white"
          >
            <Plus size={28} strokeWidth={3} />
          </button>
        )}
        <button 
          onClick={() => setCurrentView('search')} 
          className={`flex flex-col items-center gap-1 transition-all ${currentView === 'search' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-500'}`}
        >
          <SearchIcon size={22} />
          <span className="text-[10px] font-bold">Search</span>
        </button>
        <button 
          onClick={() => setCurrentView('profile')}
          className={`flex flex-col items-center gap-1 transition-all ${currentView === 'profile' ? 'text-blue-600 scale-110' : 'text-slate-400 hover:text-slate-500'}`}
        >
          <UserIcon size={22} fill={currentView === 'profile' ? 'currentColor' : 'none'} />
          <span className="text-[10px] font-bold">Profile</span>
        </button>
      </nav>
    </div>
  );
};

export default App;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Layer, Scene } from './types';
import CanvasMode from './components/CanvasMode';
import StudioMode from './components/StudioMode';
import ProjectHistoryPanel from './components/ProjectHistoryPanel';
import { Layers, Clapperboard, LogOut, Zap, History } from 'lucide-react';
import { auth, googleProvider, db } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from './lib/firebase';
import { saveProject, getCurrentProjectId, setCurrentProjectId, generateThumbnailFromLayers } from './services/projectHistory';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'canvas' | 'studio'>('canvas');
  const [authLoading, setAuthLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [currentProjectId, setCurrentProjectIdState] = useState<string | null>(getCurrentProjectId());

  // Lifted State: Layers are now managed here to be accessible by Studio Mode
  const [layers, setLayers] = useState<Layer[]>([]);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLoadingProjectRef = useRef(false);

  // Lifted State: Studio Mode scenes & orientation
  const [scenes, setScenes] = useState<Scene[]>([
    { id: '1', startFrame: null, endFrame: null, shots: [{ prompt: '', duration: '5' }], videos: [], selectedVideoIndex: -1, isGenerating: false, variationCount: 1 }
  ]);
  const [studioOrientation, setStudioOrientation] = useState<'auto' | 'horizontal' | 'vertical'>('auto');

  // Silent auto-save (no UI feedback)
  const doAutoSave = useCallback(async () => {
    if (!user || (layers.length === 0 && scenes.length <= 1 && !scenes[0]?.startFrame) || isLoadingProjectRef.current) return;
    try {
      const thumbnail = await generateThumbnailFromLayers(layers);
      const projectId = saveProject(
        user.id,
        layers,
        thumbnail,
        { w: 1920, h: 1080 },
        currentProjectId || undefined,
        scenes,
        studioOrientation
      );
      setCurrentProjectIdState(projectId);
      setCurrentProjectId(projectId);
      console.log('💾 Auto-saved project:', projectId);
    } catch (error) {
      console.warn('Auto-save failed:', error);
    }
  }, [user, layers, currentProjectId, scenes, studioOrientation]);

  // Debounced auto-save: triggers 3s after last layer or scene change
  useEffect(() => {
    if (!user) return;
    const hasContent = layers.length > 0 || (scenes.length > 0 && scenes.some(s => s.startFrame || s.shots.some(sh => sh.prompt.trim())));
    if (!hasContent) return;
    if (isLoadingProjectRef.current) {
      isLoadingProjectRef.current = false;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      doAutoSave();
    }, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [layers, scenes, studioOrientation, user, doAutoSave]);

  // New blank canvas
  const handleNewCanvas = useCallback(() => {
    setLayers([]);
    setScenes([{ id: '1', startFrame: null, endFrame: null, shots: [{ prompt: '', duration: '5' }], videos: [], selectedVideoIndex: -1, isGenerating: false, variationCount: 1 }]);
    setStudioOrientation('auto');
    setCurrentProjectIdState(null);
    setCurrentProjectId('');
  }, []);

  // Load project callback
  const handleLoadProject = useCallback((loadedLayers: Layer[], projectId: string, loadedScenes?: Scene[], loadedOrientation?: 'auto' | 'horizontal' | 'vertical') => {
    isLoadingProjectRef.current = true;
    setLayers(loadedLayers);
    if (loadedScenes && loadedScenes.length > 0) {
      setScenes(loadedScenes);
    } else {
      setScenes([{ id: '1', startFrame: null, endFrame: null, shots: [{ prompt: '', duration: '5' }], videos: [], selectedVideoIndex: -1, isGenerating: false, variationCount: 1 }]);
    }
    setStudioOrientation(loadedOrientation || 'auto');
    setCurrentProjectIdState(projectId);
    setCurrentProjectId(projectId);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          username: firebaseUser.displayName || firebaseUser.email || 'User'
        });

        // Initialize user credits on the server (creates doc if first login)
        try {
          const getCredits = httpsCallable(functions, 'getUserCredits');
          const result = await getCredits();
          const data = result.data as any;
          setCredits(data.credits);
        } catch (error) {
          console.error("Error fetching credits:", error);
          setCredits(0);
        }

        // Listen to credit changes in real-time
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const unsubCredits = onSnapshot(userDocRef, (snapshot) => {
          if (snapshot.exists()) {
            setCredits(snapshot.data().credits ?? 0);
          }
        });

        // Store the unsubscribe to clean up on logout
        (window as any).__unsubCredits = unsubCredits;
      } else {
        setUser(null);
        setCredits(null);
        // Clean up credits listener
        if ((window as any).__unsubCredits) {
          (window as any).__unsubCredits();
          (window as any).__unsubCredits = null;
        }
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div className="h-[100dvh] w-screen flex items-center justify-center bg-[#0f0f12]">
        <div className="animate-pulse text-purple-400 text-lg font-medium">Carregando...</div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return (
      <div className="h-[100dvh] w-screen flex items-center justify-center bg-[#0f0f12]">
        <div className="bg-[#1f1f23] p-10 rounded-2xl border border-white/10 w-full max-w-md shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <Zap size={32} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Visualizae 3.0</h1>
          <p className="text-gray-400 mb-8 text-sm">Faça login para continuar</p>

          <button
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white hover:bg-gray-100 text-gray-800 rounded-xl text-sm font-semibold transition-colors shadow-lg"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
              <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.26c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9.003 18z" fill="#34A853" />
              <path d="M3.964 10.712A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.33z" fill="#FBBC05" />
              <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.428 0 9.002 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335" />
            </svg>
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-[#18181b] overflow-hidden">

      {/* Global Navigation Bar */}
      <div className="h-12 bg-[#0f0f12] border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-50">

        <div className="w-48 flex items-center gap-1">
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-purple-400 hover:bg-white/5 rounded-lg text-xs font-medium transition-all"
            title="Projetos Recentes"
          >
            <History size={14} />
            Histórico
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('canvas')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'canvas'
              ? 'bg-[#1f1f23] text-purple-400 shadow-inner'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
          >
            <Layers size={16} />
            Canvas Mode
          </button>

          <div className="w-px h-6 bg-white/5 mx-2"></div>

          <button
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'studio'
              ? 'bg-[#1f1f23] text-blue-400 shadow-inner'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
          >
            <Clapperboard size={16} />
            Studio Mode
          </button>
        </div>

        <div className="w-48 flex justify-end items-center gap-3">
          {/* Credits Display */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1f1f23] rounded-lg border border-white/5" title="Créditos restantes">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-xs font-semibold text-yellow-400 tabular-nums">
              {credits !== null ? credits.toLocaleString('pt-BR') : '...'}
            </span>
          </div>

          <span className="text-xs text-gray-400 truncate max-w-[100px]" title={user.username}>
            {user.username}
          </span>
          <button
            onClick={handleLogout}
            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-md transition-colors"
            title="Sair"
          >
            <LogOut size={16} />
          </button>
        </div>

      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === 'canvas' ? (
          <CanvasMode
            user={user}
            layers={layers}
            setLayers={setLayers}
            onAutoSave={() => { }}
          />
        ) : (
          <StudioMode
            canvasLayers={layers}
            scenes={scenes}
            setScenes={setScenes}
            orientation={studioOrientation}
            setOrientation={setStudioOrientation}
          />
        )}
      </div>

      {/* Project History Panel */}
      <ProjectHistoryPanel
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        userId={user.id}
        onLoadProject={handleLoadProject}
        onNewCanvas={handleNewCanvas}
      />

    </div>
  );
};

export default App;

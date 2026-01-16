import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  User, 
  ClipboardList, 
  LogOut,
  RefreshCw
} from 'lucide-react';

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyApKuDndhETHEugLo6Na_dMjJD9qN0WtEM",
  authDomain: "auditoria-checklist-2eab4.firebaseapp.com",
  projectId: "auditoria-checklist-2eab4",
  storageBucket: "auditoria-checklist-2eab4.firebasestorage.app",
  messagingSenderId: "27682485010",
  appId: "1:27682485010:web:29e9784f33d76a628c79cb"
};

// Inicializa o Firebase com suas chaves
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Um ID para sua lista de auditoria
const appId = "auditoria-checklist";
const COLLECTION_NAME = 'audit_tasks_shared';

export default function AuditApp() {
  const [user, setUser] = useState(null);
  const [auditorName, setAuditorName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Autenticação Anônima
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Auth error:", err);
        setError("Erro na autenticação. Verifique se a Autenticação Anônima está ativada no console do Firebase.");
      }
    };
    
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Tenta recuperar o nome da sessão se já tiver entrado antes
      const savedName = sessionStorage.getItem('auditorName');
      if (savedName) {
        setAuditorName(savedName);
        setHasJoined(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Sincronização em Tempo Real (Banco de Dados)
  useEffect(() => {
    if (!user) return;

    // Conecta na coleção específica do seu projeto
    const q = collection(db, 'auditorias', appId, 'tarefas');

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const fetchedTasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Ordena por data de criação
        fetchedTasks.sort((a, b) => {
            const tA = a.createdAt?.seconds || 0;
            const tB = b.createdAt?.seconds || 0;
            return tA - tB;
        });

        setTasks(fetchedTasks);
        setLoading(false);
      },
      (err) => {
        console.error("Firestore error:", err);
        if (err.code === 'permission-denied') {
             setError("Erro de permissão. Verifique se as Regras de Segurança do Firestore estão em 'modo de teste' ou públicas.");
        } else {
             setError("Erro ao carregar tarefas. Verifique sua conexão.");
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // --- Ações do Usuário ---

  const handleJoin = (e) => {
    e.preventDefault();
    if (auditorName.trim()) {
      sessionStorage.setItem('auditorName', auditorName);
      setHasJoined(true);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;

    try {
      const taskRef = collection(db, 'auditorias', appId, 'tarefas');
      await addDoc(taskRef, {
        text: newTaskText,
        completed: false,
        completedBy: null,
        createdAt: serverTimestamp()
      });
      setNewTaskText('');
    } catch (err) {
      console.error("Error adding task:", err);
      alert("Erro ao adicionar tarefa. " + err.message);
    }
  };

  const handleToggleTask = async (task) => {
    try {
      const taskRef = doc(db, 'auditorias', appId, 'tarefas', task.id);
      
      // Se não estava completo, marca como completo pelo usuário atual
      // Se estava completo, desmarca (reseta)
      const newStatus = !task.completed;
      
      await updateDoc(taskRef, {
        completed: newStatus,
        completedBy: newStatus ? auditorName : null,
        completedAt: newStatus ? serverTimestamp() : null
      });
    } catch (err) {
      console.error("Error toggling task:", err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Tem certeza que deseja remover este item da lista padrão?")) return;
    try {
      const taskRef = doc(db, 'auditorias', appId, 'tarefas', taskId);
      await deleteDoc(taskRef);
    } catch (err) {
      console.error("Error deleting task:", err);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('auditorName');
    setHasJoined(false);
    setAuditorName('');
  };

  // --- Mensagens de Erro ---
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-red-600 p-4 text-center">
        <div>
            <p className="font-bold mb-2">Ops, algo deu errado:</p>
            <p>{error}</p>
        </div>
      </div>
    );
  }

  // --- Tela 1: Login / Identificação ---
  if (!hasJoined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-slate-200">
          <div className="flex justify-center mb-6 text-blue-600">
            <ClipboardList size={64} />
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-2">Auditoria Colaborativa</h1>
          <p className="text-slate-500 text-center mb-6">Entre para sincronizar tarefas com sua equipe.</p>
          
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Seu Nome / Identificação</label>
              <div className="relative">
                <User className="absolute left-3 top-3 text-slate-400" size={18} />
                <input
                  type="text"
                  required
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="Ex: João Silva"
                  value={auditorName}
                  onChange={(e) => setAuditorName(e.target.value)}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={!user}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {user ? 'Acessar Lista' : 'Conectando ao sistema...'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Tela 2: Checklist ---
  const completedCount = tasks.filter(t => t.completed).length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20">
      
      {/* Cabeçalho */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <ClipboardList size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Lista de Retorno</h1>
              <p className="text-xs text-slate-500">Sincronizado em tempo real</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{auditorName}</p>
              <p className="text-xs text-green-600 flex items-center justify-end gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Online
              </p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        
        {/* Barra de Progresso */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-medium text-slate-600">Progresso da Auditoria</span>
            <span className="text-2xl font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="mt-2 text-xs text-slate-500 text-right">
            {completedCount} de {tasks.length} itens verificados
          </div>
        </div>

        {/* Adicionar Nova Tarefa */}
        <form onSubmit={handleAddTask} className="mb-8 relative">
          <input
            type="text"
            value={newTaskText}
            onChange={(e) => setNewTaskText(e.target.value)}
            placeholder="Adicionar nova verificação à lista..."
            className="w-full pl-4 pr-14 py-3 rounded-xl shadow-sm border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
          />
          <button 
            type="submit"
            className="absolute right-2 top-2 bottom-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
            disabled={!newTaskText.trim()}
          >
            <Plus size={20} />
          </button>
        </form>

        {/* Lista de Tarefas */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-10 text-slate-400 flex flex-col items-center">
              <RefreshCw className="animate-spin mb-2" />
              <p>Sincronizando lista...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-xl border border-dashed border-slate-300">
              <p className="text-slate-500 mb-1">Nenhuma tarefa na lista.</p>
              <p className="text-sm text-slate-400">Adicione itens para começar a auditoria.</p>
            </div>
          ) : (
            tasks.map((task) => (
              <div 
                key={task.id} 
                className={`
                  group flex items-start gap-4 p-4 rounded-xl border transition-all duration-200
                  ${task.completed 
                    ? 'bg-blue-50 border-blue-100' 
                    : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                  }
                `}
              >
                <button
                  onClick={() => handleToggleTask(task)}
                  className={`
                    mt-1 flex-shrink-0 transition-colors
                    ${task.completed ? 'text-blue-600' : 'text-slate-300 group-hover:text-blue-400'}
                  `}
                >
                  {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                </button>

                <div className="flex-grow pt-0.5">
                  <p className={`
                    text-base transition-all
                    ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800 font-medium'}
                  `}>
                    {task.text}
                  </p>
                  
                  {task.completed && task.completedBy && (
                    <p className="text-xs text-blue-600 mt-1 font-medium flex items-center gap-1">
                      <User size={10} />
                      Verificado por {task.completedBy}
                    </p>
                  )}
                </div>

                <button 
                  onClick={() => handleDeleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all"
                  title="Remover item"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}

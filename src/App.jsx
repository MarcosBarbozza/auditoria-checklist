import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  serverTimestamp,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  User, 
  ClipboardList, 
  LogOut,
  ArrowLeft,
  Factory,
  LayoutDashboard,
  Calendar,
  Clock
} from 'lucide-react';

// --- CONFIGURAÇÃO DO FIREBASE (CHAVES RESTAURADAS) ---
const firebaseConfig = {
  apiKey: "AIzaSyApKuDndhETHEugLo6Na_dMjJD9qN0WtEM",
  authDomain: "auditoria-checklist-2eab4.firebaseapp.com",
  projectId: "auditoria-checklist-2eab4",
  storageBucket: "auditoria-checklist-2eab4.firebasestorage.app",
  messagingSenderId: "27682485010",
  appId: "1:27682485010:web:29e9784f33d76a628c79cb"
};

// --- MODELOS DE AUDITORIA (EDITE AQUI PARA ADICIONAR MAIS) ---
const AUDIT_TEMPLATES = {
  'Vidro Temperado': [
    'Relatório de auditoria',
    'Formulário de coleta',
    'Preenchimento Lista Mestra',
    'Foto coleta na pasta',
    'Foto auditoria'
  ],
  'Vidro Laminado': [
    'Relatório de auditoria',
    'Verificação de Polivinil',
    'Autoclave Teste',
    'Foto coleta na pasta'
  ],
  'Padrão Geral': [
    'Documentação Inicial',
    'Fotos do Local',
    'Relatório Final'
  ]
};

// Inicialização Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = "auditoria-v2"; // Identificador da versão do app

export default function AuditApp() {
  const [user, setUser] = useState(null);
  const [auditorName, setAuditorName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  
  // Estados de Navegação
  const [view, setView] = useState('dashboard'); // 'dashboard' ou 'audit'
  const [selectedAudit, setSelectedAudit] = useState(null);

  // Estados de Dados
  const [audits, setAudits] = useState([]);
  const [tasks, setTasks] = useState([]);
  
  // Estados de Formulário
  const [newManufacturer, setNewManufacturer] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Vidro Temperado');
  const [newTaskText, setNewTaskText] = useState('');

  // 0. Correção de Layout e Responsividade (CSS Global e Tailwind)
  useEffect(() => {
    // Injeta Tailwind CSS
    if (!document.getElementById('tailwind-cdn')) {
      const script = document.createElement('script');
      script.id = 'tailwind-cdn';
      script.src = "https://cdn.tailwindcss.com";
      document.head.appendChild(script);
    }

    // Injeta Estilos Globais para garantir Full Width/Height (Tela Cheia)
    if (!document.getElementById('global-styles')) {
      const style = document.createElement('style');
      style.id = 'global-styles';
      style.innerHTML = `
        html, body, #root {
          width: 100%;
          min-height: 100%;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        /* Ajuste fino para inputs no mobile não darem zoom */
        input, select, textarea {
          font-size: 16px !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Garante Meta Tag Viewport para Responsividade Mobile
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = "viewport";
      meta.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
      document.head.appendChild(meta);
    }
  }, []);

  // 1. Autenticação
  useEffect(() => {
    signInAnonymously(auth).catch((err) => console.error("Erro Auth:", err));
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      const savedName = sessionStorage.getItem('auditorName');
      if (savedName) {
        setAuditorName(savedName);
        setHasJoined(true);
      }
    });
  }, []);

  // 2. Carregar Lista de Auditorias (Dashboard)
  useEffect(() => {
    if (!user) return;
    
    // Busca a coleção de auditorias
    const q = query(
      collection(db, 'auditorias_v2', appId, 'lista_auditorias'), 
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAudits(data);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. Carregar Tarefas da Auditoria Selecionada
  useEffect(() => {
    if (!user || !selectedAudit) return;

    // Busca a sub-coleção de tarefas dentro da auditoria selecionada
    const q = query(
        collection(db, 'auditorias_v2', appId, 'lista_auditorias', selectedAudit.id, 'tarefas'),
        orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTasks(data);
    });

    return () => unsubscribe();
  }, [selectedAudit, user]);


  // --- FUNÇÕES ---

  // Auxiliar para formatar data do Firestore
  const formatDate = (timestamp) => {
    if (!timestamp) return '...';
    // Converte timestamp do Firestore para objeto Date JS
    // Pode vir como objeto {seconds, nanoseconds} ou null se for pendente
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (auditorName.trim()) {
      sessionStorage.setItem('auditorName', auditorName);
      setHasJoined(true);
    }
  };

  // Criar Nova Auditoria (Com Template Automático)
  const handleCreateAudit = async (e) => {
    e.preventDefault();
    if (!newManufacturer.trim()) return;

    try {
      // 1. Cria a Auditoria Pai
      const auditRef = await addDoc(collection(db, 'auditorias_v2', appId, 'lista_auditorias'), {
        manufacturer: newManufacturer,
        category: selectedCategory,
        createdBy: auditorName,
        createdAt: serverTimestamp(),
        progress: 0
      });

      // 2. Cria as tarefas padrão baseadas na categoria (Batch Write para ser rápido)
      const batch = writeBatch(db);
      const tasksToCreate = AUDIT_TEMPLATES[selectedCategory] || AUDIT_TEMPLATES['Padrão Geral'];

      tasksToCreate.forEach((taskText) => {
        const newTaskRef = doc(collection(db, 'auditorias_v2', appId, 'lista_auditorias', auditRef.id, 'tarefas'));
        batch.set(newTaskRef, {
          text: taskText,
          completed: false,
          completedBy: null,
          createdAt: serverTimestamp() // Nota: Em batch todos terão mesmo timestamp, ordem pode variar levemente
        });
      });

      await batch.commit();

      setNewManufacturer('');
      alert(`Auditoria para ${newManufacturer} criada com sucesso!`);
    } catch (err) {
      console.error("Erro ao criar:", err);
      alert("Erro ao criar auditoria.");
    }
  };

  // Atualizar Progresso no Pai
  const updateAuditProgress = async (auditId, currentTasks) => {
    if (!currentTasks || currentTasks.length === 0) return;
    
    const completed = currentTasks.filter(t => t.completed).length;
    const total = currentTasks.length;
    const percentage = Math.round((completed / total) * 100);

    const auditRef = doc(db, 'auditorias_v2', appId, 'lista_auditorias', auditId);
    await updateDoc(auditRef, {
      progress: percentage
    });
  };

  // Marcar Tarefa
  const handleToggleTask = async (task) => {
    try {
      const taskRef = doc(db, 'auditorias_v2', appId, 'lista_auditorias', selectedAudit.id, 'tarefas', task.id);
      const newStatus = !task.completed;
      
      await updateDoc(taskRef, {
        completed: newStatus,
        completedBy: newStatus ? auditorName : null,
        completedAt: newStatus ? serverTimestamp() : null
      });

      // Atualiza visualmente o progresso local (o Firestore atualizaria, mas isso garante responsividade)
      // O useEffect vai disparar e calcular o progresso real para salvar no banco
      const updatedTasks = tasks.map(t => t.id === task.id ? {...t, completed: newStatus} : t);
      updateAuditProgress(selectedAudit.id, updatedTasks);

    } catch (err) {
      console.error("Erro:", err);
    }
  };

  // Adicionar tarefa extra manual
  const handleAddManualTask = async (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    try {
      await addDoc(collection(db, 'auditorias_v2', appId, 'lista_auditorias', selectedAudit.id, 'tarefas'), {
        text: newTaskText,
        completed: false,
        createdAt: serverTimestamp()
      });
      setNewTaskText('');
      // Atualiza progresso
      updateAuditProgress(selectedAudit.id, [...tasks, { completed: false }]); 
    } catch (err) { console.error(err); }
  };

  // Excluir Auditoria Inteira
  const handleDeleteAudit = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Isso apagará a auditoria e todas as tarefas dela. Continuar?")) return;
    try {
      await deleteDoc(doc(db, 'auditorias_v2', appId, 'lista_auditorias', id));
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('auditorName');
    setHasJoined(false);
  };

  // --- INTERFACE ---

  // Tela de Login
  if (!hasJoined) {
    return (
      <div className="flex items-center justify-center min-h-screen w-full bg-emerald-50 p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full border border-emerald-100">
          <div className="flex justify-center mb-6 text-emerald-600">
            <ClipboardList size={64} />
          </div>
          <h1 className="text-2xl font-bold text-center text-emerald-900 mb-2">Portal de Auditoria</h1>
          <p className="text-emerald-600 text-center mb-6">Identifique-se para acessar o sistema.</p>
          <form onSubmit={handleJoin} className="space-y-4">
            <input
              type="text"
              required
              className="w-full p-3 text-base border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
              placeholder="Seu Nome"
              value={auditorName}
              onChange={(e) => setAuditorName(e.target.value)}
            />
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg transition-colors">
              Entrar no Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Tela Principal (Dashboard vs Detalhes)
  return (
    <div className="min-h-screen w-full bg-emerald-50 font-sans text-slate-800 overflow-x-hidden">
      
      {/* Header Verde - W-FULL e PADDING ajustado para mobile */}
      <header className="bg-emerald-700 text-white shadow-md sticky top-0 z-20">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 overflow-hidden">
            {view === 'audit' ? (
              <button onClick={() => { setView('dashboard'); setSelectedAudit(null); }} className="hover:bg-emerald-600 p-1 rounded-full transition flex-shrink-0">
                <ArrowLeft size={24} />
              </button>
            ) : (
              <LayoutDashboard size={24} className="flex-shrink-0" />
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight truncate max-w-[200px] md:max-w-none">
                {view === 'audit' ? selectedAudit?.manufacturer : 'Painel de Auditorias'}
              </h1>
              <p className="text-xs text-emerald-100 opacity-80 truncate">
                {view === 'audit' ? selectedAudit?.category : `Olá, ${auditorName}`}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-emerald-100 hover:text-white flex-shrink-0 ml-2">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main - W-FULL e PADDING ajustado */}
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        
        {/* VIEW: DASHBOARD (LISTA DE AUDITORIAS) */}
        {view === 'dashboard' && (
          <div className="space-y-8">
            
            {/* Card para Criar Nova Auditoria */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-emerald-100">
              <h2 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
                <Plus size={20} /> Nova Auditoria
              </h2>
              <form onSubmit={handleCreateAudit} className="flex flex-col md:flex-row gap-4">
                <div className="flex-grow">
                  <label className="text-xs font-bold text-emerald-600 uppercase mb-1 block">Fabricante</label>
                  <input
                    type="text"
                    required
                    placeholder="Nome da empresa..."
                    className="w-full p-3 text-base bg-emerald-50 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={newManufacturer}
                    onChange={(e) => setNewManufacturer(e.target.value)}
                  />
                </div>
                <div className="md:w-1/3">
                  <label className="text-xs font-bold text-emerald-600 uppercase mb-1 block">Categoria</label>
                  <select 
                    className="w-full p-3 text-base bg-emerald-50 border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none appearance-none"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {Object.keys(AUDIT_TEMPLATES).map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="submit" className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-sm">
                    Iniciar
                  </button>
                </div>
              </form>
            </div>

            {/* Lista de Auditorias em Andamento */}
            <div>
              <h3 className="text-emerald-900 font-bold mb-4 ml-1">Auditorias em Andamento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                {audits.length === 0 ? (
                  <p className="text-slate-400 italic ml-1">Nenhuma auditoria iniciada.</p>
                ) : (
                  audits.map(audit => (
                    <div 
                      key={audit.id}
                      onClick={() => { setSelectedAudit(audit); setView('audit'); }}
                      className="bg-white p-4 sm:p-5 rounded-xl border border-emerald-100 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer group relative"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3 w-full">
                          <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700 flex-shrink-0">
                            <Factory size={20} />
                          </div>
                          <div className="min-w-0 flex-grow">
                            <h4 className="font-bold text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                              {audit.manufacturer}
                            </h4>
                            <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full inline-block truncate max-w-full">
                              {audit.category}
                            </span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => handleDeleteAudit(audit.id, e)}
                          className="text-slate-300 hover:text-red-500 p-2 transition-colors flex-shrink-0"
                          title="Apagar auditoria"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      {/* Barra de Progresso Mini */}
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-1">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${audit.progress || 0}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-slate-500">
                        <span>Progresso</span>
                        <span className="font-bold text-emerald-600">{audit.progress || 0}%</span>
                      </div>
                      <div className="mt-3 text-xs text-slate-400 border-t border-slate-50 pt-2 flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          <User size={12} /> Iniciado por {audit.createdBy}
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={12} /> {formatDate(audit.createdAt)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* VIEW: AUDIT DETAILS (CHECKLIST) */}
        {view === 'audit' && selectedAudit && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* Status Card */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-emerald-100 mb-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="min-w-0 w-full text-center md:text-left">
                <h2 className="text-xl font-bold text-slate-800 truncate">{selectedAudit.manufacturer}</h2>
                <p className="text-emerald-600 font-medium">{selectedAudit.category}</p>
                <p className="text-xs text-slate-400 mt-1 flex items-center justify-center md:justify-start gap-1">
                  <Clock size={12} /> Criado em {formatDate(selectedAudit.createdAt)}
                </p>
              </div>
              
              <div className="w-full md:w-1/3 text-center md:text-right flex-shrink-0">
                <div className="text-3xl font-bold text-emerald-600 mb-1">
                  {Math.round((tasks.filter(t => t.completed).length / (tasks.length || 1)) * 100)}%
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-3 rounded-full transition-all duration-300" 
                    style={{ width: `${Math.round((tasks.filter(t => t.completed).length / (tasks.length || 1)) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {tasks.filter(t => t.completed).length} de {tasks.length} itens concluídos
                </p>
              </div>
            </div>

            {/* Lista de Tarefas */}
            <div className="space-y-3 mb-8">
              {tasks.map((task) => (
                <div 
                  key={task.id} 
                  className={`
                    flex items-start gap-4 p-4 rounded-xl border transition-all duration-200 cursor-pointer
                    ${task.completed 
                      ? 'bg-emerald-50 border-emerald-200' 
                      : 'bg-white border-slate-200 hover:border-emerald-300 hover:shadow-md'
                    }
                  `}
                  onClick={() => handleToggleTask(task)}
                >
                  <div className={`mt-1 flex-shrink-0 transition-colors ${task.completed ? 'text-emerald-600' : 'text-slate-300'}`}>
                    {task.completed ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                  </div>

                  <div className="flex-grow pt-0.5">
                    <p className={`text-base font-medium transition-all ${task.completed ? 'text-emerald-800 line-through opacity-70' : 'text-slate-800'}`}>
                      {task.text}
                    </p>
                    {task.completed && task.completedBy && (
                      <div className="text-xs text-emerald-600 mt-1 font-medium flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="flex items-center gap-1"><User size={12} /> Validado por {task.completedBy}</span>
                        {task.completedAt && (
                           <span className="flex items-center gap-1 opacity-80 border-l border-emerald-200 pl-2"><Clock size={12} /> em {formatDate(task.completedAt)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Adicionar Item Extra */}
            <div className="border-t border-slate-200 pt-6">
              <h4 className="text-sm font-bold text-slate-500 uppercase mb-3">Itens Adicionais / Observações</h4>
              <form onSubmit={handleAddManualTask} className="flex gap-2">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="Adicionar tarefa extra..."
                  className="flex-grow p-3 text-base bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
                <button 
                  type="submit"
                  disabled={!newTaskText.trim()}
                  className="bg-slate-800 hover:bg-slate-900 text-white p-3 rounded-lg transition-colors"
                >
                  <Plus size={20} />
                </button>
              </form>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
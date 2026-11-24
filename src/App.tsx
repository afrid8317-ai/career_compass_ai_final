import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, clearAccessToken, saveAccessToken, type ApiUser, type OAuthProviders, type CollegeMatch, type RoadmapTask, type Career } from './api';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Atom, BookOpen, BrainCircuit, BriefcaseBusiness, Check, ChevronDown, ChevronLeft, ChevronRight, Compass, GraduationCap, Heart, Languages, Menu, Search, ShieldCheck, Sparkles, Target, TrendingUp, X } from 'lucide-react';
import CollegeResults from './CollegeResults';
import { LocalizedMarkup, type Language } from './i18n';

const ExtraPages = lazy(() => import('./ExtraPages'));
type Page = 'home' | 'careers' | 'colleges' | 'dashboard' | 'features' | 'assistant' | 'resume' | 'jobs' | 'progress' | 'settings' | 'admin' | 'graph' | 'ideas' | 'careerDetail' | 'privacy' | 'terms' | 'sources';
const careers = [
  { title: 'Software Engineer', group: 'Technology', icon: '⌘', fit: 'Problem-solving · Building products', skills: ['Python', 'Data structures', 'Git'], study: 'B.E./B.Tech CSE, BCA, or related pathways' },
  { title: 'Data Analyst', group: 'Data & Analytics', icon: '▥', fit: 'Patterns · Evidence · Decisions', skills: ['SQL', 'Spreadsheets', 'Statistics'], study: 'Any quantitative degree plus practical analytics projects' },
  { title: 'UX/UI Designer', group: 'Design', icon: '✳', fit: 'Empathy · Visual thinking · Research', skills: ['Figma', 'Prototyping', 'User research'], study: 'Design, HCI, or a portfolio-led pathway' },
  { title: 'Cybersecurity Analyst', group: 'Technology', icon: '⌑', fit: 'Investigation · Systems · Risk', skills: ['Networking', 'Linux', 'Security basics'], study: 'Computer science or IT with hands-on security labs' },
  { title: 'Product Manager', group: 'Business & Product', icon: '◈', fit: 'Strategy · Communication · Prioritization', skills: ['Product thinking', 'Analytics', 'Writing'], study: 'Multiple degree routes; build evidence through projects' },
  { title: 'Healthcare Professional', group: 'Healthcare', icon: '✚', fit: 'Service · Science · People', skills: ['Biology', 'Communication', 'Clinical knowledge'], study: 'Requires the relevant accredited healthcare qualification' },
  { title: 'Mechanical Engineer', group: 'Engineering', icon: '⚙', fit: 'Systems · Design · Physical problem-solving', skills: ['CAD', 'Mechanics', 'Manufacturing'], study: 'B.E./B.Tech Mechanical or a related accredited program' },
  { title: 'Content Strategist', group: 'Business & Product', icon: '✎', fit: 'Writing · Audience insight · Storytelling', skills: ['Writing', 'SEO basics', 'Research'], study: 'Portfolio and communication skills matter across degree routes' },
  { title: 'Sports Data Analyst', group: 'Sports Careers', icon: '◉', fit: 'Statistics · Performance · Sport', skills: ['Statistics', 'Data visualization', 'Sports knowledge'], study: 'Build data projects and explore sports analytics roles' },
  { title: 'Sports Physiotherapist', group: 'Sports Careers', icon: '✚', fit: 'Movement · Rehabilitation · Athlete support', skills: ['Anatomy', 'Rehabilitation', 'Communication'], study: 'Requires the relevant accredited healthcare qualification' },
  { title: 'Sports Coach', group: 'Sports Careers', icon: '↗', fit: 'Training · Communication · Development', skills: ['Coaching', 'Planning', 'Sport-specific knowledge'], study: 'Investigate sport-specific qualifications and supervised experience' },
  { title: 'Entrepreneur', group: 'Business Ideas', icon: '◇', fit: 'Customer problems · Experiments · Business', skills: ['Customer discovery', 'Budgeting', 'Communication'], study: 'Start with customer research and small low-cost experiments' },
];
const careerVisuals: Record<string, string> = {
  Technology: '/images/technology-coding.jpg',
  'Data & Analytics': '/images/technology-coding.jpg',
  Design: '/images/design-workshop.jpg',
  'Business & Product': '/images/career-planning.jpg',
  Healthcare: '/images/medical-students.jpg',
  Engineering: '/images/engineering-lab.jpg',
  'Sports Careers': '/images/sports-career.jpg',
  'Business Ideas': '/images/career-planning.jpg',
};
const careerVisualFor = (group: string) => careerVisuals[group] || '/images/career-planning.jpg';
const faqs = [
  ['Is CareerCompass AI a final career decision-maker?', 'No. It is a structured exploration tool. Recommendations are starting points to research and discuss with teachers, counsellors, and people working in the field.'],
  ['Does the assessment guarantee a job or admission?', 'No. It cannot guarantee admission, employment, salary, or future outcomes. Admissions depend on current official rules, scores, seat availability, category, and other factors.'],
  ['Are college cutoffs live and verified?', 'Not in this demo. The college exploration screen explains the information needed, but live cutoff predictions require a verified, year-specific dataset and official-source checks.'],
  ['Can I use CareerCompass after 10th or 12th?', 'Yes. The product is designed to help students explore options after 10th, after 12th, during college, and while preparing for internships or jobs.'],
];
const questions = [
  { dimension: 'Realistic', q: 'I enjoy building, repairing, or assembling practical things.' },
  { dimension: 'Investigative', q: 'I enjoy analysing information to understand why something happens.' },
  { dimension: 'Artistic', q: 'I enjoy creating original ideas, visuals, stories, or experiences.' },
  { dimension: 'Social', q: 'I enjoy helping others learn, solve problems, or feel supported.' },
  { dimension: 'Enterprising', q: 'I enjoy persuading people, taking initiative, or leading a project.' },
  { dimension: 'Conventional', q: 'I enjoy organising information and following a clear process.' },
  { dimension: 'Investigative', q: 'I like exploring evidence before forming a conclusion.' },
  { dimension: 'Realistic', q: 'I prefer hands-on tasks where I can see a practical result.' },
  { dimension: 'Social', q: 'I feel energised when collaborating closely with people.' },
  { dimension: 'Artistic', q: 'I like having freedom to experiment with different approaches.' },
  { dimension: 'Conventional', q: 'I notice details and like keeping records accurate.' },
  { dimension: 'Enterprising', q: 'I like presenting an idea and getting others interested in it.' },
  { dimension: 'Realistic', q: 'I am interested in tools, devices, machines, or physical systems.' },
  { dimension: 'Artistic', q: 'I like expressing myself through design, writing, music, or media.' },
  { dimension: 'Investigative', q: 'I enjoy solving complex questions that do not have an obvious answer.' },
  { dimension: 'Conventional', q: 'I like planning schedules, sorting data, or managing structured tasks.' },
  { dimension: 'Enterprising', q: 'I am comfortable making decisions when a group needs direction.' },
  { dimension: 'Social', q: 'I enjoy listening carefully and understanding different perspectives.' },
  { dimension: 'Artistic', q: 'I like improving how something looks, feels, or communicates.' },
  { dimension: 'Realistic', q: 'I learn well by trying something out instead of only reading about it.' },
  { dimension: 'Conventional', q: 'I prefer clear expectations and a reliable way to track progress.' },
  { dimension: 'Social', q: 'I enjoy explaining a difficult idea in a way others can understand.' },
  { dimension: 'Enterprising', q: 'I enjoy setting goals and finding ways to move a plan forward.' },
  { dimension: 'Investigative', q: 'I enjoy comparing possibilities and testing which explanation fits best.' },
].map(item => ({ ...item, opts: ['Not at all like me', 'A little like me', 'Mostly like me', 'Very much like me'] }));
const careerInterestMap: Record<string,string[]> = {
  'Software Engineer':['Investigative','Conventional'], 'Data Analyst':['Investigative','Conventional'], 'UX/UI Designer':['Artistic','Social'], 'Cybersecurity Analyst':['Investigative','Realistic','Conventional'], 'Product Manager':['Enterprising','Social','Conventional'], 'Mechanical Engineer':['Realistic','Investigative'], 'Healthcare Professional':['Social','Investigative'], 'Content Strategist':['Artistic','Enterprising','Social'], 'Sports Data Analyst':['Investigative','Realistic'], 'Sports Physiotherapist':['Social','Realistic'], 'Sports Coach':['Social','Enterprising'], 'Entrepreneur':['Enterprising','Artistic']
};
function localCareerRecommendations(scores: Record<string,number>) {
  return careers.map(c => { const dimensions=careerInterestMap[c.title]||[]; const alignment_index=dimensions.length?Math.round(dimensions.reduce((total,d)=>total+(scores[d]||0),0)/(12*dimensions.length)*100):0; return {career_id:c.title.toLowerCase().replace(/[^a-z0-9]+/g,'-'),title:c.title,category:c.group,alignment_index,mapped_dimensions:dimensions,explanation:`This starter profile is mapped to ${dimensions.join(', ')}. Compare the role's actual tasks and requirements before deciding whether it fits.`}; }).filter(c=>c.mapped_dimensions.length).sort((a,b)=>b.alignment_index-a.alignment_index).slice(0,5);
}

const engineeringCourseOptions = [
  'Computer Science and Engineering',
  'Information Science and Engineering',
  'Artificial Intelligence and Machine Learning',
  'Artificial Intelligence and Data Science',
  'Data Science',
  'Cyber Security',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biotechnology',
  'Chemical Engineering',
  'Electronics and Instrumentation Engineering',
  'Robotics and Automation',
  'Aeronautical Engineering',
];

function App() {
  const pageFromPath = (path: string): Page => { const p = path.replace(/\/$/, '') || '/'; if (p === '/features') return 'features'; if (p === '/careers') return 'careers'; if (p.startsWith('/careers/')) return 'careerDetail'; if (p === '/colleges') return 'colleges'; if (p === '/app' || p === '/roadmap') return 'dashboard'; if (p === '/assistant') return 'assistant'; if (p === '/resume') return 'resume'; if (p === '/jobs') return 'jobs'; if (p === '/progress' || p === '/assessment/results') return 'progress'; if (p === '/settings') return 'settings'; if (p === '/admin') return 'admin'; if (p === '/career-graph') return 'graph'; if (p === '/ideas') return 'ideas'; if (p === '/privacy') return 'privacy'; if (p === '/terms') return 'terms'; if (p === '/sources') return 'sources'; return 'home'; };
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('careercompass_language');
    return saved === 'kn' || saved === 'hi' ? saved : 'en';
  });
  const [languageMessage, setLanguageMessage] = useState('');
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [oauthProviders, setOAuthProviders] = useState<OAuthProviders | null>(null);
  const [oauthStatusUnavailable, setOAuthStatusUnavailable] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [roadmapTasks, setRoadmapTasks] = useState<RoadmapTask[]>(() => { try { const saved = localStorage.getItem('careercompass_tasks'); return saved ? JSON.parse(saved) : [{ id: -1, title: 'Choose two career paths to compare', completed: false, logged_minutes: 0, estimated_minutes: 30, created_at: new Date().toISOString() }, { id: -2, title: 'Pick one skill to practise this week', completed: false, logged_minutes: 0, estimated_minutes: 45, created_at: new Date().toISOString() }, { id: -3, title: 'Verify one course or college requirement', completed: false, logged_minutes: 0, estimated_minutes: 20, created_at: new Date().toISOString() }]; } catch { return []; } });
  const [assessmentSaveStatus, setAssessmentSaveStatus] = useState('');
  const [careerRecommendations, setCareerRecommendations] = useState<ReturnType<typeof localCareerRecommendations>>([]);
  const [recommendationStatus, setRecommendationStatus] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [assessmentDone, setAssessmentDone] = useState(false);
  const [careerSearch, setCareerSearch] = useState('');
  const [careerCatalogue, setCareerCatalogue] = useState(careers);
  const [careerFilter, setCareerFilter] = useState('All fields');
  const [savedCareers, setSavedCareers] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('careercompass_saved_careers') || '[]'); } catch { return []; } });
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [collegeExam, setCollegeExam] = useState('KCET');
  const [score, setScore] = useState('');
  const [region, setRegion] = useState('Karnataka');
  const [collegeQuota, setCollegeQuota] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [courseMenuOpen, setCourseMenuOpen] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const courseMenuRef = useRef<HTMLDivElement>(null);
  const [showCollegeNotice, setShowCollegeNotice] = useState(false);
  const [collegeApiMessage, setCollegeApiMessage] = useState('');
  const [collegeSearchBusy, setCollegeSearchBusy] = useState(false);
  const [collegeMatches, setCollegeMatches] = useState<CollegeMatch[]>([]);
  useEffect(() => {
    setScore('');
    setSelectedCourses([]);
    setCourseSearch('');
    setCourseMenuOpen(false);
    if (collegeExam === 'NEET') {
      setRegion('All India');
      setCollegeQuota('AIQ');
    } else {
      setCollegeQuota('');
      if (collegeExam === 'JEE') setRegion('All India');
      else setRegion('Karnataka');
    }
  }, [collegeExam]);
  useEffect(() => {
    const closeCourseMenu = (event: MouseEvent) => {
      if (courseMenuRef.current && !courseMenuRef.current.contains(event.target as Node)) setCourseMenuOpen(false);
    };
    document.addEventListener('mousedown', closeCourseMenu);
    return () => document.removeEventListener('mousedown', closeCourseMenu);
  }, []);
  const filteredCareers = useMemo(() => careerCatalogue.filter(c => (careerFilter === 'All fields' || c.group === careerFilter) && `${c.title} ${c.group} ${c.fit} ${c.skills.join(' ')}`.toLowerCase().includes(careerSearch.toLowerCase())), [careerCatalogue, careerFilter, careerSearch]);
  const availableCourses = useMemo(() => {
    if (collegeExam === 'NEET') return ['MBBS', 'BDS'];
    if (collegeExam === 'JEE') return engineeringCourseOptions;
    return engineeringCourseOptions;
  }, [collegeExam]);
  const filteredCourses = useMemo(
    () => availableCourses.filter(course => course.toLowerCase().includes(courseSearch.trim().toLowerCase())),
    [availableCourses, courseSearch],
  );
  const openAssessment = () => { let draft: {answers?:number[];qIndex?:number}|null = null; try { draft = JSON.parse(localStorage.getItem('careercompass_assessment_draft') || 'null'); } catch { draft = null; } setQIndex(Math.max(0, Math.min(questions.length - 1, draft?.qIndex || 0))); setAnswers(Array.isArray(draft?.answers) ? draft!.answers! : []); setAssessmentDone(false); setAssessmentOpen(true); if (window.location.pathname !== '/assessment') window.history.pushState({}, '', '/assessment'); };
  const restartAssessment = () => { localStorage.removeItem('careercompass_assessment_draft'); setQIndex(0); setAnswers([]); setAssessmentDone(false); setAssessmentSaveStatus(''); setCareerRecommendations([]); setRecommendationStatus(''); setAssessmentOpen(true); if (window.location.pathname !== '/assessment') window.history.pushState({}, '', '/assessment'); };
  const navigate = (next: Page) => { const paths: Record<Page,string> = {home:'/',features:'/features',careers:'/careers',colleges:'/colleges',dashboard:'/app',assistant:'/assistant',resume:'/resume',jobs:'/jobs',progress:'/progress',settings:'/settings',admin:'/admin',graph:'/career-graph',ideas:'/ideas',careerDetail:'/careers',privacy:'/privacy',terms:'/terms',sources:'/sources'}; setPage(next); window.history.pushState({}, '', paths[next]); setMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const navigateCareer = (id: string) => { setPage('careerDetail'); window.history.pushState({}, '', `/careers/${encodeURIComponent(id)}`); setMenuOpen(false); window.scrollTo({top:0,behavior:'smooth'}); };
  const setSiteLanguage = useCallback((value: Language) => {
    setLanguage(value);
    localStorage.setItem('careercompass_language', value);
    document.documentElement.lang = value;
  }, []);
  const changeLanguage = (value: string) => {
    if (value !== 'en' && value !== 'kn' && value !== 'hi') return;
    setSiteLanguage(value);
    setLanguageMessage('');
    if (user) {
      void api.profile().then(profile => api.updateProfile({...profile, preferred_language:value}))
        .then(() => setLanguageMessage('Language preference saved to your account.'))
        .catch(() => setLanguageMessage('Language changed on this device, but could not be saved to your account.'));
    }
  };
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  useEffect(() => {
    const path = window.location.pathname;
    if (path !== '/auth/oauth/callback') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (params.get('error')) {
      setAuthMode('login');
      setAuthOpen(true);
      setAuthError('Google sign-in was not completed. Please try again.');
      window.history.replaceState({}, '', '/');
      return;
    }
    if (token) {
      saveAccessToken(token);
      window.history.replaceState({}, '', '/');
      void api.me().then(setUser).catch(() => {
        clearAccessToken();
        setAuthMode('login');
        setAuthOpen(true);
        setAuthError('The provider sign-in completed, but the account session could not be verified. Please try again.');
      });
    }
  }, []);
  useEffect(() => {
    if (!authOpen || authMode !== 'login') return;
    let active = true;
    setOAuthProviders(null);
    setOAuthStatusUnavailable(false);
    void api.oauthProviders()
      .then(providers => { if (active) setOAuthProviders(providers); })
      .catch(() => { if (active) setOAuthStatusUnavailable(true); });
    return () => { active = false; };
  }, [authOpen, authMode]);
  const finishAssessment = async () => {
    setAssessmentDone(true);
    localStorage.removeItem('careercompass_assessment_draft');
    localStorage.setItem('careercompass_latest_assessment', JSON.stringify({version:'riasec-24-v1',answers,scores:riasecScores,title:resultTitle,created_at:new Date().toISOString()}));
    setCareerRecommendations(localCareerRecommendations(riasecScores));
    setRecommendationStatus('Local fallback · curated interest mapping, not a validated prediction.');
    try { const recommendationResult = await api.recommendCareers(riasecScores); setCareerRecommendations(recommendationResult.results); setRecommendationStatus(recommendationResult.method); } catch { /* The local explainable fallback remains available without the API. */ }
    setAssessmentSaveStatus('');
    if (user) {
      try { await api.saveAssessment(answers, 'riasec-24-v1'); setAssessmentSaveStatus('Saved to your account.'); }
      catch { setAssessmentSaveStatus('Could not sync this result. Please check that the API is running and sign in again if needed.'); }
    } else {
      setAssessmentSaveStatus('Sign in to save this reflection to your account.');
    }
  };
  useEffect(() => { localStorage.setItem('careercompass_saved_careers', JSON.stringify(savedCareers)); }, [savedCareers]);
  useEffect(() => { if (page !== 'careers') return; api.careers().then((rows: Career[]) => setCareerCatalogue(rows.map(item => { const local = careers.find(c => c.title === item.title); return { title:item.title, group:item.category, icon:local?.icon || '◇', fit:item.summary, skills:item.skills, study:local?.study || 'Review current accredited education and training requirements for this role.' }; }))).catch(() => { /* The curated in-app catalogue remains available when the API is offline. */ }); }, [page]);
  useEffect(() => { const onPop = () => { const p = window.location.pathname; setPage(pageFromPath(p)); if (p === '/assessment' || p === '/login' || p === '/register') { if (p !== '/assessment') setAuthMode(p === '/register' ? 'register' : 'login'); if (p === '/assessment') openAssessment(); else setAuthOpen(true); } else { setAssessmentOpen(false); setAuthOpen(false); } }; window.addEventListener('popstate', onPop); if (window.location.pathname === '/assessment') openAssessment(); if (window.location.pathname === '/login' || window.location.pathname === '/register') { setAuthMode(window.location.pathname === '/register' ? 'register' : 'login'); setAuthOpen(true); } return () => window.removeEventListener('popstate', onPop); }, []);
  useEffect(() => { localStorage.setItem('careercompass_tasks', JSON.stringify(roadmapTasks)); }, [roadmapTasks]);
  useEffect(() => { if (!assessmentDone && answers.length) localStorage.setItem('careercompass_assessment_draft', JSON.stringify({answers,qIndex})); }, [answers,qIndex,assessmentDone]);
  useEffect(() => {
    if (!localStorage.getItem('careercompass_access_token')) return;
    api.me().then((current) => {
      setUser(current);
      api.tasks().then(setRoadmapTasks).catch(() => { /* Keep local tasks visible if the task service is temporarily unavailable. */ });
      api.bookmarks().then(rows => setSavedCareers(rows.filter(row => row.item_type === 'career').map(row => row.item_id))).catch(() => { /* Browser-local bookmarks remain available. */ });
    }).catch((error) => { if (error instanceof ApiError && error.status === 401) { clearAccessToken(); setUser(null); } });
  }, []);
  const submitAuth = async () => {
    setAuthError(''); setAuthBusy(true);
    try {
      const result = authMode === 'register'
        ? await api.register({ name: authName.trim(), email: authEmail.trim(), password: authPassword })
        : await api.login({ email: authEmail.trim(), password: authPassword });
      saveAccessToken(result.access_token); setUser(result.user); setAuthOpen(false); setAuthPassword('');
      try { setRoadmapTasks(await api.tasks()); } catch { /* keep local tasks until API is available */ }
      try { setSavedCareers((await api.bookmarks()).filter(row => row.item_type === 'career').map(row => row.item_id)); } catch { /* browser-local saved careers remain available */ }
    } catch (error) { setAuthError(error instanceof Error ? error.message : 'Could not sign in. Please try again.'); }
    finally { setAuthBusy(false); }
  };
  const signOut = () => { clearAccessToken(); setUser(null); setRoadmapTasks([]); localStorage.removeItem('careercompass_tasks'); };
  const submitCollegeSearch = async () => {
    if (selectedCourses.length === 0) {
      setShowCollegeNotice(true);
      setCollegeApiMessage('Select at least one course to prepare your search.');
      setCollegeMatches([]);
      return;
    }
    setShowCollegeNotice(true); setCollegeSearchBusy(true);
    const backendExam = collegeExam === 'NEET' ? 'NEET UG' : collegeExam === 'JEE' ? 'JEE Main' : 'KCET';
    try {
      const result = await api.collegeSearch({ exam: backendExam, score: null, rank: score.trim() || null, region, courses: selectedCourses, course: null, quota: collegeQuota || null });
      setCollegeApiMessage(
        collegeExam === 'NEET'
          ? 'NEET reference results prepared. Confirm eligibility and current cutoffs with MCC.'
          : result.message,
      );
      setCollegeMatches(result.matches || []);
    }
    catch { setCollegeMatches([]); setCollegeApiMessage('The API is unavailable. This form has not generated any college matches; start the backend and try again.'); }
    finally { setCollegeSearchBusy(false); }
  };
  const addRoadmapTask = async () => {
    const title = taskDraft.trim(); if (title.length < 2) return;
    const estimatedMinutes = 30;
    if (user) {
      try { const created = await api.addTask(title); const withEstimate = { ...created, estimated_minutes: created.estimated_minutes ?? estimatedMinutes, logged_minutes: created.logged_minutes ?? 0 }; setRoadmapTasks(old => [...old, withEstimate]); setTaskDraft(''); return; }
      catch { setAuthError('Could not save task to the server. Check the backend connection.'); }
    }
    setRoadmapTasks(old => [...old, { id: Date.now(), title, completed: false, estimated_minutes: estimatedMinutes, logged_minutes: 0, created_at: new Date().toISOString() }]); setTaskDraft('');
  };
  const toggleSavedCareer = (title: string) => { const alreadySaved = savedCareers.includes(title); setSavedCareers(old => alreadySaved ? old.filter(x => x !== title) : [...old, title]); if (user) { const sync = alreadySaved ? api.removeBookmark('career', title) : api.addBookmark('career', title); void sync.catch(() => setAuthError('The saved-career change is local, but could not sync to your account.')); } };
  const toggleRoadmapTask = async (task: RoadmapTask) => {
    const completed = !task.completed;
    setRoadmapTasks(old => old.map(t => t.id === task.id ? { ...t, completed } : t));
    if (user) { try { await api.updateTask(task.id, completed, task.estimated_minutes ?? 0); } catch { setAuthError('Task changed locally but could not sync to the server.'); } }
  };
  const logTaskMinutes = async (task: RoadmapTask, minutes: number) => {
    if (minutes <= 0) return;
    const updated = { ...task, logged_minutes: (task.logged_minutes ?? 0) + minutes };
    setRoadmapTasks(old => old.map(t => t.id === task.id ? updated : t));
    if (user) {
      try { await api.logTaskMinutes(task.id, minutes, 'Study session'); }
      catch { setAuthError('Study time was tracked locally but could not sync with the server.'); }
    }
  };
  const riasecScores = ['Realistic','Investigative','Artistic','Social','Enterprising','Conventional'].reduce<Record<string,number>>((scores, dimension) => { scores[dimension] = questions.reduce((total, item, index) => total + (item.dimension === dimension ? (answers[index] ?? 0) : 0), 0); return scores; }, {});
  const topRiasec = Object.entries(riasecScores).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const resultTitle = topRiasec.map(([dimension])=>dimension).join(' / ');
  const oauthStatusMessage = oauthStatusUnavailable
    ? 'Social sign-in status is unavailable. Start the backend and reopen sign in.'
    : oauthProviders && !oauthProviders.google
      ? 'Google sign-in needs client credentials configured in backend/.env.'
      : !oauthProviders ? 'Checking social sign-in availability…' : '';
  return <LocalizedMarkup language={language}><div className="app-shell">
    <header className="site-header"><button className="brand" onClick={() => navigate('home')} aria-label="CareerCompass home"><span className="brand-mark"><Compass size={22} strokeWidth={1.8}/></span><span>careercompass<span className="brand-ai">.ai</span></span></button>
      <nav className={`nav-links ${menuOpen ? 'nav-open' : ''}`} aria-label="Main navigation"><button className={page === 'home' ? 'nav-active' : ''} onClick={() => navigate('home')}>Home</button><button className={page === 'features' ? 'nav-active' : ''} onClick={() => navigate('features')}>Features</button><button className={page === 'careers' ? 'nav-active' : ''} onClick={() => navigate('careers')}>Careers</button><button className={page === 'colleges' ? 'nav-active' : ''} onClick={() => navigate('colleges')}>Colleges</button><button onClick={() => { if (page !== 'home') navigate('home'); window.setTimeout(() => document.getElementById('how-it-works')?.scrollIntoView({behavior:'smooth'}), 60); }}>How it works</button><button className={page === 'assistant' ? 'nav-active' : ''} onClick={() => navigate('assistant')}>Affu AI</button></nav>
      <div className="header-actions"><label className="language-picker"><Languages size={16}/><select aria-label="Select language" value={language} onChange={event=>changeLanguage(event.target.value)}><option value="en">English</option><option value="kn">ಕನ್ನಡ</option><option value="hi">हिन्दी</option></select></label>{languageMessage&&<small className="language-message" role="status">{languageMessage}</small>}<button className="header-login" onClick={() => navigate('dashboard')}>{user ? `Hi, ${user.name.split(' ')[0]}` : 'My roadmap'}</button><button className="btn btn-dark btn-small" onClick={user ? signOut : () => { setAuthMode('login'); setAuthError(''); setAuthOpen(true); }}>{user ? 'Sign out' : 'Sign in'} <ArrowUpRight size={15}/></button></div><button className="mobile-menu" aria-label="Toggle navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
    </header>
    {page === 'home' && <>
      <main>
        <section className="hero section-wrap"><div className="hero-copy"><div className="eyebrow"><span className="eyebrow-dot"/> AI-POWERED CAREER GUIDANCE</div><h1>Find a career path<br/>that <span className="serif-italic">fits who you are.</span></h1><p className="hero-description">Connect your interests, academic profile, and skills to explore career options, understand college pathways, and build a practical plan for your future.</p><div className="hero-buttons"><button className="btn btn-dark" onClick={openAssessment}>Start your assessment <ArrowRight size={17}/></button><button className="btn btn-quiet" onClick={() => navigate('careers')}>Explore career paths <ArrowUpRight size={16}/></button></div><div className="trust-points"><span><Check size={15}/> Interest-led insights</span><span><Check size={15}/> Explainable suggestions</span><span><Check size={15}/> Practical next steps</span></div></div>
          <div className="hero-visual">
            <div className="visual-orbit orbit-one"/>
            <div className="visual-orbit orbit-two"/>
            <div className="landscape hero-photo">
              <img src="/images/students-collaborating.jpg" alt="University students exploring ideas together in a library" fetchPriority="high"/>
              <div className="landscape-caption"><span>YOUR NEXT CHAPTER</span><strong>Start with what makes you, you.</strong></div>
            </div>
            <div className="floating-card interest-card"><div className="float-icon green"><Sparkles size={18}/></div><div><small>YOUR INTERESTS</small><strong>Curiosity → Possibility</strong></div><span className="float-check"><Check size={14}/></span></div>
            <div className="floating-card route-card"><div className="route-top"><span className="float-icon peach"><Target size={17}/></span><span className="mini-label">PATHWAY PREVIEW</span></div><strong>Explore. Learn. Grow.</strong><div className="route-line"><i/><i/><i/><i/></div><div className="route-labels"><span>Discover</span><span>Build</span><span>Apply</span></div></div>
            <div className="hero-stamp"><Compass size={18}/><span>Find your<br/>own direction</span></div>
          </div>
        </section>
        <section className="path-strip"><div className="path-strip-inner"><span className="strip-label">MADE FOR YOUR NEXT STEP</span><span><GraduationCap/> After 10th</span><b>✳</b><span><BookOpen/> After 12th</span><b>✳</b><span><Atom/> College students</span><b>✳</b><span><BriefcaseBusiness/> Early careers</span></div></section>
        <section className="section-wrap section-space intro-section"><div className="section-kicker">A LITTLE MORE CLARITY</div><div className="intro-grid"><h2>Big decisions feel lighter when you <span className="serif-italic">know where to start.</span></h2><div className="intro-right"><p>There is no single test that can tell you your future. CareerCompass helps you ask better questions, compare real options, and turn your interests into useful next steps.</p><button className="text-link" onClick={() => navigate('careers')}>See what you could explore <ArrowUpRight size={16}/></button></div></div><div className="benefit-grid"><article className="benefit-card benefit-featured"><div className="benefit-icon"><BrainCircuit/></div><span className="card-index">01 / DISCOVER</span><h3>Understand your patterns</h3><p>Reflect on the activities, subjects, and environments that bring out your strengths.</p><div className="tiny-pattern"><span/><span/><span/><span/><span/></div></article><article className="benefit-card"><div className="benefit-icon peach-bg"><Compass/></div><span className="card-index">02 / EXPLORE</span><h3>See more possibilities</h3><p>Compare career families, day-to-day work, study routes, and skills to build.</p><div className="simple-arrow"><ArrowDownRight/></div></article><article className="benefit-card"><div className="benefit-icon blue-bg"><TrendingUp/></div><span className="card-index">03 / TAKE ACTION</span><h3>Make a practical plan</h3><p>Turn a broad goal into small learning steps, projects, and questions to investigate.</p><div className="mini-progress"><span style={{width:'68%'}}/></div><small className="progress-caption">Small steps add up</small></article></div></section>
        <section className="feature-band"><div className="section-wrap feature-layout"><div className="feature-copy"><div className="section-kicker">YOUR PERSONAL STARTING POINT</div><h2>Not another label.<br/><span className="serif-italic">A direction to explore.</span></h2><p>Use your results as a conversation starter, not a box to fit into. Explore alternatives, learn what each path asks of you, and decide what deserves a closer look.</p><ul className="check-list"><li><Check/> Understand why a path may fit your interests</li><li><Check/> Compare the skills different roles need</li><li><Check/> See the next learning step, not just a job title</li></ul><button className="btn btn-dark" onClick={openAssessment}>Find your starting point <ArrowRight size={16}/></button></div><div className="insight-panel"><div className="panel-head"><div><span className="panel-eyebrow">EXPLORATION SNAPSHOT</span><h3>Your interests, connected</h3></div><span className="live-pill"><i/> SAMPLE</span></div><div className="interest-bars"><div className="interest-row"><div><span className="interest-dot dot-green"/> Analytical thinking</div><strong>Explore</strong><div className="bar-track"><span style={{width:'78%'}}/></div></div><div className="interest-row"><div><span className="interest-dot dot-peach"/> Creative expression</div><strong>Explore</strong><div className="bar-track bar-peach"><span style={{width:'66%'}}/></div></div><div className="interest-row"><div><span className="interest-dot dot-blue"/> Working with people</div><strong>Explore</strong><div className="bar-track bar-blue"><span style={{width:'57%'}}/></div></div></div><div className="insight-note"><Sparkles size={17}/><p><strong>Try this:</strong> compare two paths that interest you, then look at the skills and daily work they share.</p></div><div className="panel-foot"><span>Illustrative preview</span><span>Not a validated assessment result</span></div></div></div></section>
        <section className="section-wrap section-space" id="how-it-works"><div className="center-heading"><div className="section-kicker">A SIMPLE WAY FORWARD</div><h2>From “what if?” to <span className="serif-italic">what next?</span></h2><p>Take it one step at a time. You do not need to have everything figured out today.</p></div><div className="steps-grid"><div className="step-item"><div className="step-number">01</div><div className="step-icon"><Heart/></div><h3>Reflect on you</h3><p>Answer short prompts about interests, preferences, and the work you enjoy.</p><span className="step-time">~ 3 MIN SAMPLE</span></div><div className="step-connector"><ArrowRight/></div><div className="step-item"><div className="step-number">02</div><div className="step-icon"><Compass/></div><h3>Explore options</h3><p>Browse career families and learn about study routes, skills, and trade-offs.</p><span className="step-time">AT YOUR PACE</span></div><div className="step-connector"><ArrowRight/></div><div className="step-item"><div className="step-number">03</div><div className="step-icon"><Target/></div><h3>Choose a next step</h3><p>Save paths to investigate and create a small plan you can actually follow.</p><span className="step-time">KEEP BUILDING</span></div></div></section>
        <section className="audience-section"><div className="section-wrap audience-layout"><div><div className="section-kicker">WHEREVER YOU ARE</div><h2>There is a next step<br/>for <span className="serif-italic">every stage.</span></h2><p className="audience-lead">The best plan depends on where you are now, not where someone else thinks you should be.</p></div><div className="audience-list"><button onClick={() => navigate('careers')}><span className="audience-num">01</span><span><strong>After 10th standard</strong><small>Explore subject combinations and broad pathways.</small></span><ArrowUpRight/></button><button onClick={() => navigate('colleges')}><span className="audience-num">02</span><span><strong>After 12th standard</strong><small>Understand courses, entrance routes, and college factors.</small></span><ArrowUpRight/></button><button onClick={() => navigate('dashboard')}><span className="audience-num">03</span><span><strong>During college</strong><small>Build skills, projects, and internship readiness.</small></span><ArrowUpRight/></button><button onClick={() => navigate('careers')}><span className="audience-num">04</span><span><strong>Exploring a new direction</strong><small>Compare roles and identify transferable skills.</small></span><ArrowUpRight/></button></div></div></section>
        <section className="section-wrap section-space careers-preview"><div className="preview-heading"><div><div className="section-kicker">OPEN UP YOUR OPTIONS</div><h2>Careers worth a <span className="serif-italic">closer look.</span></h2></div><button className="btn btn-outline" onClick={() => navigate('careers')}>Explore all careers <ArrowUpRight size={16}/></button></div><div className="career-preview-grid">{careers.slice(0,4).map((c,i)=><button className="career-mini-card" key={c.title} onClick={() => navigate('careers')}><div className={`career-glyph glyph-${i}`}>{c.icon}</div><span className="career-group">{c.group}</span><h3>{c.title}</h3><p>{c.fit}</p><span className="card-arrow"><ArrowUpRight size={17}/></span></button>)}</div></section>
        <section className="faq-section"><div className="section-wrap faq-layout"><div><div className="section-kicker">GOOD QUESTIONS, HONEST ANSWERS</div><h2>Clarity starts with <span className="serif-italic">trust.</span></h2><p>Understand what this tool can help with — and what still needs official information or human guidance.</p></div><div className="faq-list">{faqs.map(([q,a],i)=><div className={`faq-item ${faqOpen===i?'faq-expanded':''}`} key={q}><button onClick={()=>setFaqOpen(faqOpen===i?null:i)} aria-expanded={faqOpen===i}><span>{q}</span><ChevronDown size={18}/></button>{faqOpen===i&&<p>{a}</p>}</div>)}</div></div></section>
        <section className="section-wrap closing-cta"><div className="cta-decoration cta-one"/><div className="cta-decoration cta-two"/><div className="cta-content"><span className="cta-kicker"><Sparkles size={15}/> YOUR FUTURE, YOUR CALL</span><h2>You do not need every answer.<br/><span className="serif-italic">Just a place to begin.</span></h2><p>Take a few minutes to reflect, then explore the possibilities that feel worth your time.</p><button className="btn btn-dark" onClick={openAssessment}>Start exploring <ArrowRight size={16}/></button></div></section>
      </main>
    </>}
    {page === 'careers' && <main className="inner-page section-wrap">
      <div className="inner-hero">
        <div className="section-kicker">CAREER EXPLORER</div>
        <h1>Curiosity is a good<br/><span className="serif-italic">place to start.</span></h1>
        <p>Explore a range of career directions. Learn what the work involves, which skills to practise, and what study routes to investigate.</p>
        <button className="btn btn-dark" onClick={openAssessment}>Try the sample reflection <ArrowRight size={16}/></button>
      </div>
      <div className="explorer-toolbar">
        <label className="search-box"><Search size={18}/><input value={careerSearch} onChange={e=>setCareerSearch(e.target.value)} placeholder="Search roles or interests..." aria-label="Search careers"/></label>
        <select value={careerFilter} onChange={e=>setCareerFilter(e.target.value)} aria-label="Filter career field">{['All fields','Technology','Data & Analytics','Design','Business & Product','Healthcare','Engineering','Sports Careers','Business Ideas'].map(x=><option key={x}>{x}</option>)}</select>
      </div>
      <div className="explorer-result-line"><span>{filteredCareers.length} career directions to explore</span><span>Examples, not a ranking</span></div>
      <div className="explorer-grid">{filteredCareers.map((c,i)=><article className="explorer-card" key={c.title}>
        <img className="career-card-visual" src={careerVisualFor(c.group)} alt={`Illustrative photo for ${c.group}`} loading="lazy" decoding="async"/>
        <div className="explorer-card-top"><div className={`career-glyph glyph-${i%4}`}>{c.icon}</div><button className={`save-career ${savedCareers.includes(c.title)?'is-saved':''}`} onClick={()=>toggleSavedCareer(c.title)} aria-label={`${savedCareers.includes(c.title)?'Unsave':'Save'} ${c.title}`}><Heart size={17} fill={savedCareers.includes(c.title)?'currentColor':'none'}/></button></div>
        <span className="career-group">{c.group}</span><h3>{c.title}</h3><p>{c.fit}</p><div className="skill-list">{c.skills.map(s=><span key={s}>{s}</span>)}</div>
        <div className="study-route"><small>PATHWAY TO INVESTIGATE</small><p>{c.study}</p></div>
        <button className="text-link career-detail-link" onClick={()=>navigateCareer(({'Software Engineer':'software-engineer','Data Analyst':'data-analyst','UX/UI Designer':'ux-ui-designer','Cybersecurity Analyst':'cybersecurity-analyst','Product Manager':'product-manager','Healthcare Professional':'healthcare-professional','Mechanical Engineer':'mechanical-engineer','Content Strategist':'content-strategist','Sports Data Analyst':'sports-analyst','Sports Physiotherapist':'sports-physiotherapist','Sports Coach':'sports-coach','Entrepreneur':'entrepreneur'} as Record<string,string>)[c.title] || c.title.toLowerCase().replace(/[^a-z0-9]+/g,'-'))}>View career details <ArrowRight size={14}/></button>
      </article>)}</div>
      <div className="notice-box"><ShieldCheck size={20}/><p><strong>Explore with context.</strong> Requirements vary by role, institution, and location. Check current official course and licensing requirements before making decisions.</p></div>
    </main>}
    {page === 'colleges' && <main className="inner-page section-wrap"><div className="inner-hero"><div className="section-kicker">COLLEGE PATHWAY EXPLORER</div><h1>Compare options with<br/><span className="serif-italic">the right context.</span></h1><p>Build a college search profile using the entrance exam, rank, region, courses, and quota.</p></div><div className="college-tool-grid"><section className="college-form-card"><div className="college-form-heading"><div className="form-icon"><GraduationCap/></div><div><h2>Build your search profile</h2><p>Help us find the best colleges and career options for you.</p></div><div className="college-heading-art" aria-hidden="true"><BookOpen/><GraduationCap/></div></div><div className="college-profile-fields"><label>Entrance exam<select value={collegeExam} onChange={e=>setCollegeExam(e.target.value)}><option>KCET</option><option>NEET</option><option>JEE</option></select></label><label>Entrance-exam rank<input inputMode="numeric" pattern="[0-9]*" value={score} onChange={e=>setScore(e.target.value.replace(/[^0-9]/g, ''))} placeholder="1000" aria-label="Entrance exam rank"/></label><label>Preferred region{collegeExam === 'JEE' && <small>JoSAA records cover All India.</small>}<select value={region} onChange={e=>setRegion(e.target.value)} disabled={collegeExam === 'JEE'}><option>Karnataka</option><option>All India</option><option>Tamil Nadu</option><option>Telangana</option><option>Kerala</option><option>Maharashtra</option></select></label><div className="course-multiselect" ref={courseMenuRef}><label id="course-multiselect-label">Courses (Select multiple)</label><button type="button" className={`course-select-control ${courseMenuOpen ? 'is-open' : ''}`} aria-labelledby="course-multiselect-label" aria-expanded={courseMenuOpen} onClick={()=>setCourseMenuOpen(open=>!open)}><span>{selectedCourses.length ? `${selectedCourses.length} selected` : 'Search and select courses...'}</span><ChevronDown size={18}/></button>{selectedCourses.length>0&&<div className="selected-course-chips">{selectedCourses.map(course=><span className="course-chip" key={course}>{course}<button type="button" aria-label={`Remove ${course}`} onClick={()=>setSelectedCourses(old=>old.filter(item=>item!==course))}><X size={13}/></button></span>)}</div>}<div className={`course-menu ${courseMenuOpen ? 'is-open' : ''}`} aria-hidden={!courseMenuOpen}>{courseMenuOpen&&<><div className="course-search"><Search size={16}/><input value={courseSearch} onChange={e=>setCourseSearch(e.target.value)} placeholder="Search courses..." aria-label="Search courses"/></div><div className="course-menu-actions"><button type="button" onClick={()=>setSelectedCourses(old=>Array.from(new Set([...old,...availableCourses])))}><Check size={14}/> Select All</button><button type="button" onClick={()=>setSelectedCourses([])}><X size={14}/> Clear All</button></div><div className="course-options">{filteredCourses.length ? filteredCourses.map(course=><label key={course}><input type="checkbox" checked={selectedCourses.includes(course)} onChange={e=>setSelectedCourses(old=>e.target.checked?Array.from(new Set([...old,course])):old.filter(item=>item!==course))}/><span>{course}</span></label>) : <p className="course-empty">No courses found.</p>}</div></>} </div></div><label>Quota<select value={collegeQuota} onChange={e=>setCollegeQuota(e.target.value)}><option value="">Select quota</option>{collegeExam==='NEET' ? <><option value="AIQ">All India Quota</option></> : collegeExam==='JEE' ? <><option value="AI">All India</option><option value="HS">Home State</option><option value="OS">Other State</option></> : <><option value="State">State</option><option value="Government">Government</option><option value="Hyderabad-Karnataka">Hyderabad-Karnataka</option></>}</select></label></div><button className="btn btn-dark full-btn" onClick={()=>void submitCollegeSearch()} disabled={collegeSearchBusy}>{collegeSearchBusy ? 'Preparing…' : 'Prepare my search'} <ArrowRight size={16}/></button>{showCollegeNotice&&<div className="inline-notice"><Check size={16}/><span>Search profile: {collegeExam}{score.trim()?` · Rank ${score.trim()}`:''} · {region}. {collegeApiMessage || 'Checking data availability…'}</span></div>}{collegeMatches.length>0&&<CollegeResults matches={collegeMatches}/>}<small className="form-disclaimer">Historical comparisons only. Not an admission prediction or guarantee.</small></section><section className="college-info-card"><span className="panel-eyebrow">WHAT A RELIABLE MATCH NEEDS</span><h2>Useful data.<br/><span className="serif-italic">Clear assumptions.</span></h2><div className="data-checklist"><div><Check/><span><strong>Historical cutoffs</strong><small>Clearly labelled by category, quota, round, and course.</small></span></div><div><Check/><span><strong>Your admission context</strong><small>Exam, rank/score, quota where applicable, and preferences.</small></span></div><div><Check/><span><strong>Transparent uncertainty</strong><small>Past cutoffs are historical evidence, not a guarantee.</small></span></div></div><div className="data-warning"><ShieldCheck size={18}/><p><strong>Data status: historical KCET and JoSAA records are bundled.</strong><br/>These are third-party historical compilations, not verified current cutoffs. NEET college-allotment data are not installed. Confirm all deadlines, eligibility, fees, and seat information with official counselling sources.</p></div></section></div><section className="college-next"><div><div className="section-kicker">YOUR NEXT STEP</div><h2>Know what to verify before you decide.</h2></div><div className="college-next-grid"><div><span>01</span><strong>Eligibility</strong><p>Confirm minimum qualifications and subject requirements.</p></div><div><span>02</span><strong>Current counselling</strong><p>Review official schedules, rounds, and seat rules.</p></div><div><span>03</span><strong>Fit beyond rank</strong><p>Compare course content, fees, travel, and student support.</p></div></div></section></main>}
    {page === 'dashboard' && <main className="inner-page section-wrap"><div className="dashboard-welcome"><div><div className="section-kicker">YOUR EXPLORATION SPACE</div><h1>A little progress<br/><span className="serif-italic">is still progress.</span></h1><p>{user ? `Welcome back, ${user.name}. Your account-backed tasks and assessment history can sync with the API.` : 'Save interesting paths and build your next steps. Sign in to sync roadmap tasks and assessment results across sessions.'}</p></div><button className="btn btn-dark" onClick={user ? signOut : () => { setAuthMode('register'); setAuthError(''); setAuthOpen(true); }}>{user ? 'Sign out' : 'Create account'} <ArrowRight size={16}/></button></div><div className="dashboard-grid"><section className="dashboard-main-card"><div className="dashboard-card-head"><div><span className="panel-eyebrow">YOUR NEXT STEPS</span><h2>A plan you can start today</h2></div><span className="demo-chip">{user ? 'SYNC ENABLED' : 'LOCAL MODE'}</span></div><form className="task-add" onSubmit={e => { e.preventDefault(); void addRoadmapTask(); }}><input value={taskDraft} onChange={e => setTaskDraft(e.target.value)} placeholder="Add a small next step…" aria-label="New roadmap task" maxLength={240}/><button className="btn btn-dark btn-small" type="submit" disabled={taskDraft.trim().length < 2}>Add task</button></form>    <div className="todo-list">{roadmapTasks.length ? roadmapTasks.map(task => <div key={task.id} className="task-row"><label className="task-check"><input type="checkbox" checked={task.completed} onChange={() => void toggleRoadmapTask(task)}/> <span><strong className={task.completed ? 'task-completed' : ''}>{task.title}</strong><small>{task.completed ? 'Completed' : 'One step at a time'} · {task.logged_minutes ?? 0} min tracked</small></span></label><div className="task-actions"><span className="task-meta">{task.estimated_minutes ?? 0} min goal</span><button className="mini-btn" onClick={() => void logTaskMinutes(task, 15)}>+15 min</button></div></div>) : <div className="task-empty">No tasks yet. Add your first next step above.</div>}</div>{authError && <p className="auth-inline-error" role="alert">{authError}</p>}</section><section className="saved-card"><div className="panel-eyebrow">SAVED CAREER PATHS</div><h2>{savedCareers.length} saved</h2>{savedCareers.length? <div className="saved-list">{savedCareers.map(c=><div key={c}><Heart size={15} fill="currentColor"/><span>{c}</span><button onClick={()=>setSavedCareers(old=>old.filter(x=>x!==c))} aria-label={`Remove ${c}`}><X size={15}/></button></div>)}</div>:<div className="empty-saved"><div className="empty-icon"><Heart/></div><p>Your saved paths will appear here.</p><button className="text-link" onClick={()=>navigate('careers')}>Browse careers <ArrowRight size={15}/></button></div>}</section></div><div className="dashboard-footnote"><ShieldCheck size={18}/><p>Your roadmap is a planning aid, not a prediction. {user ? 'Tasks are stored through your connected API account and can track study minutes.' : 'Tasks are stored in this browser. Sign in to sync roadmap tasks and study minutes to the API.'}</p></div></main>}
    {(['features','assistant','resume','jobs','progress','settings','admin','graph','ideas','careerDetail','privacy','terms','sources'] as Page[]).includes(page) && <Suspense fallback={<main className="extra-page section-wrap" role="status">Loading page…</main>}><ExtraPages language={language} onLanguageChange={setSiteLanguage} page={page as 'features'|'assistant'|'resume'|'jobs'|'progress'|'settings'|'admin'|'graph'|'ideas'|'careerDetail'|'privacy'|'terms'|'sources'} user={user} onNavigate={(destination) => { if (destination === 'assessment') { openAssessment(); return; } if (['home','careers','colleges','dashboard','features','assistant','resume','jobs','progress','settings','admin','graph','ideas','careerDetail','privacy','terms','sources'].includes(destination)) navigate(destination as Page); }} onSignIn={() => { setAuthMode('login'); setAuthError(''); setAuthOpen(true); }} careerId={page === 'careerDetail' ? decodeURIComponent(window.location.pathname.split('/').pop() || '') : ''} savedCount={savedCareers.length} taskCount={roadmapTasks.length} completedCount={roadmapTasks.filter(t=>t.completed).length} /></Suspense>}
    <footer className="site-footer"><div className="footer-main"><div className="footer-brand-col"><button className="brand footer-brand" onClick={()=>navigate('home')}><span className="brand-mark"><Compass size={22}/></span><span>careercompass<span className="brand-ai">.ai</span></span></button><p>Helping you explore possibilities and take your next step with more clarity.</p><div className="footer-disclaimer">CareerCompass AI supports exploration; it does not guarantee admission, employment, or outcomes.</div></div><div className="footer-links"><div><strong>Explore</strong><button onClick={()=>navigate('careers')}>Career paths</button><button onClick={()=>navigate('colleges')}>College explorer</button><button onClick={()=>navigate('features')}>All features</button><button onClick={()=>navigate('jobs')}>Job search</button></div><div><strong>Your space</strong><button onClick={()=>navigate('dashboard')}>My roadmap</button><button onClick={()=>navigate('assistant')}>Affu AI assistant</button><button onClick={()=>navigate('resume')}>Resume studio</button><button onClick={()=>navigate('progress')}>Progress</button><button onClick={()=>navigate('settings')}>Settings</button></div></div></div><div className="footer-bottom"><span>© 2026 CareerCompass AI · Student project prototype</span><span><button className="footer-legal-link" onClick={()=>navigate('sources')}>Data sources</button><button className="footer-legal-link" onClick={()=>navigate('privacy')}>Privacy</button><button className="footer-legal-link" onClick={()=>navigate('terms')}>Terms</button> · Built for thoughtful next steps <span className="footer-heart">✳</span></span></div></footer>
    {assessmentOpen&&<div className="modal-backdrop" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget){setAssessmentOpen(false);window.history.replaceState({},'',page==='home'?'/':page==='dashboard'?'/app':`/${page}`)}}}><section className="assessment-modal" role="dialog" aria-modal="true" aria-labelledby="assessment-title"><button className="modal-close" onClick={()=>{setAssessmentOpen(false);window.history.replaceState({},'',page==='home'?'/':page==='dashboard'?'/app':`/${page}`)}} aria-label="Close assessment"><X/></button>{!assessmentDone?<><div className="assessment-top"><span className="form-icon"><Sparkles/></span><span className="panel-eyebrow">{language==='en'?`RIASEC REFLECTION · ${qIndex+1} OF ${questions.length}`:language==='kn'?`RIASEC ಆತ್ಮಚಿಂತನೆ · ${qIndex+1}/${questions.length}`:`RIASEC आत्मचिंतन · ${qIndex+1}/${questions.length}`}</span></div><div className="assessment-progress"><span style={{width:`${((qIndex+1)/questions.length)*100}%`}}/></div><h2 id="assessment-title">{questions[qIndex].q}</h2><p className="assessment-help">Rate how much each statement describes you. Use your first honest impression; there are no right or wrong answers.</p><div className="assessment-dimension">Dimension: {questions[qIndex].dimension}</div><div className="answer-options">{questions[qIndex].opts.map((o,i)=><button className={answers[qIndex]===i?'answer-selected':''} key={o} onClick={()=>setAnswers(old=>{const next=[...old];next[qIndex]=i;return next})}><span className="answer-letter">{String.fromCharCode(65+i)}</span>{o}{answers[qIndex]===i&&<Check size={17}/>}</button>)}</div><div className="modal-actions"><button className="btn btn-quiet" disabled={qIndex===0} onClick={()=>setQIndex(q=>q-1)}><ChevronLeft size={17}/> Back</button><button className="btn btn-dark" disabled={answers[qIndex]===undefined} onClick={()=>qIndex===questions.length-1?finishAssessment():setQIndex(q=>q+1)}>{qIndex===questions.length-1?'See reflection':'Next question'} <ArrowRight size={16}/></button></div><p className="modal-disclaimer">This self-reflection is versioned and explainable, but has not been psychometrically validated. Do not use it as the sole basis for educational or career decisions.</p></>:<div className="assessment-result"><div className="result-spark"><Sparkles size={28}/></div><div className="section-kicker">YOUR INTEREST REFLECTION · RIASEC-24-V1</div><h2 id="assessment-title">Your leading interest dimensions are <span className="serif-italic">{resultTitle}.</span></h2><p>These are transparent self-reflection scores, not a validated psychological instrument or a fixed label. Each dimension has four items scored from 0 to 3.</p><div className="riasec-result-bars">{topRiasec.concat(Object.entries(riasecScores).filter(([d])=>!topRiasec.some(([top])=>top===d))).map(([dimension,score])=><div key={dimension}><span>{dimension}</span><div className="riasec-bar"><i style={{width:`${Number(score)/12*100}%`}}/></div><strong>{score}/12</strong></div>)}</div><div className="recommended-careers"><strong>Paths to investigate next</strong><p>{recommendationStatus}</p>{careerRecommendations.slice(0,3).map(item=><button key={item.career_id} onClick={()=>{setAssessmentOpen(false);setCareerSearch(item.title);navigate('careers')}}><span><b>{item.title}</b><small>{item.explanation}</small></span><span className="alignment-index">{item.alignment_index}<small>alignment index</small></span></button>)}</div>{assessmentSaveStatus && <p className="assessment-save-status" role="status">{assessmentSaveStatus}</p>}<div className="result-next"><strong>Try next</strong><span>Browse related career families</span><span>Compare skills and day-to-day tasks</span><span>Talk to someone in a role that interests you</span></div><div className="modal-actions"><button className="btn btn-quiet" onClick={restartAssessment}>Retake reflection</button><button className="btn btn-dark" onClick={()=>{setAssessmentOpen(false);navigate('careers')}}>Explore careers <ArrowRight size={16}/></button></div><p className="modal-disclaimer">Illustrative reflection only. It is not an admission, employment, or aptitude prediction.</p></div>}</section></div>}
    {authOpen && <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setAuthOpen(false); }}><section className="assessment-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Close sign in"><X/></button><div className="assessment-top"><span className="form-icon"><Compass/></span><span className="panel-eyebrow">YOUR EXPLORATION SPACE</span></div><h2 id="auth-title">{authMode === 'login' ? 'Welcome back.' : 'Create your account.'}</h2><p className="assessment-help">Save your assessment history and keep your roadmap tasks connected to your account.</p>{authMode === 'register' && <label className="auth-field">Full name<input value={authName} onChange={e => setAuthName(e.target.value)} autoComplete="name" placeholder="Your name" minLength={2} required/></label>}<label className="auth-field">Email address<input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required/></label><label className="auth-field">Password<input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" minLength={8} required/></label>{authError && <p className="auth-inline-error" role="alert">{authError}</p>}<button className="btn btn-dark full-btn auth-submit" disabled={authBusy || !authEmail.trim() || authPassword.length < 8 || (authMode === 'register' && authName.trim().length < 2)} onClick={() => void submitAuth()}>{authBusy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16}/></button>{authMode === 'login' && <><div className="auth-switch"><button onClick={() => { if (!authEmail.trim()) { setAuthError('Enter your email address first.'); return; } void api.requestPasswordReset(authEmail).then(() => setAuthError('If an account exists, a password-reset email has been requested.')).catch(error => setAuthError(error instanceof Error ? error.message : 'Could not request a reset.')); }}>Forgot password?</button></div><div className="oauth-actions"><button type="button" className="btn btn-outline full-btn" disabled={!oauthProviders?.google} onClick={() => { window.location.href = api.oauthStartUrl(); }}>Continue with Google</button></div>{oauthStatusMessage && <p className="auth-switch" role="status">{oauthStatusMessage}</p>}</>}<p className="auth-switch">{authMode === 'login' ? 'New to CareerCompass?' : 'Already have an account?'} <button onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}>{authMode === 'login' ? 'Create account' : 'Sign in'}</button></p><p className="modal-disclaimer">Use a unique password. Email and OAuth features are available only after Google credentials are configured on the backend.</p></section></div>}
  </div></LocalizedMarkup>;
}
export default App;

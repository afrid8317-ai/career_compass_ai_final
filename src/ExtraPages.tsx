import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, BookOpen, BriefcaseBusiness, CheckCircle2, CircleAlert, Download, FileText, GraduationCap, HeartHandshake, LockKeyhole, MessageCircle, Moon, Save, Search, ShieldCheck, Sparkles, Sun, Target, Trash2 } from 'lucide-react';
import { LocalizedMarkup, type Language } from './i18n';
import JobRoleExplorer from './JobRoleExplorer';

type User = { id: number; name: string; email: string } | null;
type Page = 'features' | 'assistant' | 'resume' | 'jobs' | 'progress' | 'settings' | 'admin' | 'graph' | 'ideas' | 'careerDetail' | 'privacy' | 'terms' | 'sources';
type Props = { page: Page; user: User; onNavigate: (page: string) => void; onSignIn: () => void; onLanguageChange: (language: Language) => void; careerId?: string; savedCount?: number; taskCount?: number; completedCount?: number; language: Language };
const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';
async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers); if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const token = localStorage.getItem('careercompass_access_token'); if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${API}${path}`, { ...init, headers });
  if (!res.ok) { let message = `Request failed (${res.status})`; try { const body = await res.json(); message = body.detail || message; } catch { /* no JSON response */ } throw new Error(message); }
  if (res.status === 204) return undefined as T; return res.json() as Promise<T>;
}
const featureItems = [
  ['Interest assessment', 'Reflect on activities you enjoy and understand your preferences without treating a short questionnaire as a diagnosis.', 'assessment'],
  ['Career explorer', 'Compare typical tasks, skill areas, study pathways and practical ways to investigate a role.', 'careers'],
  ['College explorer', 'Search historical cutoff records when source-cited datasets are installed. Historical records are not admission guarantees.', 'colleges'],
  ['Skill roadmaps', 'Turn a goal into manageable tasks and track your progress over time.', 'dashboard'],
  ['Affu AI assistant', 'Ask for guidance grounded in the starter career catalogue. Configure a Gemini key on the backend for model-assisted responses.', 'assistant'],
  ['Resume readiness', 'Draft editable sections, parse text-based PDFs, and compare resume keywords with a target role.', 'resume'],
  ['Job search', 'Search remote jobs open to India through Himalayas, or attributed remote roles from Remotive.', 'jobs'],
  ['Progress and history', 'Review your assessment count, saved items and completed roadmap tasks.', 'progress'],
  ['Career and skill graph', 'Explore how curated career profiles connect to common skills through an accessible 2D relationship view.', 'graph'],
  ['Business idea discovery', 'Explore ten interest areas, each with at least six starter ideas. Filter by budget and time, then validate demand before investing.', 'ideas'],
  ['Data sources and transparency', 'Understand which information is curated, imported, synthetic, or dependent on external configuration.', 'sources'],
];
const resumeEmpty = { full_name: '', headline: '', email: '', phone: '', location: '', links: '', summary: '', education: '', skills: '', projects: '', experience: '', certifications: '' };
const IDEA_INTERESTS = [
  { value: 'technology', label: 'Technology', topic: 'technology and digital tools' },
  { value: 'design', label: 'Design and creativity', topic: 'design and creative work' },
  { value: 'education', label: 'Education and mentoring', topic: 'learning and mentoring' },
  { value: 'sports', label: 'Sports', topic: 'sports and community activity' },
  { value: 'business', label: 'Business and operations', topic: 'small business and operations' },
  { value: 'agriculture', label: 'Agriculture and farming', topic: 'small-scale growing and local agriculture' },
  { value: 'food', label: 'Food and hospitality', topic: 'food and hospitality' },
  { value: 'health', label: 'Health and wellness', topic: 'non-clinical wellbeing and healthy routines' },
  { value: 'finance', label: 'Finance and budgeting', topic: 'budgeting and financial literacy' },
  { value: 'environment', label: 'Environment and sustainability', topic: 'reuse and environmental projects' },
];
const FALLBACK_IDEA_TEMPLATES = [
  { title: 'starter workshop', budget: 'under-5000', time: 'weekends', description: 'Host a small beginner session in {topic} with a community or student group.', test: 'Ask a few learners what they need, then run one short pilot before planning more.' },
  { title: 'digital guide or checklist', budget: 'under-5000', time: 'weekends', description: 'Create a clear, practical guide that helps people with a common task in {topic}.', test: 'Share a draft with three people and check whether they can use it without help.' },
  { title: 'local service pilot', budget: 'under-5000', time: 'part-time', description: 'Offer a small, time-limited service related to {topic}, after checking relevant local rules.', test: 'Talk with potential users first and test the service with one volunteer.' },
  { title: 'simple planning tool', budget: '5000-20000', time: 'part-time', description: 'Build a simple template or tracker for a recurring task in {topic}.', test: 'Try the tool with sample information and revise it based on user feedback.' },
  { title: 'community pop-up', budget: '5000-20000', time: 'planned', description: 'Plan a small community event or pop-up around {topic} with a local partner.', test: 'Confirm venue permission, partner interest, and costs before making commitments.' },
  { title: 'partner-led program', budget: '20000-plus', time: 'planned', description: 'Explore a larger {topic} program with an established and suitable community partner.', test: 'Verify the partner, audience interest, safety needs, and expected costs before spending.' },
];
const FALLBACK_IDEA_CATALOG = IDEA_INTERESTS.flatMap(({ value, label, topic }) =>
  FALLBACK_IDEA_TEMPLATES.map((template, index) => ({
    id: `${value}-fallback-${index + 1}`,
    title: `${label} ${template.title}`,
    interest: value,
    budget: template.budget,
    time: template.time,
    description: template.description.replace('{topic}', topic),
    test: template.test,
  })),
);

export default function ExtraPages(props: Props) {
  const content = useExtraPageContent(props);
  return <LocalizedMarkup language={props.language}>{content}</LocalizedMarkup>;
}

function useExtraPageContent({ page, user, onNavigate, onSignIn, onLanguageChange, careerId = '', savedCount = 0, taskCount = 0, completedCount = 0 }: Props) {
  const [question, setQuestion] = useState(''); const [chat, setChat] = useState<{role:'user'|'assistant'; text:string; sources?:{title:string;source_type:string;source_id:string;url?:string|null}[]; provider?:string}[]>([]); const [chatBusy, setChatBusy] = useState(false); const [chatLoading, setChatLoading] = useState(false); const [chatError, setChatError] = useState('');
  const [resume, setResume] = useState<Record<string,string>>(resumeEmpty); const [resumeTitle, setResumeTitle] = useState('My resume'); const [resumeId, setResumeId] = useState<number|null>(null); const [resumeMessage, setResumeMessage] = useState(''); const [parsedResumeText, setParsedResumeText] = useState(''); const [useGeminiOcr, setUseGeminiOcr] = useState(false); const [jobDescription, setJobDescription] = useState(''); const [analysis, setAnalysis] = useState<{score:number;checklist:Record<string,boolean>;tips:string[];disclaimer:string;keyword_match?:{coverage_percent:number;matched_keywords:string[];missing_keywords:string[];note:string}|null}|null>(null); const [jobSearch, setJobSearch] = useState(''); const [jobSkills, setJobSkills] = useState(''); const [jobs, setJobs] = useState<any[]>([]); const [jobMessage, setJobMessage] = useState(''); const [jobProvider, setJobProvider] = useState(''); const [jobsStatus, setJobsStatus] = useState<'live'|'error'>('live'); const [jobsLoading, setJobsLoading] = useState(false);
  const [careerDetails, setCareerDetails] = useState<any>(null); const [careerDetailError, setCareerDetailError] = useState('');
  const [graphData, setGraphData] = useState<{nodes:any[];edges:any[]}|null>(null); const [selectedGraphCareer, setSelectedGraphCareer] = useState('software-engineer'); const [skillDraft, setSkillDraft] = useState(''); const [targetSkillLevel, setTargetSkillLevel] = useState(3); const [gapResult, setGapResult] = useState<any>(null); const [roadmapResult, setRoadmapResult] = useState<any>(null); const [graphMessage, setGraphMessage] = useState(''); const [ideaInterest, setIdeaInterest] = useState('technology'); const [ideaBudget, setIdeaBudget] = useState('under-5000'); const [ideaTime, setIdeaTime] = useState('weekends');
  const [progress, setProgress] = useState<any>(null); const [assessmentHistory, setAssessmentHistory] = useState<any[]>([]); const [localAssessment, setLocalAssessment] = useState<any>(()=>{try{return JSON.parse(localStorage.getItem('careercompass_latest_assessment')||'null')}catch{return null}}); const [progressMessage, setProgressMessage] = useState(''); const [profile, setProfile] = useState({education_stage:'College student', preferred_language:'en', location:'', interests:[] as string[]}); const [settingsMessage, setSettingsMessage] = useState(''); const [dark, setDark] = useState(() => localStorage.getItem('careercompass_theme') === 'dark'); const [csvText, setCsvText] = useState(''); const [csvReport, setCsvReport] = useState<any>(null); const [importHistory, setImportHistory] = useState<any[]>([]); const [adminError, setAdminError] = useState(''); const [ideaCatalog, setIdeaCatalog] = useState<any[]>([]); const [ideaMessage, setIdeaMessage] = useState(''); const [careerPathway, setCareerPathway] = useState<any>(null);

  useEffect(() => {
    let active = true;
    if (page !== 'assistant') return;
    setChatError('');
    if (!user) {
      setChat([]);
      setChatLoading(false);
      return;
    }
    setChatLoading(true);
    api<{id:number;question:string;answer:string;sources:{title:string;source_type:string;source_id:string;url?:string|null}[];provider:string}[]>('/api/v1/assistant/history')
      .then(rows => {
        if (active) setChat(rows.flatMap(row => [
          {role:'user' as const,text:row.question},
          {role:'assistant' as const,text:row.answer,sources:row.sources,provider:row.provider},
        ]));
      })
      .catch(error => { if (active) setChatError(error instanceof Error ? error.message : 'Could not load saved Affu conversations.'); })
      .finally(() => { if (active) setChatLoading(false); });
    return () => { active = false; };
  }, [page, user]);

  useEffect(() => {
    if (page !== 'jobs') return;
    let active = true;
    const controller = new AbortController();
    setJobsLoading(true);
    setJobMessage('');
    const timer = window.setTimeout(() => {
      api<{status:'live';provider:string;message:string;items:any[]}>(`/api/v1/jobs?q=${encodeURIComponent(jobSearch)}&skills=${encodeURIComponent(jobSkills)}`, {signal:controller.signal})
        .then(result => {
          if (!active) return;
          setJobs(result.items);
          setJobsStatus(result.status);
          setJobProvider(result.provider);
          setJobMessage(result.message);
        })
        .catch(error => {
          if (!active || controller.signal.aborted) return;
          setJobs([]);
          setJobsStatus('error');
          setJobProvider('');
          setJobMessage(error instanceof Error ? error.message : 'Could not load job listings.');
        })
        .finally(() => { if (active) setJobsLoading(false); });
    }, jobSearch || jobSkills ? 350 : 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [page, jobSearch, jobSkills]);
  useEffect(() => { if (page === 'resume' && user) { api<any[]>('/api/v1/resumes').then(rows => { if (rows.length) { setResumeId(rows[0].id); setResumeTitle(rows[0].title); setResume({ ...resumeEmpty, ...Object.fromEntries(Object.entries(rows[0].content || {}).map(([k,v])=>[k, Array.isArray(v)?v.join(', '):String(v ?? '')])) }); } }).catch(e=>setResumeMessage(e.message)); } }, [page, user]);
  useEffect(() => { if (page === 'progress' && user) { api<any>('/api/v1/progress').then(setProgress).catch(e=>setProgressMessage(e.message)); api<any[]>('/api/v1/assessments').then(setAssessmentHistory).catch(()=>setAssessmentHistory([])); } else if (page === 'progress') { setProgressMessage('Sign in to load account-backed history. Guest progress is limited to this browser.'); try { setLocalAssessment(JSON.parse(localStorage.getItem('careercompass_latest_assessment')||'null')); } catch { setLocalAssessment(null); } } }, [page, user]);
  useEffect(() => { if (page === 'settings' && user) api<any>('/api/v1/profile').then(p=>{setProfile({education_stage:p.education_stage,preferred_language:p.preferred_language,location:p.location,interests:p.interests||[]});if(p.preferred_language==='en'||p.preferred_language==='kn'||p.preferred_language==='hi')onLanguageChange(p.preferred_language);}).catch(e=>setSettingsMessage(e.message)); }, [page, user, onLanguageChange]);
  useEffect(() => { if (page === 'graph') api<{nodes:any[];edges:any[]}>('/api/v1/career-graph').then(setGraphData).catch(e=>setGraphMessage(e.message)); }, [page]);
  useEffect(() => { if (page === 'careerDetail' && careerId) { setCareerDetails(null); setCareerDetailError(''); setCareerPathway(null); setSelectedGraphCareer(careerId); api<any>(`/api/v1/careers/${encodeURIComponent(careerId)}`).then(setCareerDetails).catch(e=>setCareerDetailError(e.message)); api<any>(`/api/v1/career-pathways/${encodeURIComponent(careerId)}`).then(setCareerPathway).catch(() => setCareerPathway(null)); } }, [page, careerId]);
  useEffect(() => { if (page === 'ideas') { setIdeaMessage(''); api<any>(`/api/v1/business-ideas?interest=${encodeURIComponent(ideaInterest)}`).then(result => { setIdeaCatalog(result.items || []); setIdeaMessage(result.source_note || ''); }).catch(error => { setIdeaCatalog([]); setIdeaMessage(error instanceof Error ? error.message : 'Could not load the idea catalogue.'); }); } }, [page, ideaInterest]);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; localStorage.setItem('careercompass_theme', dark ? 'dark' : 'light'); }, [dark]);

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    if (!user) { setChatError('Sign in to use and save Affu AI conversations.'); return; }
    setChatError('');
    setQuestion('');
    setChat(old => [...old, {role:'user',text:q}]);
    setChatBusy(true);
    try {
      const result = await api<{answer:string;sources:any[];provider:string;disclaimer:string}>('/api/v1/assistant/chat',{method:'POST',body:JSON.stringify({question:q})});
      setChat(old => [...old, {role:'assistant',text:result.answer+`\n\n${result.disclaimer}`,sources:result.sources,provider:result.provider}]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Could not contact Affu AI.');
    } finally {
      setChatBusy(false);
    }
  };
  const updateResume = (key:string,value:string) => setResume(old=>({...old,[key]:value}));
  const saveResume = async () => { if (!user) { setResumeMessage('Sign in to save this resume to your account.'); return; } setResumeMessage('Saving…'); try { const payload={title:resumeTitle,content:resume}; if (resumeId) await api(`/api/v1/resumes/${resumeId}`,{method:'PUT',body:JSON.stringify(payload)}); else { const created=await api<{id:number}>('/api/v1/resumes',{method:'POST',body:JSON.stringify(payload)}); setResumeId(created.id); } setResumeMessage('Resume saved to your account.'); } catch(e) { setResumeMessage(e instanceof Error?e.message:'Resume could not be saved.'); } };
  const parseResumeFile = async (file:File, useExternalOcr = false) => {
    if (!user) { setResumeMessage('Sign in before uploading a resume for parsing.'); return; }
    if (file.size > 5 * 1024 * 1024) { setResumeMessage('Resume PDFs must be 5 MB or smaller.'); return; }
    setParsedResumeText('');
    setAnalysis(null);
    setResumeMessage('Parsing PDF on the CareerCompass backend…');
    const formData = new FormData();
    formData.append('file',file);
    if (useExternalOcr) formData.append('consent_to_external_processing','true');
    const headers = new Headers();
    const accessToken = localStorage.getItem('careercompass_access_token');
    if (accessToken) headers.set('Authorization',`Bearer ${accessToken}`);
    try {
      const endpoint = useExternalOcr ? '/api/v1/resumes/parse-scanned' : '/api/v1/resumes/parse';
      const response = await fetch(`${API}${endpoint}`,{method:'POST',headers,body:formData});
      if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try { const body = await response.json(); message = body.detail || message; } catch { /* use fallback */ }
        throw new Error(message);
      }
      const result = await response.json() as {fields:Record<string,string>;extracted_text:string;ocr_provider?:string};
      setResume(old=>({...old,...Object.fromEntries(Object.entries(result.fields).filter(([,value])=>Boolean(value)))}));
      setParsedResumeText(result.extracted_text);
      setResumeMessage(`PDF parsed${result.ocr_provider==='gemini_ocr'?' with Gemini OCR':' locally'}. Review every field and the extracted text before saving.`);
    } catch(e) { setResumeMessage(e instanceof Error?e.message:'PDF could not be parsed.'); }
  };
  const analyzeResume = async () => { setResumeMessage('Reviewing resume content…'); try { const result=await api<any>('/api/v1/resumes/analyze',{method:'POST',body:JSON.stringify({content:resume,job_description:jobDescription})}); setAnalysis(result); setResumeMessage('Review complete.'); } catch(e) { setResumeMessage(e instanceof Error?e.message:'Analysis failed.'); } };
  const exportResumePdf = async () => {
    if (!user) { setResumeMessage('Sign in to generate a server-formatted PDF; browser print remains available.'); return; }
    setResumeMessage('Generating PDF…');
    const headers = new Headers({'Content-Type':'application/json'});
    const accessToken = localStorage.getItem('careercompass_access_token');
    if (accessToken) headers.set('Authorization',`Bearer ${accessToken}`);
    try {
      const response = await fetch(`${API}/api/v1/resumes/export-pdf`,{method:'POST',headers,body:JSON.stringify({title:resumeTitle,content:resume})});
      if (!response.ok) {
        let message = `Request failed (${response.status})`;
        try { const body = await response.json(); message = body.detail || message; } catch { /* use fallback */ }
        throw new Error(message);
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${resumeTitle.replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'')||'careercompass-resume'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(objectUrl),1000);
      setResumeMessage('PDF generated. The server did not save this exported copy.');
    } catch(e) { setResumeMessage(e instanceof Error?e.message:'PDF could not be generated.'); }
  };
  const saveSettings = async () => { if (!user) { setSettingsMessage('Sign in to save your profile settings.'); return; } try { await api('/api/v1/profile',{method:'PUT',body:JSON.stringify(profile)}); setSettingsMessage('Profile preferences saved.'); } catch(e) { setSettingsMessage(e instanceof Error?e.message:'Could not save settings.'); } };
  const printProgress = () => { document.body.dataset.printMode='progress'; const reset=()=>{delete document.body.dataset.printMode;}; window.addEventListener('afterprint',reset,{once:true}); window.print(); };
  const exportProgress = async () => {
    try {
      const source = user ? await api<any>('/api/v1/reports/summary') : { generated_at: new Date().toISOString(), progress: progress || { roadmapTasks: taskCount, completedTasks: completedCount, savedItems: savedCount }, latestAssessment: assessmentHistory[0] || localAssessment || null, note: 'CareerCompass planning summary; not a psychological, academic, admission, or employment certification.' };
      const payload = user ? source : { generatedAt: source.generated_at, progress: source.progress || { roadmapTasks: taskCount, completedTasks: completedCount, savedItems: savedCount }, latestAssessment: source.latestAssessment || localAssessment || null, note: source.note || 'CareerCompass planning summary; not a psychological, academic, admission, or employment certification.' };
      const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'careercompass-progress-summary.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setProgressMessage(user ? 'Progress summary downloaded from the API.' : 'Progress summary downloaded from your local browser.');
    } catch (error) {
      setProgressMessage(error instanceof Error ? error.message : 'Could not generate the progress report.');
    }
  };
  const deleteAccount = async () => { if (!user || !window.confirm('Permanently delete your CareerCompass account and account-backed data? This cannot be undone.')) return; try { await api('/api/v1/account',{method:'DELETE'}); ['careercompass_access_token','careercompass_tasks','careercompass_saved_careers','careercompass_latest_assessment','careercompass_assessment_draft'].forEach(k=>localStorage.removeItem(k)); window.location.href='/'; } catch(e) { setSettingsMessage(e instanceof Error?e.message:'Account could not be deleted.'); } };
  const downloadCsvTemplate = async () => {
    if (!user) { setAdminError('Sign in as an administrator before downloading the import template.'); return; }
    try {
      const headers = new Headers();
      const token = localStorage.getItem('careercompass_access_token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      const response = await fetch(`${API}/api/v1/admin/college-import-template`, { headers });
      if (!response.ok) { throw new Error(`Request failed (${response.status})`); }
      const payload = await response.json() as { filename: string; example_csv: string; note: string };
      const blob = new Blob([payload.example_csv + '\n'], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = payload.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setAdminError('');
      setCsvReport({ imported: false, valid: true, row_count: 0, message: payload.note, note: 'A starter CSV template was downloaded.' });
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'Could not download the CSV template.');
    }
  };
  const validateCsv = async () => { setAdminError(''); setCsvReport(null); try { setCsvReport(await api('/api/v1/admin/validate-college-csv',{method:'POST',body:JSON.stringify({csv_text:csvText})})); } catch(e) { setAdminError(e instanceof Error?e.message:'Validation failed.'); } };
  const importCsv = async () => { setAdminError(''); setCsvReport(null); try { setCsvReport(await api('/api/v1/admin/import-college-csv',{method:'POST',body:JSON.stringify({csv_text:csvText})})); setImportHistory(await api<any[]>('/api/v1/admin/import-history')); } catch(e) { setAdminError(e instanceof Error?e.message:'Import failed.'); } };
  const loadImportHistory = async () => { setAdminError(''); try { setImportHistory(await api<any[]>('/api/v1/admin/import-history')); } catch(e) { setAdminError(e instanceof Error?e.message:'Could not load import history.'); } };

  const selectedCareerNode = graphData?.nodes.find(n=>n.id===selectedGraphCareer && n.kind==='career');
  const selectedSkillNodes = graphData?.edges.filter(e=>e.source===selectedGraphCareer).map(e=>graphData?.nodes.find(n=>n.id===e.target)).filter(Boolean) || [];
  const runSkillGap = async () => { setGraphMessage('Comparing skill lists…'); const parsed=skillDraft.split(',').map(x=>x.trim()).filter(Boolean).map(entry=>{const match=entry.match(/^(.*?):\s*([0-5])$/);return match?{name:match[1].trim(),level:Number(match[2])}:{name:entry,level:1};}); const currentLevels=Object.fromEntries(parsed.map(item=>[item.name,item.level])); const requiredSkills=(careerDetails?.skills || selectedSkillNodes.map((n:any)=>n.label)); const targetLevels=Object.fromEntries(requiredSkills.map((skill:string)=>[skill,targetSkillLevel])); try { setGapResult(await api('/api/v1/skills/gap',{method:'POST',body:JSON.stringify({career_id:selectedGraphCareer,current_skills:parsed.map(item=>item.name),current_levels:currentLevels,target_levels:targetLevels})})); setGraphMessage('Skill comparison complete.'); } catch(e) { setGraphMessage(e instanceof Error?e.message:'Could not compare skills.'); } };
  const loadCareerRoadmap = async () => { setGraphMessage('Building a starter roadmap…'); try { setRoadmapResult(await api(`/api/v1/skills/roadmap/${encodeURIComponent(selectedGraphCareer)}`)); setGraphMessage('Starter roadmap ready.'); } catch(e) { setGraphMessage(e instanceof Error?e.message:'Could not build roadmap.'); } };
  const activeIdeaCatalog = ideaCatalog.length ? ideaCatalog : FALLBACK_IDEA_CATALOG;
  const ideasInInterest = activeIdeaCatalog.filter(i => ideaInterest === 'any' || i.interest === ideaInterest);
  const matchingIdeaResults = ideasInInterest.filter(i => i.budget === ideaBudget && i.time === ideaTime);
  const ideaFiltersRelaxed = ideaInterest !== 'any' && matchingIdeaResults.length < 6 && ideasInInterest.length >= 6;
  const ideaResults = (ideaFiltersRelaxed ? ideasInInterest : matchingIdeaResults)
    .slice(0, ideaInterest === 'any' ? 12 : undefined);

  if (page === 'features') return <main className="extra-page section-wrap"><div className="extra-heading"><span className="section-kicker">THE GUIDANCE TOOLKIT</span><h1>One place to <em>explore what comes next.</em></h1><p>CareerCompass connects interests, careers, college pathways and practical next steps. Each tool is designed to support decisions—not make promises.</p></div><div className="extra-feature-grid">{featureItems.map(([title,desc,dest],i)=><button className="extra-feature-card" key={title} onClick={()=>onNavigate(dest)}><span className="extra-feature-number">{String(i+1).padStart(2,'0')}</span><h2>{title}</h2><p>{desc}</p><span className="extra-card-link">Explore feature <ArrowRight size={15}/></span></button>)}</div><div className="extra-note"><ShieldCheck/><p>Data transparency matters: AI guidance, historical cutoff comparisons and demo job listings are labelled according to their actual data status.</p></div></main>;

  if (page === 'assistant') return (
    <main className="extra-page section-wrap">
      <div className="extra-heading">
        <span className="section-kicker">AFFU AI · CAREER GUIDE</span>
        <h1>Ask better questions. <em>Find useful next steps.</em></h1>
        <p>Affu can answer general questions and help you explore careers, education, skills, and CareerCompass features. Verify current admissions rules, fees, salaries, and live opportunities with trusted sources.</p>
      </div>
      <div className="assistant-layout">
        <section className="assistant-panel">
          <div className="assistant-panel-head">
            <span className="extra-icon"><Sparkles/></span>
            <div>
              <h2>Chat with Affu</h2>
              <small>{user ? 'Conversation saved to your account' : 'Sign in required · your API key stays on the server'}</small>
            </div>
          </div>
          <div className="chat-stream" aria-live="polite">
            {chatLoading && <div className="chat-empty"><strong>Loading saved conversation…</strong></div>}
            {!chatLoading && chat.length === 0 && <div className="chat-empty">
              <MessageCircle size={26}/>
              <strong>What are you trying to figure out?</strong>
              <p>Ask about careers, school subjects, technology, general questions, or how CareerCompass works.</p>
              <div className="suggestion-chips">
                <button onClick={() => setQuestion('What does CareerCompass AI do?')}>About CareerCompass</button>
                <button onClick={() => setQuestion('What skills should I build for software engineering?')}>Explore a career</button>
                <button onClick={() => setQuestion('Are the jobs shown in CareerCompass real vacancies?')}>Ask about app data</button>
              </div>
            </div>}
            {chat.map((m, i) => <div className={`chat-message ${m.role}`} key={i}>
              <span className="chat-role">{m.role === 'user' ? 'You' : 'Affu'}</span>
              {m.role === 'assistant' && m.provider && <span className="demo-chip">{m.provider === 'gemini-configured' ? 'Gemini' : 'Local retrieval'}</span>}
              <p>{m.text}</p>
              {m.sources?.length ? <div className="chat-sources">
                <strong>Sources used</strong>
                {m.sources.map(s => <span key={s.source_id}>{s.url?<a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>:s.title} <small>· {s.source_type}</small></span>)}
              </div> : null}
            </div>)}
            {chatBusy && <div className="chat-message assistant"><span className="chat-role">Affu</span><p>Thinking through your question…</p></div>}
          </div>
          <form className="chat-compose" onSubmit={ask}>
            <textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask Affu anything, or ask how CareerCompass works…" rows={2} maxLength={2000}/>
            <button className="btn btn-dark" disabled={chatLoading || chatBusy || question.trim().length < 3}>Ask Affu <ArrowRight size={16}/></button>
          </form>
          {chatError && <p className="inline-notice" role="alert">{chatError} {!user && <button className="text-link" onClick={onSignIn}>Sign in</button>}</p>}
        </section>
        <aside className="assistant-side">
          <div className="extra-side-card">
            <ShieldCheck/><h3>CareerCompass-aware</h3>
            <p>Affu can explain the app’s tools and limitations, answer general questions, and use the starter career catalogue as supporting context.</p>
          </div>
          <div className="extra-side-card">
            <BookOpen/><h3>What to verify</h3>
            <p>Admission dates, fees, eligibility, job openings, and salary claims change over time. Check current details with official or reputable sources.</p>
          </div>
        </aside>
      </div>
    </main>
  );

  if (page === 'resume') return (
    <main className="extra-page section-wrap">
      <div className="extra-heading">
        <span className="section-kicker">RESUME STUDIO</span>
        <h1>Show the work. <em>Make your skills visible.</em></h1>
        <p>Import a text-based PDF, review and edit its fields, compare keywords with a target description, and export a clean copy with your browser's print-to-PDF feature.</p>
      </div>
      <div className="resume-layout">
        <section className="resume-editor">
          <div className="resume-title-row">
            <label>Document title<input value={resumeTitle} onChange={e=>setResumeTitle(e.target.value)} maxLength={160}/></label>
            <label>Import text PDF<input type="file" accept=".pdf,application/pdf" disabled={!user} onChange={e=>{const file=e.currentTarget.files?.[0];if(file)void parseResumeFile(file,useGeminiOcr);e.currentTarget.value='';}}/></label>
            <button className="btn btn-outline" onClick={()=>void exportResumePdf()}><Download size={16}/> Download PDF</button>
            <button className="btn btn-quiet" onClick={()=>window.print()}><FileText size={16}/> Print / save PDF</button>
          </div>
          <label className="resume-ocr-consent"><input type="checkbox" checked={useGeminiOcr} onChange={e=>setUseGeminiOcr(e.target.checked)} disabled={!user}/><span>For scanned PDFs only, allow Gemini OCR. If enabled and the PDF has no selectable text, the file is sent to Google's Gemini API; check its current data terms before continuing.</span></label>
          {!user && <p className="extra-footnote">Sign in is required to upload a resume for parsing. Uploaded files are processed temporarily and are not saved by the parser.</p>}
          <div className="resume-fields">
            {([['full_name','Full name'],['headline','Target role / headline'],['email','Email'],['phone','Phone'],['location','Location'],['links','Portfolio / GitHub / LinkedIn'],['summary','Professional summary'],['education','Education'],['skills','Skills (comma separated)'],['projects','Projects and outcomes'],['experience','Experience / internships'],['certifications','Certifications / achievements']] as [string,string][]).map(([key,label])=><label className={['summary','education','skills','projects','experience','certifications'].includes(key)?'wide-field':''} key={key}>{label}{['summary','education','projects','experience','certifications'].includes(key)?<textarea rows={key==='summary'?3:4} value={resume[key]||''} onChange={e=>updateResume(key,e.target.value)} placeholder={`Add your ${label.toLowerCase()}…`}/>:<input value={resume[key]||''} onChange={e=>updateResume(key,e.target.value)} placeholder={label}/>}</label>)}
            <label className="wide-field">Target job description for keyword comparison<textarea rows={5} maxLength={12000} value={jobDescription} onChange={e=>setJobDescription(e.target.value)} placeholder="Paste the role description to compare its keywords with your resume."/></label>
          </div>
          <div className="resume-actions">
            <button className="btn btn-dark" onClick={()=>void saveResume()}><Save size={16}/> Save resume</button>
            <button className="btn btn-outline" onClick={()=>void analyzeResume()}><Target size={16}/> Review content</button>
            <button className="btn btn-quiet" onClick={()=>{setResume(resumeEmpty);setResumeId(null);setAnalysis(null);setParsedResumeText('');setResumeMessage('Draft cleared locally.');}}><Trash2 size={15}/> Clear draft</button>
          </div>
          {resumeMessage&&<p className="inline-notice" role="status">{resumeMessage}</p>}
          {parsedResumeText&&<details className="extra-panel"><summary>Review extracted PDF text (not saved)</summary><pre>{parsedResumeText}</pre></details>}
        </section>
        <aside className="resume-preview-wrap">
          <div className="resume-career-visual">
            <img src="/images/career-planning.jpg" alt="Students planning their next career steps together" loading="lazy" decoding="async"/>
            <span>Build your next step, one experience at a time.</span>
          </div>
          <div className="resume-preview" id="resume-print">
            <div className="resume-preview-top"><span>CAREERCOMPASS · RESUME PREVIEW</span><FileText size={17}/></div>
            <h2>{resume.full_name||'Your name'}</h2>
            <h3>{resume.headline||'Target role / professional headline'}</h3>
            <p className="resume-contact">{[resume.email,resume.phone,resume.location,resume.links].filter(Boolean).join(' · ')||'Email · Phone · Location · Portfolio'}</p>
            {([['summary','PROFILE'],['education','EDUCATION'],['skills','SKILLS'],['projects','PROJECTS'],['experience','EXPERIENCE'],['certifications','CERTIFICATIONS']] as [string,string][]).map(([key,label])=><section key={key}><h4>{label}</h4><p>{resume[key]||'Your content will appear here as you type.'}</p></section>)}
          </div>
          {analysis&&<div className="resume-analysis">
            <div className="analysis-score"><strong>{analysis.score}</strong><span>/ 100 content checklist</span></div>
            {Object.entries(analysis.checklist).map(([label,ok])=><p key={label}><span>{ok?'✓':'○'}</span>{label}</p>)}
            <ul>{analysis.tips.map(t=><li key={t}>{t}</li>)}</ul>
            {analysis.keyword_match&&<section><h3>Target-role keyword overlap: {analysis.keyword_match.coverage_percent}%</h3><p>Matched: {analysis.keyword_match.matched_keywords.join(', ')||'None found'}</p><p>Consider addressing truthfully: {analysis.keyword_match.missing_keywords.join(', ')||'No missing keywords from the selected sample'}</p><small>{analysis.keyword_match.note}</small></section>}
            <small>{analysis.disclaimer}</small>
          </div>}
        </aside>
      </div>
      <p className="extra-footnote">Text extraction runs on the CareerCompass backend and scanned-PDF OCR is optional and sent to Gemini only after consent. Neither parser saves the uploaded file. Resume drafts are stored in your account only when you choose Save. Server PDF downloads support Latin-script text; browser print supports additional system fonts. Review all extracted fields and keyword suggestions; they are not an employer ATS score or hiring prediction.</p>
    </main>
  );

  if (page === 'jobs') return (
    <main className="extra-page section-wrap">
      <div className="extra-heading">
        <span className="section-kicker">EARLY-CAREER DISCOVERY</span>
        <h1>Explore opportunities. <em>Prepare with intention.</em></h1>
        <p>Search remote job listings open to India through Himalayas, or public remote listings through Remotive. Review country and timezone restrictions for each listing.</p>
      </div>
      <JobRoleExplorer onSearchLiveJobs={role => {
        setJobSearch(role.title);
        setJobSkills(role.skills.join(', '));
        window.setTimeout(() => document.getElementById('live-job-search')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
      }} />
      <div className="jobs-toolbar" id="live-job-search">
        <label className="search-box"><Search size={18}/><input value={jobSearch} onChange={e => setJobSearch(e.target.value)} placeholder="Search roles or skills"/></label>
        <label className="search-box"><Search size={18}/><input value={jobSkills} onChange={e => setJobSkills(e.target.value)} placeholder="Match skills, comma separated"/></label>
        <span className="demo-chip">{jobsStatus === 'live' ? `LIVE · ${jobProvider.toUpperCase()}` : 'SEARCH UNAVAILABLE'}</span>
      </div>
      {jobSkills.trim() && <p className="extra-footnote">Keyword overlap with listing text/tags is a sorting aid, not a measure of job eligibility.</p>}
      {jobMessage && <p className="inline-notice">{jobMessage}</p>}
      {jobsLoading && <p className="inline-notice">Searching listings…</p>}
      {!jobsLoading && jobsStatus !== 'error' && jobs.length === 0 && <p className="inline-notice">No listings matched this search. Try another role or skill.</p>}
      <div className="jobs-grid" id="live-job-results">
        {jobs.map(job => <article className="job-card" key={job.id}>
          <div className="job-card-top">
            <span className="extra-icon"><BriefcaseBusiness/></span>
            {job.is_demo ? <span className="demo-chip">Illustrative sample</span> : <a className="demo-chip" href={job.source_url} target="_blank" rel="noopener noreferrer">Source: {job.source}</a>}
          </div>
          <h2>{job.title}</h2>
          <p className="job-company">{job.company} · {job.location}</p>
          {job.category && <p>{job.category}</p>}
          {job.skills?.length > 0 && <div className="job-skills">{job.skills.map((skill:string) => <span key={skill}>{skill}</span>)}</div>}
          {jobSkills.trim() && <p className="extra-footnote">Skill keyword match: {job.match_score ?? 0}%{job.matched_skills?.length ? ` · ${job.matched_skills.join(', ')}` : ''}</p>}
          <div className="job-card-bottom">
            <span>{job.type}</span>
            <span>
              {job.url && <a className="text-link" href={job.url} target="_blank" rel="noopener noreferrer">{job.source === 'Himalayas' ? 'Apply on Himalayas' : 'Open listing'} <ArrowRight size={14}/></a>}
              {job.is_demo && <button className="text-link" onClick={() => onNavigate('careers')}>Explore related careers <ArrowRight size={14}/></button>}
            </span>
          </div>
        </article>)}
      </div>
      <div className="extra-note"><CircleAlert/><p>Check details and availability on the listing source. Provider listings can change or expire.</p></div>
    </main>
  );

  if (page === 'progress') return <main className="extra-page section-wrap"><div className="extra-heading"><span className="section-kicker">YOUR PROGRESS</span><h1>Small steps add up to <em>real momentum.</em></h1><p>Review your activity and keep the next action manageable.</p></div><section className="progress-print"><h1>CareerCompass AI · Progress Summary</h1><p>Generated: {new Date().toLocaleString()}</p><p>Student: {user?.name||'Guest'}</p><ul><li>Assessment attempts: {progress?.assessment_count??(localAssessment?1:0)}</li><li>Roadmap tasks: {progress?.roadmap_tasks??taskCount}</li><li>Tasks completed: {progress?.completed_tasks??completedCount}</li><li>Saved items: {progress?.saved_items??savedCount}</li></ul><h2>Latest interest reflection</h2><p>{assessmentHistory[0]?.result_title||localAssessment?.title||'No completed reflection yet'}</p>{Object.entries(assessmentHistory[0]?.scores||localAssessment?.scores||{}).map(([key,val])=><p key={key}>{key}: {String(val)}/12</p>)}<p>These are planning aids, not validated psychological, academic, admissions, or employment predictions.</p></section>{user? <>{progressMessage&&<p className="inline-notice">{progressMessage}</p>}<div className="progress-metrics"><div><span>Assessment attempts</span><strong>{progress?.assessment_count??'—'}</strong></div><div><span>Roadmap tasks</span><strong>{progress?.roadmap_tasks??taskCount}</strong></div><div><span>Tasks completed</span><strong>{progress?.completed_tasks??completedCount}</strong></div><div><span>Saved items</span><strong>{progress?.saved_items??savedCount}</strong></div></div>{(assessmentHistory.length>0||localAssessment)&&<div className="extra-panel latest-assessment"><h2>Latest interest reflection</h2>{assessmentHistory.length>0?<><strong>{assessmentHistory[0].result_title}</strong><p>Version: {assessmentHistory[0].version||'legacy reflection'} · Saved to your account.</p>{assessmentHistory[0].scores&&Object.entries(assessmentHistory[0].scores).map(([key,val])=><p key={key}>{key}: {String(val)}/12</p>)}</>:<><strong>{localAssessment.title}</strong><p>Version: {localAssessment.version} · Stored in this browser.</p>{Object.entries(localAssessment.scores||{}).map(([key,val])=><p key={key}>{key}: {String(val)}/12</p>)}</>}<div className="resume-actions"><button className="btn btn-outline" onClick={exportProgress}><Download size={15}/> Export JSON</button><button className="btn btn-dark" onClick={printProgress}><FileText size={15}/> Print / save as PDF</button></div></div>}<div className="extra-panel"><h2>Your next review</h2><p>Revisit your interests after you complete a project, course, or internship. Preferences can change as you learn more.</p><button className="btn btn-dark" onClick={()=>onNavigate('dashboard')}>Open roadmap <ArrowRight size={16}/></button></div></>:<div className="extra-panel"><LockKeyhole/><h2>Sign in to see account history</h2><p>Account-backed progress includes assessment count, roadmap tasks, completed tasks, and saved items.</p><button className="btn btn-dark" onClick={onSignIn}>Sign in <ArrowRight size={16}/></button><p className="extra-footnote">This browser may contain guest tasks, but they are not synced to an account.</p></div>}</main>;

  if (page === 'settings') return <main className="extra-page section-wrap"><div className="extra-heading"><span className="section-kicker">PREFERENCES</span><h1>Make this space <em>work for you.</em></h1><p>Update your education context, language preference, and location.</p></div><div className="settings-layout"><section className="extra-panel settings-form"><h2>Student profile</h2><label>Education stage<select value={profile.education_stage} onChange={e=>setProfile({...profile,education_stage:e.target.value})}><option>After 10th</option><option>After 12th</option><option>College student</option><option>Graduate / early career</option><option>Career explorer</option></select></label><label>Preferred language<select value={profile.preferred_language} onChange={e=>{const value=e.target.value;if(value==='en'||value==='kn'||value==='hi'){setProfile({...profile,preferred_language:value});onLanguageChange(value);}}}><option value="en">English</option><option value="kn">ಕನ್ನಡ (Kannada preference)</option><option value="hi">हिन्दी (Hindi preference)</option></select></label><label>City / region<input value={profile.location} onChange={e=>setProfile({...profile,location:e.target.value})} placeholder="e.g. Mandya, Karnataka" maxLength={120}/></label><label>Interests<input value={profile.interests.join(', ')} onChange={e=>setProfile({...profile,interests:e.target.value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,30)})} placeholder="e.g. technology, design, healthcare"/></label><button className="btn btn-dark" onClick={()=>void saveSettings()}><Save size={16}/> Save preferences</button>{settingsMessage&&<p className="inline-notice" role="status">{settingsMessage}</p>}{!user&&<p className="extra-footnote">Sign in to persist profile settings. Theme preference is stored in this browser.</p>}</section><section className="extra-panel"><h2>Appearance</h2><p>Switch between the standard light interface and a low-glare dark theme.</p><button className="btn btn-outline" onClick={()=>setDark(!dark)}>{dark?<Sun size={16}/>:<Moon size={16}/>} {dark?'Use light theme':'Use dark theme'}</button><div className="settings-hint"><HeartHandshake/><p>Language preference is saved, but complete translation of every page is still a separate localization task. This setting does not falsely claim that all content is translated.</p></div></section>{user&&<section className="extra-panel account-danger"><h2>Account and data</h2><p>You can permanently delete your account and account-backed assessments, roadmap tasks, resumes, bookmarks, profile, and chat history.</p><button className="btn btn-outline" onClick={()=>void deleteAccount()}><Trash2 size={15}/> Delete my account and data</button></section>}</div></main>;

  if (page === 'sources') return (
    <main className="extra-page section-wrap">
      <div className="extra-heading">
        <span className="section-kicker">DATA PROVENANCE</span>
        <h1>Know where the information <em>comes from.</em></h1>
        <p>CareerCompass distinguishes local starter content from imported records and external integrations.</p>
      </div>
      <div className="source-status-grid">
        <article className="extra-panel">
          <span className="demo-chip">LOCAL STARTER CATALOGUE</span>
          <h2>Career profiles</h2>
          <p>Career titles, summaries, and skill lists are curated starter content, not a live labour-market dataset.</p>
        </article>
        <article className="extra-panel">
          <span className="demo-chip">KAGGLE · CC BY-SA 4.0</span>
          <h2>College cutoff records</h2>
          <p>KCET engineering historical records for 2023–2025 are bundled from a Kaggle community dataset credited to Sowmith Shetty. The uploader says they were compiled from KEA reports, but CareerCompass has not independently verified them. The importer adds this source once without replacing other cutoff records; check each record with KEA before relying on it.</p>
          <button className="btn btn-outline" onClick={() => onNavigate('admin')}>Open data administration <ArrowRight size={15}/></button>
          <a href="https://www.kaggle.com/datasets/sowmithns/kcet-college-admission-and-cutoff-trends-2023-2024" target="_blank" rel="noopener noreferrer">Dataset and license details ↗</a>
        </article>
        <article className="extra-panel">
          <span className="demo-chip">KAGGLE · CC BY-SA 4.0</span>
          <h2>JoSAA JEE cutoffs</h2>
          <p>Round-wise JoSAA historical records for 2016–2026 are bundled from a Kaggle community compilation by Gopi Krishnan R. The source claims to use JoSAA archive records, but CareerCompass has not independently verified them. Preparatory and non-integer ranks are excluded; verify current rules with JoSAA.</p>
          <a href="https://www.kaggle.com/datasets/gopikrishnan2005/josaa-opening-and-closing-ranks-dataset-20162026" target="_blank" rel="noopener noreferrer">Dataset and license details ↗</a>
        </article>
        <article className="extra-panel">
          <span className="demo-chip">SYNTHETIC DEMO · NOT MCC DATA</span>
          <h2>NEET college cutoffs</h2>
          <p>To demonstrate the search flow, NEET now has synthetic rank references for ranks 1–10,000, MBBS/BDS, and General, OBC, EWS, SC, and ST labels in an AIQ-style sample. They are not MCC allotment results, historical cutoffs, year/round-specific data, or admission estimates. Official NEET data are still not bundled; verify counselling information with MCC.</p>
          <a href="https://cutoffs.collegekampus.com/" target="_blank" rel="noopener noreferrer">Visit CollegeKampus cutoffs ↗</a>
          <a href="https://mcc.nic.in/ug-medical-counselling/" target="_blank" rel="noopener noreferrer">Visit MCC counselling ↗</a>
        </article>
        <article className="extra-panel">
          <span className="demo-chip">ILLUSTRATIVE ESTIMATES · NOT LIVE</span>
          <h2>Roles and salary ranges</h2>
          <p>The jobs page includes field-based role ideas and broad annual INR ranges for Bengaluru, Chennai (Tamil Nadu), and Hyderabad. These are illustrative planning estimates, not a city-level salary survey, live vacancies, or a promise of compensation. Check current job offers and requirements with employers and professional bodies.</p>
        </article>
        <article className="extra-panel">
          <span className="demo-chip">OPENSTREETMAP · NOMINATIM</span>
          <h2>Approximate campus map locations</h2>
          <p>Map lookups run only when you choose “View map” for a college. Coordinates come from OpenStreetMap Nominatim and may identify an approximate place rather than a verified campus entrance. Results are cached in memory until the app is reloaded, with at least 1.1 seconds between lookups in a tab; total site-wide traffic must still comply with the public service limits. This is not a bulk geocoding service.</p>
          <a href="https://operations.osmfoundation.org/policies/nominatim/" target="_blank" rel="noopener noreferrer">Nominatim usage policy ↗</a>
          <a href="https://operations.osmfoundation.org/policies/tiles/" target="_blank" rel="noopener noreferrer">OpenStreetMap tile usage policy ↗</a>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap attribution ↗</a>
        </article>
        <article className="extra-panel">
          <span className="demo-chip">HIMALAYAS REMOTE JOBS API</span>
          <h2>Job listings</h2>
          <p>The jobs page searches Himalayas remote jobs open to India; a free API key is optional. Himalayas results link to the source and preserve its application links. If Himalayas is unavailable, the page falls back to Remotive. Check country and timezone restrictions before applying.</p>
        </article>
        <article className="extra-panel">
          <span className="demo-chip">OPTIONAL GEMINI INTEGRATION</span>
          <h2>Affu AI</h2>
          <p>When configured on the backend, Gemini answers general questions and explains CareerCompass. Without it, Affu uses a limited local career-catalogue fallback. Never put API keys in frontend variables.</p>
        </article>
      </div>
      <div className="extra-note"><ShieldCheck/><p>Verify course eligibility, fees, admission dates, job details, and other current facts with official or reputable sources.</p></div>
    </main>
  );

  if (page === 'privacy') return (
    <main className="extra-page section-wrap legal-page">
      <div className="extra-heading">
        <span className="section-kicker">PRIVACY INFORMATION</span>
        <h1>Your information should stay <em>under your control.</em></h1>
        <p>Implementation-specific privacy summary for this development build.</p>
      </div>
      <article className="extra-panel">
        <h2>Information stored</h2>
        <p>When you register, the backend stores your name, email address, password hash, profile preferences, assessment answers and scores, roadmap tasks, resume drafts you choose to save, bookmarks, and assistant conversation history. The app stores an access token and some guest preferences in browser local storage.</p>
        <h2>External services</h2>
        <p>When Gemini is configured, your Affu question and selected career context are sent from the backend to Google Gemini and the resulting conversation is saved to your account. Your job-search query is sent from the backend to Himalayas; any API key stays on the backend. Do not include sensitive personal information in chat prompts or search terms. Provider privacy and retention terms also apply.</p>
        <h2>Access and deletion</h2>
        <p>Account-backed endpoints require a bearer token and filter records by the signed-in user. The Settings page offers account deletion for the current development implementation. Browser-local data can be removed by clearing the site's local storage.</p>
        <h2>Important limitations</h2>
        <p>This is a student project baseline, not a completed legal compliance or security audit. Before public deployment, configure HTTPS, database backups, logging controls, retention rules, provider disclosures, and a reviewed privacy policy.</p>
        <p className="extra-footnote">This page describes the current implementation and is not legal advice.</p>
      </article>
    </main>
  );

  if (page === 'terms') return (
    <main className="extra-page section-wrap legal-page">
      <div className="extra-heading">
        <span className="section-kicker">TERMS AND LIMITATIONS</span>
        <h1>Use guidance as a start, <em>not a guarantee.</em></h1>
        <p>Plain-language terms summary for the project prototype.</p>
      </div>
      <article className="extra-panel">
        <h2>Educational guidance only</h2>
        <p>CareerCompass AI is an exploratory student project. Assessment scores, career profiles, skill-gap comparisons, roadmaps, business ideas, and AI answers are informational aids, not professional psychological, academic, financial, legal, or employment advice.</p>
        <h2>Admissions and employment</h2>
        <p>Historical closing ranks do not guarantee admission. Jobs in demo mode are synthetic; when live provider listings are enabled, check each listing at its source because availability can change. No employment, salary, admission, or business outcome is promised.</p>
        <h2>Accuracy and verification</h2>
        <p>Users should verify deadlines, eligibility, fees, accreditation, licensing, job details, and other current facts with the responsible official institution or provider. Data imports require provenance fields but structural validation cannot prove truth or completeness.</p>
        <h2>Acceptable use</h2>
        <p>Do not submit another person's personal information without permission, attempt to access another user's data, or use the platform to make discriminatory or harmful decisions.</p>
        <p className="extra-footnote">This is a prototype terms summary. Obtain appropriate review before public or institutional use.</p>
      </article>
    </main>
  );

  if (page === 'careerDetail') return <main className="extra-page section-wrap"><button className="text-link back-link" onClick={()=>onNavigate('careers')}>← Back to career explorer</button>{careerDetailError?<div className="extra-panel"><h2>Career profile unavailable</h2><p>{careerDetailError}</p><button className="btn btn-dark" onClick={()=>onNavigate('careers')}>Browse careers</button></div>:!careerDetails?<div className="extra-panel"><p>Loading career profile…</p></div>:<><div className="career-detail-hero"><span className="section-kicker">{careerDetails.category}</span><h1>{careerDetails.title}</h1><p>{careerDetails.summary}</p><div className="job-skills">{careerDetails.skills.map((skill:string)=><span key={skill}>{skill}</span>)}</div></div><div className="career-detail-grid"><section className="extra-panel"><h2>Skills to investigate</h2><p>These are starter skills associated with this profile. Compare them with current job descriptions in your location.</p><div className="job-skills">{careerDetails.skills.map((skill:string)=><span key={skill}>{skill}</span>)}</div><h3>Ways to learn more</h3><ul>{(careerDetails.work_examples||[]).map((x:string)=><li key={x}>{x}</li>)}</ul><p className="extra-footnote">{careerDetails.data_status}</p><button className="btn btn-dark" onClick={()=>onNavigate('graph')}>Explore career connections <ArrowRight size={15}/></button></section><section className="extra-panel"><h2>Build your first roadmap</h2><p>Generate a practical sequence of learning and evidence-building steps for this career.</p><button className="btn btn-outline" onClick={()=>void loadCareerRoadmap()}>Generate roadmap <BookOpen size={15}/></button>{roadmapResult&&<div className="roadmap-milestones">{roadmapResult.milestones.map((m:any)=><div key={m.order}><span>{String(m.order).padStart(2,'0')}</span><section><strong>{m.title}</strong><p>{m.task}</p><small>{m.evidence}</small></section></div>)}</div>}{graphMessage&&<p className="inline-notice">{graphMessage}</p>}</section></div></>}</main>;

  if (page === 'graph') return <main className="extra-page section-wrap"><div className="extra-heading"><span className="section-kicker">CAREER CONNECTIONS</span><h1>See the links between <em>roles and skills.</em></h1><p>Explore a simple, accessible 2D relationship map. Connections are curated starter mappings, not labour-market statistical claims.</p></div><div className="graph-layout"><section className="extra-panel graph-explorer"><label>Choose a career<select value={selectedGraphCareer} onChange={e=>{setSelectedGraphCareer(e.target.value);setGapResult(null);setRoadmapResult(null);}}>{(graphData?.nodes||[]).filter(n=>n.kind==='career').map(n=><option key={n.id} value={n.id}>{n.label}</option>)}</select></label>{graphMessage&&<p className="inline-notice" role="status">{graphMessage}</p>}<div className="relationship-map"><div className="relationship-center"><Target/><strong>{selectedCareerNode?.label||'Career profile'}</strong><small>Career node</small></div><div className="relationship-connector"/><div className="relationship-skills">{selectedSkillNodes.map((n:any)=><div key={n.id} className="relationship-skill"><span/>{n.label}</div>)}</div></div><div className="graph-skill-form"><label>Your current skills and proficiency (0–5)<input value={skillDraft} onChange={e=>setSkillDraft(e.target.value)} placeholder="e.g. Python:2, Git:1, SQL:3"/></label><label>Target proficiency for required skills<select value={targetSkillLevel} onChange={e=>setTargetSkillLevel(Number(e.target.value))}><option value={1}>1 · Awareness</option><option value={2}>2 · Beginner</option><option value={3}>3 · Working knowledge</option><option value={4}>4 · Strong practical skill</option><option value={5}>5 · Advanced</option></select></label><div className="resume-actions"><button className="btn btn-dark" onClick={()=>void runSkillGap()}>Compare skill gap <ArrowRight size={15}/></button><button className="btn btn-outline" onClick={()=>void loadCareerRoadmap()}>Build starter roadmap <BookOpen size={15}/></button></div></div>{gapResult&&<div className="gap-result"><h3>Skill comparison: {gapResult.career_title}</h3><p><strong>Skills you listed that match:</strong> {gapResult.matched_skills.join(', ')||'None matched exactly yet'}</p><p><strong>Skills to explore:</strong> {gapResult.skills_to_explore.join(', ')||'You listed all skills in this starter profile'}</p><div className="skill-level-table">{gapResult.skill_levels?.map((item:any)=><div key={item.skill}><span>{item.skill}</span><small>Current {item.current_level}/5 · Target {item.target_level}/5</small><strong>{item.gap} level gap</strong></div>)}</div><small>{gapResult.note}</small></div>}{roadmapResult&&<div className="roadmap-milestones"><h3>{roadmapResult.career_title}: starter milestones</h3>{roadmapResult.milestones.map((m:any)=><div key={m.order}><span>{String(m.order).padStart(2,'0')}</span><section><strong>{m.title}</strong><p>{m.task}</p><small>Evidence: {m.evidence}</small></section></div>)}</div>}</section><aside className="extra-side-card graph-side"><BookOpen/><h3>How to use this view</h3><p>Select a career, review the related skills, and compare them with your self-reported skills. A missing skill means “worth investigating,” not that you are unqualified.</p><p>Learning resource links are intentionally omitted until a verified resource registry is configured.</p></aside></div></main>;

  if (page === 'ideas') return (
    <main className="extra-page section-wrap">
      <div className="extra-heading">
        <span className="section-kicker">IDEA LAB</span>
        <h1>Start small. <em>Test what people need.</em></h1>
        <p>Explore project or micro-business ideas based on your interests and available budget. Validate demand before investing money.</p>
      </div>
      <section className="extra-panel idea-controls">
        <label>Interest area
          <select value={ideaInterest} onChange={e=>setIdeaInterest(e.target.value)}>
            {IDEA_INTERESTS.map(interest => <option key={interest.value} value={interest.value}>{interest.label}</option>)}
            <option value="any">Any area</option>
          </select>
        </label>
        <label>Available starting budget
          <select value={ideaBudget} onChange={e=>setIdeaBudget(e.target.value)}>
            <option value="under-5000">Under ₹5,000</option>
            <option value="5000-20000">₹5,000–₹20,000</option>
            <option value="20000-plus">₹20,000+</option>
          </select>
        </label>
        <label>Time available
          <select value={ideaTime} onChange={e=>setIdeaTime(e.target.value)}>
            <option value="weekends">Weekends</option>
            <option value="part-time">Part-time</option>
            <option value="planned">Planned project</option>
          </select>
        </label>
      </section>
      {ideaMessage && <p className="inline-notice">{ideaMessage}</p>}
      {ideaFiltersRelaxed && <p className="inline-notice">The selected budget and time match fewer than six ideas. Showing all ideas for this field; each card shows its budget and time.</p>}
      <div className="jobs-grid idea-grid">
        {ideaResults.length ? ideaResults.map((idea, i) => (
          <article className="job-card idea-card" key={idea.id || idea.title}>
            <span className="extra-feature-number">IDEA {String(i+1).padStart(2,'0')}</span>
            <h2>{idea.title}</h2>
            <p>{idea.description}</p>
            <div className="job-skills">
              <span>{idea.time}</span>
              <span>{idea.budget==='under-5000'?'Under ₹5k':idea.budget==='5000-20000'?'₹5k–₹20k':'₹20k+'}</span>
            </div>
            <div className="idea-test"><strong>First validation step</strong><p>{idea.test}</p></div>
          </article>
        )) : <div className="extra-panel idea-empty"><h2>No ideas match all three filters yet.</h2><p>Try a different interest area, budget, or time commitment. This tool intentionally avoids inventing an investment recommendation.</p></div>}
      </div>
      <div className="extra-note"><CircleAlert/><p>Ideas are examples, not a forecast of profit or demand. Do not borrow or spend heavily based on this page. Validate customer needs, legal requirements, costs and risks first.</p></div>
    </main>
  );

  if (page === 'admin') return <main className="extra-page section-wrap"><div className="extra-heading"><span className="section-kicker">ADMINISTRATION</span><h1>Review data before <em>it reaches students.</em></h1><p>Validate and import historical college cutoff CSV records with provenance fields. Structural validation does not independently prove source accuracy. Each successful import replaces the active cutoff dataset; upload a complete consolidated file.</p></div>{!user?<div className="extra-panel"><LockKeyhole/><h2>Protected area</h2><p>Sign in with an account configured as an administrator on the backend.</p><button className="btn btn-dark" onClick={onSignIn}>Sign in</button></div>:<div className="extra-panel admin-panel"><label>Paste CSV contents<textarea value={csvText} onChange={e=>setCsvText(e.target.value)} rows={10} placeholder="exam,year,college_name,course,state,category,quota,round,closing_rank,source_url,source_checked_on&#10;..."/></label><div className="resume-actions"><button className="btn btn-quiet" onClick={()=>void loadImportHistory()}>Load import history</button><button className="btn btn-quiet" onClick={()=>void downloadCsvTemplate()}>Download template</button><button className="btn btn-outline" onClick={()=>void validateCsv()} disabled={!csvText.trim()}>Validate only <CheckCircle2 size={16}/></button><button className="btn btn-dark" onClick={()=>void importCsv()} disabled={!csvText.trim()}>Validate and import <Save size={16}/></button><button className="btn btn-quiet" onClick={()=>{setCsvText('');setCsvReport(null);setAdminError('');}}>Clear</button></div>{adminError&&<p className="auth-inline-error" role="alert">{adminError}</p>}{importHistory.length>0&&<div className="validation-report"><h2>Recent import history</h2>{importHistory.map((item:any)=><p key={item.id}>#{item.id} · {item.status} · {item.row_count} rows · {new Date(item.created_at).toLocaleString()}</p>)}</div>}{csvReport&&<div className="validation-report"><h2>{csvReport.valid?'CSV structure passed':csvReport.imported?'Dataset imported':'CSV validation / import result'}</h2><p>{csvReport.row_count} data rows checked {csvReport.imported?' · imported':''}</p>{csvReport.errors?.map((x:string,i:number)=><p key={i}>• {x}</p>)}{csvReport.message&&<p>{csvReport.message}</p>}<small>{csvReport.note}</small></div>}<p className="extra-footnote">Validation alone does not import data. Import replaces the active cutoff dataset in the database and records an audit entry; it does not independently verify source truth. Only HTTPS source URLs and ISO dates are accepted.</p></div>}</main>;
  return null;
}

// Country names use Intl.DisplayNames for all seven languages. Keep the eligibility
// answer in the browser; only an initial study goal is used during account creation.
export const spanishOfficialCountries=['AR','BO','CL','CO','CR','CU','DO','EC','SV','GQ','GT','HN','MX','NI','PA','PY','PE','ES','UY','VE'];
export const requirementsSource='https://examenes.cervantes.es/es/dele/que-es';
export const manual={id:'ccse-manual-2026',year:2026,url:'https://examenes.cervantes.es/sites/default/files/manual_ccse_2026.pdf',source:'https://examenes.cervantes.es/es/ccse/preparar-prueba'};
const key='rumbo-exam-requirements';
export function readExamAnswer(){try{const value=localStorage.getItem(key);return ['yes','no','unsure'].includes(value)?value:null;}catch{return null;}}
export function saveExamAnswer(value){try{localStorage.setItem(key,value);}catch{}}
export const initialStudyGoal=()=>readExamAnswer()==='yes'?'ccse':'both';

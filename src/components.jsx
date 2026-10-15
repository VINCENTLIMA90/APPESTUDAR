import React, { useEffect, useRef } from 'react';
import { ArrowUpRight, BookOpen, Building2, Check, ChevronRight, Compass, Headphones, Landmark, LockKeyhole, Map, Mic, PenLine, Sun, X } from 'lucide-react';
export const icons = { landmark: Landmark, map: Map, sun: Sun, building: Building2, book: BookOpen, headphones: Headphones, pen: PenLine, mic: Mic };
export function Brand({ small = false }) { return <div className={'brand ' + (small ? 'small' : '')}><span className="brand-mark"><Compass size={25} strokeWidth={1.8} /></span><span>rumbo<span className="brand-dot">.</span></span></div>; }
export function Arrow({ external = false }) { return external ? <ArrowUpRight size={17} /> : <ChevronRight size={18} className="directional" />; }
export function ProgressBar({ value = 0 }) { return <div className="progress-track" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, value)}%` }} /></div>; }
export function Modal({ children, onClose, title, t, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const focusable = () => ref.current?.querySelectorAll('button:not(:disabled), input, select, textarea, a[href]');
    focusable()?.[0]?.focus();
    function key(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const elements = [...focusable()];
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }
    document.addEventListener('keydown', key);
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section ref={ref} className={'modal ' + (wide ? 'wide' : '')} role="dialog" aria-modal="true" aria-label={title}><button className="icon-button modal-close" aria-label={t('close')} onClick={onClose}><X size={20} /></button>{children}</section></div>;
}
export function LessonCard({ lesson, lang, t, completed, onClick }) {
  const Icon = icons[lesson.icon];
  return <button className={'lesson-card '+(lesson.locked?'lesson-locked':'')} onClick={onClick}><span className={'lesson-art ' + lesson.module}><Icon size={31} strokeWidth={1.5} /><span className="art-circle" /></span><span className="lesson-card-content"><span className="eyebrow">{lesson.module === 'ccse' ? 'CCSE' : 'DELE A2'} <span>·</span> {String(lesson.position).padStart(2,'0')} <span>·</span> {lesson.minutes} {t('minutes')}</span><strong>{lesson.title[lang]}</strong><span className={'lesson-access '+(lesson.free?'is-free':'')}>{lesson.free?t('freeLesson'):lesson.locked?<><LockKeyhole size={12}/>{t('availableInPlan')}</>:t('premiumLesson')}</span><span className="lesson-card-footer">{completed ? <><Check size={15} />{t('done')}</> : <>{t(lesson.locked?'viewPlans':'continue')}<Arrow /></>}</span></span></button>;
}
export function SpainIllustration() {
  return <svg className="spain-illustration" viewBox="0 0 420 285" aria-hidden="true"><defs><pattern id="tiles" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M0 0L11 11L0 22M22 0L11 11L22 22" fill="none" stroke="#648770" strokeWidth="1" /></pattern></defs><circle cx="280" cy="87" r="52" fill="#efd58e"/><path d="M20 235Q130 182 239 227Q340 183 420 236V285H20Z" fill="#b0c0a6"/><path d="M119 241V109l70-42 71 42v132" fill="#e9b79d"/><path d="M108 109L189 59l82 50" fill="none" stroke="#a9634b" strokeWidth="11" strokeLinejoin="round"/><path d="M140 241v-68a49 49 0 0198 0v68" fill="#faf3db"/><path d="M155 241v-63a34 34 0 0168 0v63" fill="#315443"/><path d="M157 241v-60a32 32 0 0164 0v60" fill="url(#tiles)"/><path d="M184 144v97M154 188h69" stroke="#e4c991" strokeWidth="3"/><rect x="173" y="94" width="33" height="27" rx="16" fill="#faf3db"/><path d="M189 95v26M173 108h33" stroke="#a9634b" strokeWidth="3"/><path d="M260 241V148h91v93" fill="#f6e7bf"/><path d="M254 148h105l-13-17h-77z" fill="#ba7558"/><rect x="282" y="172" width="38" height="42" rx="18" fill="#7a9980"/><path d="M300 172v42" stroke="#f6e7bf" strokeWidth="3"/><path d="M35 246h334" stroke="#b89b77" strokeWidth="3"/><path d="M79 232v-80M79 206c-26-12-34-32-25-43 14 5 23 18 25 29M80 185c18-10 24-30 17-43-15 5-22 21-17 43M80 226c18-5 32-22 29-34-15 0-27 13-29 34" fill="#4b7156" stroke="#4b7156" strokeWidth="4"/><path d="M58 230h40l-6 28H64Z" fill="#bd7858"/><path d="M342 233v-43M343 205c-12-9-12-23-4-31 10 7 12 22 4 31M343 224c12-7 17-18 12-27-10 4-16 15-12 27" fill="#52745a" stroke="#52745a" strokeWidth="4"/><path d="M329 231h29l-4 22h-22Z" fill="#d1966f"/><path d="M276 52q8-10 16 0q8-10 16 0M317 75q6-8 12 0q6-8 12 0" stroke="#657c64" fill="none" strokeWidth="2"/><path d="M163 266q43-20 87 0" stroke="#e3d7b7" fill="none" strokeWidth="8"/></svg>;
}

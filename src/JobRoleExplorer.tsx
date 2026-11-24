import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { JOB_CITIES, JOB_FIELDS, JOB_ROLES, type JobCity, type JobField, type JobRole } from './jobRoles';
import './JobRoleExplorer.css';

type Props = {
  onSearchLiveJobs: (role: JobRole) => void;
};

export default function JobRoleExplorer({ onSearchLiveJobs }: Props) {
  const [field, setField] = useState<JobField>('CSE');
  const [city, setCity] = useState<JobCity>('Bengaluru');
  const roles = useMemo(() => JOB_ROLES.filter(item => item.field === field), [field]);

  return (
    <section className="job-role-explorer" aria-labelledby="job-role-explorer-title">
      <div className="job-role-explorer-heading">
        <span className="panel-eyebrow">CAREER IDEAS BY STUDY FIELD</span>
        <h2 id="job-role-explorer-title">Explore roles that connect to your field</h2>
        <p>Choose a field and city to explore sample career paths and broad entry-level salary estimates.</p>
      </div>
      <div className="job-role-filters">
        <label>
          Study field
          <select aria-label="Study field" value={field} onChange={event => setField(event.target.value as JobField)}>
            {JOB_FIELDS.map(option => <option value={option.id} key={option.id}>{option.label}</option>)}
          </select>
        </label>
        <label>
          Salary estimate location
          <select aria-label="Salary estimate location" value={city} onChange={event => setCity(event.target.value as JobCity)}>
            {JOB_CITIES.map(option => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
      </div>
      <p className="job-role-estimate-note">
        Illustrative annual estimates in INR (LPA), not live salary data or a job offer. Actual pay varies by experience,
        employer, qualifications, and current market. City selection changes the estimate only; live listings may be remote
        or location-restricted.
      </p>
      <div className="job-role-grid">
        {roles.map(item => {
          const salary = item.annualSalaryLpa?.[city];
          return (
            <article className="job-role-card" key={`${item.field}-${item.title}`}>
              <span className="demo-chip">{item.field}</span>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <div className="job-skills">{item.skills.map(skill => <span key={skill}>{skill}</span>)}</div>
              <div className="job-role-salary">
                <small>Indicative annual range · {city}</small>
                <strong>
                  {salary
                    ? `₹${salary[0]}–${salary[1]} LPA`
                    : 'Highly variable; no reliable city range'}
                </strong>
              </div>
              {item.qualificationNote && <p className="job-role-qualification">{item.qualificationNote}</p>}
              <button
                type="button"
                className="text-link"
                aria-label={`Search live listings for ${item.title}`}
                onClick={() => onSearchLiveJobs(item)}
              >
                Search live listings <ArrowRight size={14}/>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

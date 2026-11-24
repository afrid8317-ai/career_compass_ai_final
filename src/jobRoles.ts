export const JOB_FIELDS = [
  { id: 'CSE', label: 'Computer Science (CSE)' },
  { id: 'ISE', label: 'Information Science (ISE)' },
  { id: 'ECE', label: 'Electronics & Communication (ECE)' },
  { id: 'Mechanical', label: 'Mechanical Engineering' },
  { id: 'Civil', label: 'Civil Engineering' },
  { id: 'MBBS', label: 'Medicine (MBBS)' },
  { id: 'Dentistry', label: 'Dentistry' },
  { id: 'Cricket', label: 'Cricket' },
  { id: 'Football', label: 'Football' },
] as const;

export type JobField = typeof JOB_FIELDS[number]['id'];
export const JOB_CITIES = ['Bengaluru', 'Chennai, Tamil Nadu', 'Hyderabad'] as const;
export type JobCity = typeof JOB_CITIES[number];
type LpaRange = [number, number];
type SalaryEstimate = Record<JobCity, LpaRange>;
export type JobRole = {
  field: JobField;
  title: string;
  summary: string;
  skills: string[];
  annualSalaryLpa: SalaryEstimate | null;
  qualificationNote?: string;
};

const estimate = (bengaluru: LpaRange, chennai: LpaRange, hyderabad: LpaRange): SalaryEstimate => ({
  Bengaluru: bengaluru,
  'Chennai, Tamil Nadu': chennai,
  Hyderabad: hyderabad,
});

const salaryBands = {
  software: estimate([4, 16], [3.5, 12], [4, 15]),
  softwareSpecialist: estimate([6, 24], [5, 18], [6, 22]),
  analyst: estimate([3.5, 10], [3, 8.5], [3.5, 9.5]),
  embedded: estimate([4, 12], [3.5, 10], [4, 12]),
  vlsi: estimate([6, 20], [5, 17], [6, 19]),
  electronics: estimate([3.5, 9], [3, 8], [3.5, 9]),
  mechanical: estimate([3, 9], [2.8, 8], [3, 8.5]),
  engineeringSpecialist: estimate([4.5, 13], [4, 11], [4.5, 12]),
  civil: estimate([3, 8.5], [2.8, 7.5], [3, 8.5]),
  bim: estimate([4, 10], [3.5, 9], [4, 9.5]),
  medical: estimate([4, 12], [3.5, 10], [4, 12]),
  dental: estimate([2.5, 8], [2.3, 7], [2.5, 8]),
  dentalSpecialist: estimate([5, 15], [4, 12], [5, 15]),
  sportsStaff: estimate([2.5, 8], [2.3, 7], [2.5, 8]),
  athlete: null,
} satisfies Record<string, SalaryEstimate | null>;

type SalaryBand = keyof typeof salaryBands;
const role = (
  field: JobField,
  title: string,
  summary: string,
  skills: string[],
  band: SalaryBand,
  qualificationNote?: string,
): JobRole => ({
  field,
  title,
  summary,
  skills,
  annualSalaryLpa: salaryBands[band],
  qualificationNote,
});

export const JOB_ROLES: JobRole[] = [
  role('CSE', 'Software Engineer', 'Build and maintain applications, services, and software tools.', ['Programming', 'Data structures', 'Git'], 'software'),
  role('CSE', 'Full-Stack Developer', 'Develop user interfaces and the backend services behind them.', ['JavaScript', 'React', 'APIs'], 'software'),
  role('CSE', 'AI / Machine Learning Engineer', 'Develop and evaluate software that uses machine-learning models.', ['Python', 'Statistics', 'Machine learning'], 'softwareSpecialist'),
  role('CSE', 'Data Analyst', 'Turn business data into reports and useful decisions.', ['SQL', 'Spreadsheets', 'Visualization'], 'analyst'),
  role('CSE', 'Cybersecurity Analyst', 'Help monitor systems, investigate alerts, and reduce security risk.', ['Networking', 'Linux', 'Security basics'], 'softwareSpecialist'),
  role('CSE', 'Cloud / DevOps Engineer', 'Automate software delivery and operate cloud infrastructure.', ['Linux', 'Cloud', 'CI/CD'], 'softwareSpecialist'),
  role('CSE', 'Mobile App Developer', 'Build and maintain applications for phones and tablets.', ['Kotlin or Swift', 'APIs', 'Testing'], 'software'),
  role('CSE', 'QA Automation Engineer', 'Create automated checks that help teams release reliable software.', ['Testing', 'Python or Java', 'CI'], 'software'),
  role('ISE', 'Backend Engineer', 'Design APIs, application services, and data-processing logic.', ['Java or Python', 'APIs', 'Databases'], 'software'),
  role('ISE', 'Frontend Engineer', 'Build accessible, responsive interfaces for web applications.', ['TypeScript', 'React', 'Accessibility'], 'software'),
  role('ISE', 'Data Engineer', 'Build data pipelines and reliable datasets for analytics products.', ['SQL', 'Python', 'Data pipelines'], 'softwareSpecialist'),
  role('ISE', 'Database Administrator', 'Maintain database performance, access, and recovery processes.', ['SQL', 'Backups', 'Monitoring'], 'software'),
  role('ISE', 'Site Reliability Engineer', 'Improve service reliability through automation and observability.', ['Linux', 'Cloud', 'Monitoring'], 'softwareSpecialist'),
  role('ISE', 'Business Intelligence Developer', 'Create data models and dashboards for operational teams.', ['SQL', 'Data modeling', 'Dashboards'], 'analyst'),
  role('ECE', 'Embedded Systems Engineer', 'Develop software and electronics for devices and controllers.', ['C/C++', 'Microcontrollers', 'Electronics'], 'embedded'),
  role('ECE', 'VLSI / RTL Design Engineer', 'Design and verify digital circuits and semiconductor logic.', ['Digital design', 'Verilog', 'Verification'], 'vlsi'),
  role('ECE', 'Electronics Design Engineer', 'Design, test, and troubleshoot electronic circuits and products.', ['Circuit design', 'PCB', 'Testing'], 'electronics'),
  role('ECE', 'Telecom Network Engineer', 'Plan, operate, or troubleshoot communications networks.', ['Networking', 'Wireless systems', 'Troubleshooting'], 'embedded'),
  role('ECE', 'Signal Processing Engineer', 'Develop systems that analyze audio, image, or communications signals.', ['Signals', 'MATLAB or Python', 'DSP'], 'embedded'),
  role('Mechanical', 'Mechanical Design Engineer', 'Create and validate mechanical components and assemblies.', ['CAD', 'Mechanics', 'Materials'], 'mechanical'),
  role('Mechanical', 'Manufacturing / Quality Engineer', 'Improve production processes and product quality.', ['Manufacturing', 'Quality tools', 'Root-cause analysis'], 'mechanical'),
  role('Mechanical', 'Electric Vehicle Systems Engineer', 'Work on vehicle subsystems, testing, or electrification projects.', ['EV systems', 'CAD', 'Testing'], 'engineeringSpecialist'),
  role('Mechanical', 'Robotics / Automation Engineer', 'Integrate machines, controls, sensors, and industrial automation.', ['Controls', 'Robotics', 'PLC basics'], 'engineeringSpecialist'),
  role('Civil', 'Structural Engineer', 'Analyze and design safe building and infrastructure structures.', ['Structural analysis', 'AutoCAD', 'Codes'], 'civil'),
  role('Civil', 'Site Engineer', 'Coordinate construction work, quality checks, and site documentation.', ['Site planning', 'Safety', 'Quantity estimates'], 'civil'),
  role('Civil', 'BIM Engineer', 'Create and coordinate digital building and infrastructure models.', ['BIM tools', 'Revit', 'Coordination'], 'bim'),
  role('Civil', 'Transportation Engineer', 'Support the planning and design of roads and transport systems.', ['Transportation planning', 'GIS', 'Civil design'], 'civil'),
  role('MBBS', 'Medical Officer', 'Provide clinical care in a hospital, clinic, or public health setting.', ['Clinical practice', 'Communication', 'Documentation'], 'medical', 'Requires an MBBS degree, registration, and applicable licensing.'),
  role('MBBS', 'Junior Resident', 'Train and provide supervised clinical care in a hospital department.', ['Clinical skills', 'Teamwork', 'Patient care'], 'medical', 'Requires an MBBS degree and the relevant residency appointment.'),
  role('MBBS', 'Public Health Officer', 'Support community health programs, prevention, and health reporting.', ['Public health', 'Data literacy', 'Communication'], 'medical', 'Role requirements vary; clinical duties require applicable registration.'),
  role('Dentistry', 'Dental Surgeon', 'Assess oral health and provide dental care within licensed scope.', ['Oral diagnosis', 'Patient care', 'Clinical practice'], 'dental', 'Requires a recognized dental qualification and registration.'),
  role('Dentistry', 'Orthodontist', 'Assess and treat tooth and jaw alignment conditions.', ['Orthodontics', 'Treatment planning', 'Patient care'], 'dentalSpecialist', 'Requires dental registration and the relevant postgraduate specialization.'),
  role('Dentistry', 'Prosthodontist', 'Plan and provide restorative and replacement dental care.', ['Prosthodontics', 'Treatment planning', 'Patient care'], 'dentalSpecialist', 'Requires dental registration and the relevant postgraduate specialization.'),
  role('Cricket', 'Professional Cricketer', 'Compete through club, state, league, or professional cricket pathways.', ['Sport-specific practice', 'Fitness', 'Teamwork'], 'athlete', 'Selection and earnings depend on performance, contracts, and competition level.'),
  role('Cricket', 'Cricket Coach', 'Plan and deliver cricket coaching for teams or individual players.', ['Coaching', 'Training plans', 'Communication'], 'sportsStaff'),
  role('Cricket', 'Cricket Performance Analyst', 'Use video and performance data to support cricket teams.', ['Video analysis', 'Statistics', 'Cricket knowledge'], 'sportsStaff'),
  role('Football', 'Professional Footballer', 'Compete through club, academy, league, or professional football pathways.', ['Sport-specific practice', 'Fitness', 'Teamwork'], 'athlete', 'Selection and earnings depend on performance, contracts, and competition level.'),
  role('Football', 'Football Coach', 'Plan and deliver football coaching for teams or individual players.', ['Coaching', 'Training plans', 'Communication'], 'sportsStaff'),
  role('Football', 'Football Performance Analyst', 'Analyze match video and performance data for football teams.', ['Video analysis', 'Statistics', 'Football knowledge'], 'sportsStaff'),
];

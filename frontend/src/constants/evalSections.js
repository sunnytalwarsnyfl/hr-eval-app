export const EVAL_SECTIONS = [
  {
    name: "Dependability",
    maxScore: 39,
    items: [
      "Always starts and ends work at scheduled time",
      "Always informs supervisor before going on break",
      "Always visible in work area during shift",
      "Is reliable in work habits",
      "Completes assignments and tasks in a timely manner",
      "Adapts to changes in the work environment",
      "Participates and supports Performance Improvement activities",
      "Makes appropriate and logical decisions",
      "Self-starter, works with minimal supervision",
      "Responds appropriately in emergency situations",
      "Properly reports equipment problems",
      "Properly reports issues",
      "Maintains professional demeanor at all times"
    ],
    scoring: "standard"
  },
  {
    name: "Attendance",
    maxScore: 9,
    items: [
      "Reports to work on time; ready to begin at start of shift",
      "Returns from lunch and breaks on time",
      "Attendance and absences record"
    ],
    note: "Discuss all attendance occurrences with employee",
    scoring: "standard"
  },
  {
    name: "Policies & Procedures",
    maxScore: 24,
    items: [
      "Adheres to company policies and procedures",
      "Properly requests and uses PTO policy",
      "Adheres to privacy and confidentiality policy",
      "Consistently maintains appropriate professional appearance",
      "Completes and submits time worked accurately",
      "Always wears facility identification badge",
      "Adheres to fire and safety policies",
      "Does not discuss private matters in public areas of facility"
    ],
    scoring: "standard"
  },
  {
    name: "Communication Skills",
    maxScore: 36,
    items: [
      "Communicates effectively through verbal and written communications",
      "Adheres to facility phone etiquette and expectations",
      "Demonstrates active listening skills with customers and colleagues",
      "Listens to others without becoming defensive or angry",
      "Verbalizes concerns in a positive manner",
      "Respectfully uses nonverbal communication (eye contact, body language)",
      "Is courteous, respectful, and professional to customers and co-workers",
      "Responds to customer requests willingly without impatience",
      "Communicates and interacts with co-workers positively",
      "Promotes positive work relationships with co-workers and supervisors",
      "Interacts respectfully regardless of gender, race, or culture",
      "Works cooperatively and avoids negative or distracting behaviors"
    ],
    scoring: "standard"
  },
  {
    name: "Productivity",
    maxScore: 20,
    items: ["Productivity performance for tech level"],
    scoring: "productivity",
    note: "Tech 1: 12+ Prep/Pack units. Tech 3: 22-26 Cases, 7+ Carts, 15+ Sterilization, 81+ Decontamination. Tech 4: 27-30 Instruments/27+ Cases, 8+ Carts, 15+ Sterilization, 81+ Decontamination."
  },
  {
    name: "Safety / Injuries",
    maxScore: 15,
    items: ["No on-the-job injuries or incidents during this period"],
    scoring: "safety"
  },
  {
    name: "Production Quality",
    maxScore: 54,
    items: [
      "Holds self accountable for completion of assignments in timely fashion",
      "Completes work left from previous shifts and reports incomplete tasks",
      "Provides unsolicited assistance to co-workers",
      "Responds in timely manner for requested items or supplies",
      "Works in an organized manner",
      "Maintains a clean and safe work area",
      "Records and runs Bowie Dick test and records results",
      "Identifies effective decontamination methods correctly",
      "Effectively removes all visible bio burden",
      "Documents missing instruments",
      "Documents missing instruments as found",
      "Properly inspects and handles broken instruments",
      "Places correct instruments in sets or substitutes appropriately",
      "Handles missing tray filters correctly",
      "Demonstrates accuracy and thoroughness",
      "Correctly identifies and handles instruments",
      "Provides customer satisfaction",
      "Overall quality of work achieved"
    ],
    scoring: "standard"
  },
  {
    name: "Knowledge",
    maxScore: 30,
    items: [
      "Properly operates all equipment",
      "Prevents injury to self and others",
      "Accurately uses the instrument tracking system",
      "Identifies proper cleaning methods (manual, mechanical, sonic)",
      "Correctly identifies instruments",
      "Properly operates steam autoclave",
      "Properly operates ETO sterilizer",
      "Properly operates washer-decontaminator",
      "Properly operates ultrasonic machine",
      "Properly operates drying cabinet"
    ],
    scoring: "standard"
  }
];

export const SCORE_OPTIONS = {
  standard: [
    { label: "Does Not Meet (0)", value: 0 },
    { label: "Meets/Needs Improvement (1)", value: 1 },
    { label: "Meets Expectations (2)", value: 2 },
    { label: "Exceeds Expectations (3)", value: 3 }
  ],
  productivity: [
    { label: "Does Not Meet (0)", value: 0 },
    { label: "Meets/Needs Improvement (10)", value: 10 },
    { label: "Meets Expectations (20)", value: 20 }
  ],
  safety: [
    { label: "Incidents Present (0)", value: 0 },
    { label: "No Incidents (15)", value: 15 }
  ]
};

export function getItemMaxScore(scoring) {
  if (scoring === 'productivity') return 20;
  if (scoring === 'safety') return 15;
  return 3;
}

export function getScoreLabel(score, scoring) {
  const options = SCORE_OPTIONS[scoring] || SCORE_OPTIONS.standard;
  const opt = options.find(o => o.value === score);
  return opt ? opt.label : score.toString();
}

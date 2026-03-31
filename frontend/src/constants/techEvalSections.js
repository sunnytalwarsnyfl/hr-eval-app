// Tech Review Evaluation — based on SIPS HR Tasks for IT/Tech Review rubric
// Performance items: 50 items scored 0–1 each, scaled to 50 pts max
// Plus Attendance (20), Compliance (10), Disciplinary (20) = 100 total

export const TECH_EVAL_SECTIONS = [
  {
    name: "Decontamination",
    items: [
      "Uses PPE correctly (donning, doffing, and changes) per policy.",
      "Maintains clean and dirty separation at all times.",
      "Uses correct cleaning tools, detergents, and ratios.",
      "Follows IFUs and required cleaning steps without skipping.",
      "Identifies hand-wash items and special handling requirements.",
      "Handles sharps and biohazard materials safely.",
      "Maintains safe practices even under pressure or time constraints.",
    ],
    scoring: "tech_standard"
  },
  {
    name: "Inspection, Assembly, Packaging & Sterilization",
    items: [
      "Identifies damaged or defective instruments during inspection.",
      "Assembles trays accurately and verifies instrument function.",
      "Ensures packaging integrity and rejects compromised items.",
      "Uses appropriate chemical indicators and understands their purpose.",
      "Selects correct sterilization cycles based on load type.",
      "Responds appropriately to sterilization failures or positive BI results.",
    ],
    scoring: "tech_standard"
  },
  {
    name: "Equipment Operation & Technical Competency",
    items: [
      "Operates ultrasonic, washers, and cart washers correctly.",
      "Selects appropriate cycles and loads equipment properly.",
      "Performs required testing (e.g., cavitation, efficacy checks).",
      "Monitors and replaces detergents as needed.",
      "Performs basic troubleshooting before escalation.",
      "Demonstrates understanding of equipment function and limitations.",
    ],
    scoring: "tech_standard"
  },
  {
    name: "Documentation, Traceability & Distribution",
    items: [
      "Documents work accurately and completely.",
      "Maintains traceability of instruments and sterilization loads.",
      "Builds case carts accurately according to pick lists.",
      "Uses preference cards correctly and identifies discrepancies.",
      "Communicates missing, delayed, or incomplete items promptly.",
      "Understands and follows load recall procedures.",
    ],
    scoring: "tech_standard"
  },
  {
    name: "Workflow, Communication & Accountability",
    items: [
      "Prioritizes urgent or rapid-turnover items without compromising quality.",
      "Maintains workflow efficiency while following all required steps.",
      "Communicates clearly and professionally with team and OR staff.",
      "Provides accurate and complete shift hand-off.",
      "Refuses to take shortcuts or bypass required processes.",
      "Reports errors, concerns, and issues promptly.",
      "Takes accountability for actions and follows through on corrections.",
      "Escalates issues appropriately through the chain of command.",
    ],
    scoring: "tech_standard"
  },
  {
    name: "Culture, Engagement & Professional Ownership",
    items: [
      "Demonstrates a consistent patient safety mindset.",
      "Speaks up when unsafe practices are observed.",
      "Maintains professionalism and contributes to a respectful work environment.",
      "Supports team members in following proper processes.",
      "Takes initiative to address issues or improve workflow.",
      "Remains engaged and avoids a minimal-effort mindset.",
    ],
    scoring: "tech_standard"
  },
  {
    name: "Attendance & Compliance (Competency)",
    items: [
      "Completes required facility training and renewals before deadlines.",
      "Maintains reliable attendance and arrives on time.",
    ],
    scoring: "tech_standard"
  },
  {
    name: "Measurement & Data Mastery",
    items: [
      "Uses a structured problem-solving approach, such as the 5 Whys, to identify likely causes of errors or process breakdowns.",
      "Investigates recurring quality issues using available data, observed patterns, and appropriate follow-up rather than relying on assumptions.",
      "Process Auditing",
      "Demonstrates understanding of product, process, and system audits and recognizes the role of auditing in preventing recurring failures.",
      "Identifies variation from standard work during audits or observation and responds appropriately to support consistency and standardization.",
      "Uses quality data appropriately and communicates it with context.",
      "Supports continuous improvement and sustained corrective action.",
      "Supports defect prevention rather than relying only on defect detection.",
    ],
    scoring: "tech_standard"
  },
  {
    name: "Education & Training",
    items: [
      "White Belt Competent",
      "Yellow Belt Competent",
      "Green Belt Competent",
    ],
    scoring: "tech_standard"
  },
];

export const TECH_SCORE_OPTIONS = {
  tech_standard: [
    { label: "Does Not Meet (0)", value: 0 },
    { label: "Meets/Needs Improvement (0.70)", value: 0.70 },
    { label: "Meets (0.95)", value: 0.95 },
    { label: "Exceeds (1)", value: 1 },
  ]
};

// Attendance scoring (20 pts max)
export const ATTENDANCE_OPTIONS = [
  { label: "0–2 Active Attendance Points", points: 20 },
  { label: "3–4 Active Attendance Points", points: 15 },
  { label: "5–6 Active Attendance Points", points: 5 },
  { label: "7+ Active Attendance Points", points: 0 },
];

// Compliance items (2 pts each, 10 max)
export const COMPLIANCE_ITEMS = [
  "HEPATITIS B – renewed within 5 days of expiration",
  "PHYSICAL EXAM – renewed within 5 days of expiration",
  "BLS – renewed within 5 days of expiration",
  "OTHER – renewed requirements as requested by HR within 5 days of deadline",
  "CERTIFICATION – renewed within 5 days of expiration",
];

// Disciplinary scoring (20 pts max)
export const DISCIPLINARY_OPTIONS = [
  { label: "No disciplinary action issued within the last 12 months", points: 20 },
  { label: "1–2 disciplinary actions issued within the last 12 months", points: 5 },
  { label: "3+ disciplinary actions issued within the last 12 months", points: 0 },
];

// Total items for performance score calculation
export const TECH_TOTAL_ITEMS = TECH_EVAL_SECTIONS.reduce((s, c) => s + c.items.length, 0);
export const TECH_MAX_SCORE = 100; // 50 perf + 20 attendance + 10 compliance + 20 disciplinary
export const TECH_PASSING_SCORE = 70;

// Belt levels based on performance score (out of 50)
export function getBeltLevel(perfScore) {
  if (perfScore >= 40) return { belt: "Green", color: "text-green-600", bg: "bg-green-50", border: "border-green-200" };
  if (perfScore >= 26) return { belt: "Yellow", color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" };
  return { belt: "White", color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" };
}

// Overall rating and compensation
export function getOverallRating(score) {
  if (score >= 96) return { label: "Exceeds", increase: "2%", bonus: "100%", color: "text-green-600", bg: "bg-green-50" };
  if (score >= 90) return { label: "Exceeds", increase: "1.5%", bonus: "95%", color: "text-green-600", bg: "bg-green-50" };
  if (score >= 80) return { label: "Meets", increase: "1%", bonus: "85%", color: "text-blue-600", bg: "bg-blue-50" };
  if (score >= 70) return { label: "Meets", increase: "0.5%", bonus: "75%", color: "text-teal-600", bg: "bg-teal-50" };
  return { label: "Does Not Meet", increase: "0%", bonus: "0%", color: "text-red-600", bg: "bg-red-50" };
}

export function getBeltBonus(belt) {
  if (belt === "Green") return "1%";
  if (belt === "Yellow") return "0.5%";
  return "0%";
}

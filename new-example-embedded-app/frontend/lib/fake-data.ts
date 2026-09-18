export interface Lead {
  id: string;
  name: string;
  company: string;
  source: string;
  score: number;
  status: "New" | "Working" | "Qualified" | "Unqualified";
}

export interface Contact {
  id: string;
  name: string;
  title: string;
  account: string;
  email: string;
  lastTouch: string;
}

export interface Account {
  id: string;
  name: string;
  industry: string;
  owner: string;
  arr: number;
  health: "Healthy" | "At risk" | "Churn risk";
}

export const leads: Lead[] = [
  {
    id: "L-1042",
    name: "Marta Alvarez",
    company: "Initech",
    source: "Webinar",
    score: 92,
    status: "Qualified",
  },
  {
    id: "L-1041",
    name: "Devon Park",
    company: "Globex",
    source: "Inbound",
    score: 78,
    status: "Working",
  },
  {
    id: "L-1040",
    name: "Ana Costa",
    company: "Umbrella Co",
    source: "Referral",
    score: 64,
    status: "New",
  },
  {
    id: "L-1039",
    name: "Sam Whitfield",
    company: "Vandelay",
    source: "Outbound",
    score: 55,
    status: "Working",
  },
  {
    id: "L-1038",
    name: "Priya Raman",
    company: "Soylent",
    source: "Trade show",
    score: 41,
    status: "Unqualified",
  },
  {
    id: "L-1037",
    name: "Tobias Klein",
    company: "Massive Dynamic",
    source: "Inbound",
    score: 87,
    status: "Qualified",
  },
];

export const contacts: Contact[] = [
  {
    id: "C-2210",
    name: "Grace Nakamura",
    title: "VP Operations",
    account: "Initech",
    email: "grace@initech.com",
    lastTouch: "2 days ago",
  },
  {
    id: "C-2209",
    name: "Owen Bright",
    title: "IT Director",
    account: "Globex",
    email: "owen@globex.com",
    lastTouch: "5 days ago",
  },
  {
    id: "C-2208",
    name: "Lila Moreau",
    title: "Head of RevOps",
    account: "Vandelay",
    email: "lila@vandelay.com",
    lastTouch: "1 week ago",
  },
  {
    id: "C-2207",
    name: "Ethan Cole",
    title: "CTO",
    account: "Umbrella Co",
    email: "ethan@umbrella.co",
    lastTouch: "3 weeks ago",
  },
  {
    id: "C-2206",
    name: "Noor Haddad",
    title: "Sales Manager",
    account: "Soylent",
    email: "noor@soylent.com",
    lastTouch: "Today",
  },
];

export const accounts: Account[] = [
  {
    id: "A-330",
    name: "Initech",
    industry: "Software",
    owner: "Jane Doe",
    arr: 184000,
    health: "Healthy",
  },
  {
    id: "A-331",
    name: "Globex",
    industry: "Manufacturing",
    owner: "Jane Doe",
    arr: 96500,
    health: "Healthy",
  },
  {
    id: "A-332",
    name: "Vandelay",
    industry: "Logistics",
    owner: "Rick Sato",
    arr: 42000,
    health: "At risk",
  },
  {
    id: "A-333",
    name: "Umbrella Co",
    industry: "Biotech",
    owner: "Jane Doe",
    arr: 310000,
    health: "Healthy",
  },
  {
    id: "A-334",
    name: "Soylent",
    industry: "Food & Bev",
    owner: "Rick Sato",
    arr: 27500,
    health: "Churn risk",
  },
];

export const pipelineByStage = [
  { stage: "Prospect", value: 420000 },
  { stage: "Discovery", value: 315000 },
  { stage: "Proposal", value: 228000 },
  { stage: "Negotiation", value: 140000 },
  { stage: "Closed won", value: 86000 },
];

export const activity = [
  {
    id: 1,
    who: "Grace Nakamura",
    what: "opened the Q3 proposal",
    when: "12 minutes ago",
  },
  {
    id: 2,
    who: "Owen Bright",
    what: "replied to the renewal thread",
    when: "1 hour ago",
  },
  {
    id: 3,
    who: "Marta Alvarez",
    what: "booked a demo for Thursday",
    when: "3 hours ago",
  },
  {
    id: 4,
    who: "Noor Haddad",
    what: "downloaded the security whitepaper",
    when: "Yesterday",
  },
  {
    id: 5,
    who: "Lila Moreau",
    what: "requested a Salesforce sync",
    when: "Yesterday",
  },
];

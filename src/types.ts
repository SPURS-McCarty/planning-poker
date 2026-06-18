export type ScaleType = 'fibonacci' | 'modified-fibonacci' | 't-shirt' | 'custom';
export type UserRole = 'participant' | 'observer';

export interface Scale {
  id: ScaleType | 'custom';
  name: string;
  cards: string[];
  description: string;
}

export interface Participant {
  id: string;
  clientId?: string;
  name: string;
  role?: UserRole;
  chips: number;
  vote: string | null;
  hasVoted: boolean;
  iconIndex?: number;
  chipThemeIndex?: number;
}

export interface Room {
  id: string;
  sessionName: string;
  hostId?: string;
  scale: Scale;
  participants: Participant[];
  revealed: boolean;
  roundNumber?: number;
  autoReveal?: boolean;
  currentIssue: string;
}

export const BUILT_IN_SCALES: Scale[] = [
  {
    id: 'fibonacci',
    name: 'Fibonacci',
    cards: ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕'],
    description: 'The most popular scale. Increasing gaps reflect growing uncertainty of larger items.',
  },
  {
    id: 'modified-fibonacci',
    name: 'Modified Fibonacci',
    cards: ['0', '½', '1', '2', '3', '5', '8', '13', '20', '40', '100', '?', '☕'],
    description: 'A practical variation of Fibonacci, widely used in agile estimation.',
  },
  {
    id: 't-shirt',
    name: 'T-Shirt Sizes',
    cards: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
    description: 'Great for high-level estimation when numeric precision isn\'t needed.',
  },
];

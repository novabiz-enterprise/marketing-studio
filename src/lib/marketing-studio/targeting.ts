export interface TargetCountry {
  id: string;
  en: string;
  language: string;
  currency: string;
  notes: string;
}

export interface PromptOption {
  id: string;
  en: string;
  prompt: string;
}

export const TARGET_COUNTRIES: TargetCountry[] = [
  { id: 'auto', en: 'Auto', language: '', currency: '', notes: '' },
  { id: 'france', en: 'France', language: 'French', currency: 'EUR (€)', notes: 'Use French cultural references, realistic French retail habits and natural French promotional phrasing.' },
  { id: 'united-states', en: 'United States', language: 'American English', currency: 'USD ($)', notes: 'Use American consumer references, direct benefits, clear discounts and familiar US retail or online-shopping cues.' },
  { id: 'canada', en: 'Canada', language: 'Canadian English or French if the brief implies Quebec/French', currency: 'CAD ($)', notes: 'Use Canadian everyday references, local retail wording and bilingual sensitivity when relevant.' },
  { id: 'united-kingdom', en: 'United Kingdom', language: 'British English', currency: 'GBP (£)', notes: 'Use British phrasing, UK lifestyle references and natural UK promotional wording.' },
  { id: 'germany', en: 'Germany', language: 'German', currency: 'EUR (€)', notes: 'Use German cultural references, practical proof points, clear value claims and realistic German retail language.' },
  { id: 'spain', en: 'Spain', language: 'Spanish from Spain', currency: 'EUR (€)', notes: 'Use Spanish lifestyle references, warm conversational phrasing and locally natural offers.' },
  { id: 'italy', en: 'Italy', language: 'Italian', currency: 'EUR (€)', notes: 'Use Italian lifestyle references, expressive but credible phrasing and locally natural offers.' },
  { id: 'united-arab-emirates', en: 'United Arab Emirates', language: 'Arabic or English depending on the brief and audience', currency: 'AED', notes: 'Use UAE lifestyle references, premium retail cues and culturally respectful promotional language.' },
];

export const AVATAR_SEXES: PromptOption[] = [
  { id: 'auto', en: 'Auto', prompt: '' },
  { id: 'male', en: 'Male', prompt: 'male' },
  { id: 'female', en: 'Female', prompt: 'female' },
];

export const AVATAR_AGES: PromptOption[] = [
  { id: 'auto', en: 'Auto', prompt: '' },
  { id: '0-10', en: '0-10', prompt: '0 to 10 years old' },
  { id: '10-20', en: '10-20', prompt: '10 to 20 years old' },
  { id: '20-30', en: '20-30', prompt: '20 to 30 years old' },
  { id: '30-40', en: '30-40', prompt: '30 to 40 years old' },
  { id: '40-50', en: '40-50', prompt: '40 to 50 years old' },
  { id: '50-60', en: '50-60', prompt: '50 to 60 years old' },
  { id: '60-70', en: '60-70', prompt: '60 to 70 years old' },
  { id: '70-plus', en: '+70', prompt: 'over 70 years old' },
];

function pick<T extends { id: string }>(items: T[], id: string | undefined, fallback: T): T {
  return items.find((item) => item.id === id) || fallback;
}

export function getTargetCountry(id: string | undefined): TargetCountry {
  return pick(TARGET_COUNTRIES, id, TARGET_COUNTRIES[0]);
}

export function getAvatarSex(id: string | undefined): PromptOption {
  return pick(AVATAR_SEXES, id, AVATAR_SEXES[0]);
}

export function getAvatarAge(id: string | undefined): PromptOption {
  return pick(AVATAR_AGES, id, AVATAR_AGES[0]);
}

export function buildTargetCountryPrompt(id: string | undefined): string {
  const country = getTargetCountry(id);
  if (country.id === 'auto') return '';
  return `TARGET COUNTRY: ${country.en}. Adapt the ad to this country: spoken language should be ${country.language} unless the user's brief explicitly asks for another language; cultural references, currency, offer framing, prices, discounts and CTA should feel native to ${country.en}. Use ${country.currency} for prices or promotions. ${country.notes}`;
}

export function buildAvatarDescriptor(sexId: string | undefined, ageId: string | undefined): string {
  const sex = getAvatarSex(sexId).prompt;
  const age = getAvatarAge(ageId).prompt;
  if (!sex && !age) return '';
  return `${age ? `${age} ` : ''}${sex ? `${sex} ` : ''}presenter`.trim();
}

export function buildAvatarPrompt(sexId: string | undefined, ageId: string | undefined): string {
  const descriptor = buildAvatarDescriptor(sexId, ageId);
  if (!descriptor) return '';
  return `PRESENTER AVATAR: Use this presenter profile: ${descriptor}. Keep the same sex and age range throughout the whole video; wardrobe, behavior and voice should be appropriate for that age range.`;
}

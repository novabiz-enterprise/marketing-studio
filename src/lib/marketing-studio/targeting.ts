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

export interface VideoContactOptions {
  phoneNumber?: string;
  websiteUrl?: string;
}

const COUNTRY_NAMES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Cape Verde',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo',
  'Costa Rica',
  "Côte d'Ivoire",
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czechia',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kosovo',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Palestine',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'São Tomé and Príncipe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
] as const;

function slugCountry(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function genericCountry(name: string): TargetCountry {
  return {
    id: slugCountry(name),
    en: name,
    language: "the country's most natural advertising language(s)",
    currency: 'the local currency',
    notes: `Use ${name} cultural references, realistic local retail habits and natural promotional phrasing.`,
  };
}

const TARGET_COUNTRY_OVERRIDES: Record<string, Partial<TargetCountry>> = {
  france: { language: 'French', currency: 'EUR (€)', notes: 'Use French cultural references, realistic French retail habits and natural French promotional phrasing.' },
  'united-states': { language: 'American English', currency: 'USD ($)', notes: 'Use American consumer references, direct benefits, clear discounts and familiar US retail or online-shopping cues.' },
  canada: { language: 'Canadian English or French if the brief implies Quebec/French', currency: 'CAD ($)', notes: 'Use Canadian everyday references, local retail wording and bilingual sensitivity when relevant.' },
  'united-kingdom': { language: 'British English', currency: 'GBP (£)', notes: 'Use British phrasing, UK lifestyle references and natural UK promotional wording.' },
  germany: { language: 'German', currency: 'EUR (€)', notes: 'Use German cultural references, practical proof points, clear value claims and realistic German retail language.' },
  spain: { language: 'Spanish from Spain', currency: 'EUR (€)', notes: 'Use Spanish lifestyle references, warm conversational phrasing and locally natural offers.' },
  italy: { language: 'Italian', currency: 'EUR (€)', notes: 'Use Italian lifestyle references, expressive but credible phrasing and locally natural offers.' },
  'united-arab-emirates': { language: 'Arabic or English depending on the brief and audience', currency: 'AED', notes: 'Use UAE lifestyle references, premium retail cues and culturally respectful promotional language.' },
};

export const TARGET_COUNTRIES: TargetCountry[] = [
  { id: 'auto', en: 'Auto', language: '', currency: '', notes: '' },
  ...COUNTRY_NAMES.map((name) => {
    const country = genericCountry(name);
    return { ...country, ...TARGET_COUNTRY_OVERRIDES[country.id] };
  }),
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

export function buildContactPrompt(options: VideoContactOptions): string {
  const phone = options.phoneNumber?.trim();
  const website = options.websiteUrl?.trim();
  const details = [
    phone ? `Phone number: ${phone}` : '',
    website ? `Website: ${website}` : '',
  ].filter(Boolean);
  if (!details.length) return '';
  return `CONTACT DETAILS / CTA: Integrate these exact user-provided details into the video call-to-action: ${details.join('; ')}. The presenter should say them clearly and naturally near the end. If the video includes a CTA card or visible text, use only these exact details and do not invent or alter any phone number, URL, domain or spelling.`;
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

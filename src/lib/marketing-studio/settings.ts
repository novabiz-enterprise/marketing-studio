/**
 * Setting = 场景环境(注入 scene + 每镜图 prompt)。复刻 Higgsfield 的 Setting 资产层。
 */
export interface AdSetting {
  id: string;
  label: string;
  en: string;
  zh?: string; // 中文场景名
  recipe: string; // 英文场景描述(空=让 LLM 自选)
}

export const AD_SETTINGS: AdSetting[] = [
  { id: 'none', label: 'Auto', en: 'Auto', zh: '智能自选', recipe: '' },
  { id: 'home', label: 'Home', en: 'Home', zh: '家中', recipe: 'a realistic lived-in home interior, warm natural light, everyday household details, comfortable and relatable' },
  { id: 'office', label: 'Office', en: 'Office', zh: '办公室', recipe: 'a bright modern office or cubicle, desk with monitor, soft daylight from window' },
  { id: 'livingroom', label: 'Living Room', en: 'Living Room', zh: '客厅', recipe: 'a cozy home living room, sofa and warm lamp light, lived-in and relatable' },
  { id: 'kitchen', label: 'Kitchen', en: 'Kitchen', zh: '厨房', recipe: 'a home kitchen with warm ceiling light, countertop and utensils, everyday cooking vibe' },
  { id: 'bedroom', label: 'Bedroom', en: 'Bedroom', zh: '卧室', recipe: 'a soft cozy bedroom with warm bedside lighting, intimate private feel' },
  { id: 'bathroom', label: 'Bathroom / Vanity', en: 'Bathroom / Vanity', zh: '浴室 / 梳妆台', recipe: 'a clean bright bathroom vanity with mirror, skincare/beauty context' },
  { id: 'garden', label: 'Garden', en: 'Garden', zh: '花园', recipe: 'a private garden with greenery, plants, soft daylight and a calm home-lifestyle atmosphere' },
  { id: 'garage', label: 'Garage', en: 'Garage', zh: '车库', recipe: 'a realistic home garage or workshop, shelves, tools, concrete floor, practical DIY atmosphere' },
  { id: 'professional', label: 'Professional', en: 'Professional', zh: '专业场所', recipe: 'a polished professional environment, clean organized background, credible business atmosphere' },
  { id: 'modern-office', label: 'Modern Office', en: 'Modern Office', zh: '现代办公室', recipe: 'a sleek modern office with glass walls, minimal desks, premium lighting and contemporary corporate design' },
  { id: 'meeting-room', label: 'Meeting Room', en: 'Meeting Room', zh: '会议室', recipe: 'a professional meeting room with conference table, screen, chairs and soft corporate lighting' },
  { id: 'shop', label: 'Shop', en: 'Shop', zh: '商店', recipe: 'a real retail shop or boutique interior with product shelves, display counters and natural customer flow' },
  { id: 'pharmacy', label: 'Pharmacy', en: 'Pharmacy', zh: '药房', recipe: 'a clean pharmacy interior with organized shelves, health products and professional lighting' },
  { id: 'clinic', label: 'Clinic', en: 'Clinic', zh: '诊所', recipe: 'a bright clean clinic or wellness office, medical-grade surfaces, calm trustworthy atmosphere' },
  { id: 'restaurant', label: 'Restaurant', en: 'Restaurant', zh: '餐厅', recipe: 'a welcoming restaurant interior with tables, warm lighting, plates and realistic dining atmosphere' },
  { id: 'gym', label: 'Gym', en: 'Gym', zh: '健身房', recipe: 'a modern gym with fitness equipment, mirrors, energetic lighting and active lifestyle atmosphere' },
  { id: 'street', label: 'City Street', en: 'City Street', zh: '城市街头', recipe: 'a lively city street in daylight, urban background slightly blurred, on-the-go feel' },
  { id: 'outdoor', label: 'Outdoor', en: 'Outdoor', zh: '户外', recipe: 'a bright outdoor natural setting (park / court / nature), open sky, natural sunlight' },
  { id: 'downtown', label: 'Downtown', en: 'Downtown', zh: '市中心', recipe: 'a lively downtown area with modern buildings, crosswalks, storefronts and energetic city movement' },
  { id: 'park', label: 'Park', en: 'Park', zh: '公园', recipe: 'a green public park with trees, benches, paths, open sky and relaxed daylight atmosphere' },
  { id: 'studio', label: 'Live Studio', en: 'Live Studio', zh: '直播间', recipe: 'a live-selling studio corner with ring light and shelf of products behind, streamer setup' },
  { id: 'car', label: 'In Car', en: 'In Car', zh: '车内', recipe: 'inside a car at the wheel or passenger seat, compact framing, dashboard visible' },
  { id: 'cafe', label: 'Cafe', en: 'Cafe', zh: '咖啡馆', recipe: 'a warm aesthetic cafe table, coffee and soft ambient light, lifestyle vibe' },
  { id: 'terrace', label: 'Terrace', en: 'Terrace', zh: '露台', recipe: 'an outdoor terrace or patio with tables, plants, daylight and relaxed social lifestyle atmosphere' },
  { id: 'parking', label: 'Parking Lot', en: 'Parking Lot', zh: '停车场', recipe: 'a realistic parking lot with cars, painted lines, open space and practical urban lighting' },
  { id: 'beach', label: 'Beach', en: 'Beach', zh: '海滩', recipe: 'a sunny beach with sand, water, bright sky and relaxed holiday lifestyle mood' },
  { id: 'mountain', label: 'Mountain', en: 'Mountain', zh: '山地', recipe: 'a scenic mountain setting with rocks, trees, distant peaks and crisp natural daylight' },
  { id: 'seamless', label: 'Studio Seamless', en: 'Studio Seamless', zh: '纯色影棚', recipe: 'a clean seamless studio backdrop with premium commercial lighting, no clutter' },
];

export function getSetting(id: string): AdSetting {
  return AD_SETTINGS.find((s) => s.id === id) || AD_SETTINGS[0];
}

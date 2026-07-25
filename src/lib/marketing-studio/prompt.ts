import { DEFAULT_CHAT_MODEL, openRouterChat } from '@/lib/openrouter';
import { getFormat } from './formats';
import { getHook } from './hooks';
import { getSetting } from './settings';
import { getAvatar } from './avatars';
import { buildAvatarDescriptor, buildAvatarPrompt, buildContactPrompt, buildTargetCountryPrompt } from './targeting';
import { marketingPlanSchema, type MarketingPlan } from './schema';

const PLAN_MODEL = DEFAULT_CHAT_MODEL;

export interface PlanInput {
  product: string;
  character: string;
  formatId: string;
  hookId: string;
  settingId: string;
  avatarId: string;
  targetCountry: string;
  avatarSex: string;
  avatarAge: string;
  phoneNumber?: string;
  websiteUrl?: string;
  nShots: number;
  lang: string;
  ratio: string;
}

const SYS = `你是顶尖的产品广告分镜师。把【产品 + 人物 + 玩法 + 开场钩子 + 场景 + 目标国家 + 联系方式/CTA + 台词语言 + 视频比例】转成一条真人广告的结构化分镜 JSON,供 Seedance 2.0 视频模型逐镜生成、再拼接成一条完整广告。只输出 JSON,不要解释、不要 markdown 代码块。schema:
{
  "title": "短片名(与产品描述同语种)",
  "ratio": "严格使用用户指定视频比例",
  "product": "ENGLISH 详细产品描述(颜色/材质/logo文字/形状/关键细节,越具体越好——每一镜都会用它来锁定产品在各镜之间完全一致)",
  "character": "ENGLISH 出镜人物描述(年龄/穿着/发型/气质;若玩法不需要人则给空字符串)",
  "scene": "ENGLISH 场景/环境描述",
  "shots": [
    {"i": 1,
     "shot": "ENGLISH 该镜的画面/构图/景别(如 medium selfie shot holding product / close-up of product filling frame)",
     "prompt": "ENGLISH 该镜的动作 + 运镜 + 一句口播台词。台词必须用英文双引号包起来(Seedance 2.0 会原生读出来),口语自然像真人;结尾写 handheld selfie UGC feel, clear spoken <台词语言>."}
  ]
}
规则:
1. 严格按给定玩法的配方组织 shots,段数=用户指定的镜头数;每段一句自然口播台词,前后台词连成一条完整安利(开场吸引→展示卖点→使用/证明→结尾安利或CTA)。
2. 每一镜的 prompt 里都要复述产品的关键外观特征(颜色/logo/形状),防止跨镜漂移。
3. 若用户给了【开场钩子】,第一镜必须严格用它的方式开场;若给了【场景】,scene 与各镜必须落在该场景;若给了【指定人物】,character 必须严格采用给定的人物描述,不要另编。
4. 若用户给了【目标国家/市场】,台词语言、文化参考、货币、价格/折扣/促销表达都要贴合该国家;除非产品描述明确要求另一种语言,否则台词语言优先跟随目标国家。未给目标国家时,台词语言自动匹配【产品】描述所用的语种(产品用中文写→中文台词、英文→英文、日文→日文…任意语种;判断不出用英文)。人物与产品要自然互动(手持/展示/使用)。若玩法不需要人物(如 TV Spot / Hyper Motion),character 给空字符串,shots 聚焦产品动效与画外音。
5. 若用户给了【联系方式/CTA】,最后一镜的台词必须自然包含这些精确联系方式(电话号码、网站等),不要改写、不要编造额外号码或网址。
只输出 JSON。`;

function extractJson(raw: string): Record<string, unknown> {
  const s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('no_json_in_llm_output');
  return JSON.parse(s.slice(a, b + 1)) as Record<string, unknown>;
}

function buildUserPrompt(input: PlanInput): string {
  const fmt = getFormat(input.formatId);
  const hook = getHook(input.hookId);
  const setting = getSetting(input.settingId);
  const avatar = getAvatar(input.avatarId);
  const avatarDescriptor = buildAvatarDescriptor(input.avatarSex, input.avatarAge);
  const explicitChar = [input.character.trim() || avatar.desc, avatarDescriptor].filter(Boolean).join(', '); // 手填优先,再补性别/年龄
  const targetCountryPrompt = buildTargetCountryPrompt(input.targetCountry);
  const avatarPrompt = buildAvatarPrompt(input.avatarSex, input.avatarAge);
  const contactPrompt = buildContactPrompt({ phoneNumber: input.phoneNumber, websiteUrl: input.websiteUrl });
  return [
    `产品: ${input.product}`,
    `玩法: ${fmt.label} — ${fmt.hint}`,
    hook.recipe ? `开场钩子(第一镜严格采用): ${hook.label} — ${hook.recipe}` : '',
    setting.recipe ? `指定场景(ENGLISH,严格落在此): ${setting.recipe}` : '',
    targetCountryPrompt ? `目标国家/市场(严格影响语言、文化参考、货币和促销表达): ${targetCountryPrompt}` : '',
    contactPrompt ? `联系方式/CTA(最后一镜自然口播,必须保持精确): ${contactPrompt}` : '',
    explicitChar ? `指定出镜人物(ENGLISH,严格采用): ${explicitChar}` : '出镜人物: (自动设计一个合适的出镜人)',
    avatarPrompt && !explicitChar ? `出镜人物补充约束: ${avatarPrompt}` : '',
    `镜头数: ${input.nShots}`,
    `视频比例: ${input.ratio}`,
    `台词语言: 自动跟随上面【产品】描述的语种(不要固定某种语言,产品写什么语言台词就什么语言)`,
    `需要人物出镜: ${fmt.needsPerson ? '是' : '否(纯产品镜,character 留空)'}`,
    '生成分镜 JSON。',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function draftMarketingPlan(input: PlanInput): Promise<MarketingPlan> {
  const raw = await openRouterChat(
    [
      { role: 'system', content: SYS },
      { role: 'user', content: buildUserPrompt(input) },
    ],
    PLAN_MODEL,
    6000, // 加大上限:推理模型 reasoning 会吃 token,留足空间保证 JSON content 完整
    90_000,
  );
  const json = extractJson(raw);
  json.formatId = input.formatId;
  const parsed = marketingPlanSchema.safeParse(json);
  if (!parsed.success) throw new Error('plan_parse_failed: ' + parsed.error.message);
  return parsed.data;
}

/** LLM 不可用时的兜底分镜(保证前端仍能拿到可编辑的 shots) */
export function buildFallbackMarketingPlan(input: PlanInput): MarketingPlan {
  const fmt = getFormat(input.formatId);
  const setting = getSetting(input.settingId);
  const avatar = getAvatar(input.avatarId);
  const avatarDescriptor = buildAvatarDescriptor(input.avatarSex, input.avatarAge);
  const n = input.nShots;
  const character =
    [input.character.trim() || avatar.desc || 'a friendly young person in a casual outfit with a warm approachable smile', avatarDescriptor]
      .filter(Boolean)
      .join(', ');
  const lang = input.lang || '英文';
  const targetCountryPrompt = buildTargetCountryPrompt(input.targetCountry);
  const contactPrompt = buildContactPrompt({ phoneNumber: input.phoneNumber, websiteUrl: input.websiteUrl });
  const phone = input.phoneNumber?.trim();
  const website = input.websiteUrl?.trim();
  const fallbackLine = phone && website
    ? `Visit ${website} or call ${phone} today.`
    : website
      ? `Visit ${website} today.`
      : phone
        ? `Call ${phone} today.`
        : 'Honestly, this one is really good.';
  const shots = Array.from({ length: n }, (_, i) => ({
    i: i + 1,
    shot:
      i === 0
        ? 'medium selfie shot, holding the product up toward the camera'
        : i === n - 1
          ? 'close-up of the product filling the vertical frame'
          : 'handheld shot showing the product in use',
    prompt: `A person presents the product (${input.product}); ${targetCountryPrompt ? `${targetCountryPrompt} ` : ''}${contactPrompt ? `${contactPrompt} ` : ''}${
      fmt.needsPerson ? 'looks into the camera and speaks naturally' : 'dynamic product hero motion'
    }: "${i === n - 1 ? fallbackLine : 'Honestly, this one is really good.'}" handheld selfie UGC feel, clear spoken ${lang}.`,
  }));
  return {
    title: '产品广告',
    ratio: input.ratio,
    formatId: input.formatId,
    product: input.product,
    character: fmt.needsPerson ? character : '',
    scene: setting.recipe || 'clean natural everyday setting',
    shots,
  };
}

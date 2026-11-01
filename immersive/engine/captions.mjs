/* The few words the glass says (v4 §5, §8): written Chinese or English, never spoken. Pure; no DOM.
   The browser's language picks the ear (which speech recogniser dialect) and the script of the captions. */

export function talkLanguage(navLang = '') {
  const l = String(navLang || '').toLowerCase();
  if (l.startsWith('cmn') || l === 'zh-cn' || l.startsWith('zh-hans') || l.endsWith('-cn')) return 'cmn-Hans-CN';
  if (l.startsWith('zh') || l.startsWith('yue')) return 'yue-Hant-HK';
  return 'en-AU';
}

export function captionLanguage(navLang = '') {
  return /^(zh|yue|cmn)/i.test(String(navLang || '')) ? 'zh' : 'en';
}

export const LINES = {
  zh: {
    start: '輕觸開始', hint: '可以說：慢一點、快一點、帶我回來', hintHold: '按住一秒：帶我回來', hintWorld: '說：換個世界', hintCalm: '說：靜一點',
    ground: '我在。慢慢來。', groundOff: '繼續', pause: '暫停', resume: '繼續', hold: '停留', release: '繼續走', rewind: '重來',
    fly: '飛', hover: '停下', slower: '慢一點', faster: '快一點', calmer: '靜一點', deeper: '更深', stronger: '更強', softer: '更靜',
    noMic: '沒有麥克風，照樣可以看', listening: '在聽',
    hostSound: '聲音來源', hostCaptions: '字幕', hostComfort: '舒適', hostLanguage: '語言',
    soundMic: '房間麥克風', soundComputer: '電腦音樂', soundDemo: '示範音樂', capAll: '全部', capGround: '只在帶我回來', capNone: '無',
    comfortOn: '柔和', comfortOff: '正常', langYue: '廣東話', langEn: 'English', langCmn: '普通話', hostHint: 'Esc 或按住右下角兩秒可再打開。',
  },
  en: {
    start: 'Tap to begin', hint: 'Say: slower, faster, bring me back', hintHold: 'Hold a second: bring me back', hintWorld: 'Say: another world', hintCalm: 'Say: softer',
    ground: "I'm here. Take your time.", groundOff: 'Onward', pause: 'Paused', resume: 'Onward', hold: 'Staying', release: 'Moving on', rewind: 'Again',
    fly: 'Flying', hover: 'Hovering', slower: 'Slower', faster: 'Faster', calmer: 'Softer', deeper: 'Deeper', stronger: 'Stronger', softer: 'Softer',
    noMic: 'No microphone; watching still works', listening: 'Listening',
    hostSound: 'Sound', hostCaptions: 'Captions', hostComfort: 'Comfort', hostLanguage: 'Language',
    soundMic: 'Room mic', soundComputer: 'Computer music', soundDemo: 'Demo music', capAll: 'All', capGround: 'Only bring me back', capNone: 'None',
    comfortOn: 'Gentle', comfortOff: 'Normal', langYue: '廣東話', langEn: 'English', langCmn: '普通話', hostHint: 'Esc, or hold the bottom-right corner for two seconds, opens this again.',
  },
};

export function line(key, lang = 'en') {
  return (LINES[lang] || LINES.en)[key] || '';
}

const WORLD_WORDS = {
  zh: { physarum: '菌網', swarm: '螢火', boids: '魚群', life: '星球' },
  en: { physarum: 'mycelium', swarm: 'fireflies', boids: 'fish', life: 'planet' },
};
const MOOD_WORDS = { zh: { dream: '夢', melt: '溶', electric: '電', clear: '清', holy: '聖' }, en: {} };
const PALETTE_WORDS = { zh: { ink: '墨', silk: '絲', ember: '燼', neon: '霓' }, en: {} };

export function worldName(world, lang = 'en') {
  return (WORLD_WORDS[lang] || WORLD_WORDS.en)[world] || '';
}

/* At most two short tokens for a JEV decision: the world when it changes (p ≥ .5 when asked for in words, ≥ .6 on its
   own), then mood, palette, and a clear energy move. The view is left out: the picture shows it. */
export function decisionCaption(decision, { world, lang = 'en', asked = false } = {}) {
  if (!decision || typeof decision !== 'object') return '';
  const t = [], s = decision.scene;
  if (s && s.choice && s.choice !== world && s.p >= (asked ? 0.5 : 0.6)) t.push(worldName(s.choice, lang));
  if (decision.mood) t.push((MOOD_WORDS[lang] || {})[decision.mood] || decision.mood);
  if (decision.palette) t.push((PALETTE_WORDS[lang] || {})[decision.palette] || decision.palette);
  if (typeof decision.energy === 'number') { if (decision.energy > 0.6) t.push(line('stronger', lang)); else if (decision.energy < 0.35) t.push(line('softer', lang)); }
  return t.filter(Boolean).slice(0, 2).join(' · ');
}

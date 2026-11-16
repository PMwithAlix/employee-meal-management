const ARABIC_YE = /\u064A/g;
const ARABIC_KAF = /\u0643/g;
const TEH_MARBUTA = /\u0629/g;
const TATWEEL = /\u0640/g;
const ALEF_HAMZA = /[\u0623\u0625]/g;
const WAW_HAMZA = /\u0624/g;
const YEH_HAMZA = /\u0626/g;
const DIACRITICS = /[\u064B-\u065F\u0670]/g;
const SPACE_LIKE =
  /[\u00A0\u1680\u2000-\u200A\u200B\u200C\u200D\u202F\u205F\u3000\uFEFF]/g;

export function normalizeFoodName(title: string) {
  return title
    .replace(ARABIC_YE, 'ی')
    .replace(ARABIC_KAF, 'ک')
    .replace(TEH_MARBUTA, 'ه')
    .replace(ALEF_HAMZA, 'ا')
    .replace(WAW_HAMZA, 'و')
    .replace(YEH_HAMZA, 'ی')
    .replace(TATWEEL, '')
    .replace(DIACRITICS, '')
    .replace(SPACE_LIKE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa');
}

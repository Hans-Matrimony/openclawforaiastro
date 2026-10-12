// Test scenarios for the HANS Reading Output Contract.
// Reading scenarios replay real captured VedAstro tool output (fixtures/) the way
// the agent would see it; mockGood/mockBad drive the no-API self-test.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

function loadFixture(name) {
  try {
    return JSON.parse(readFileSync(join(here, 'fixtures', name), 'utf8'));
  } catch {
    return null;
  }
}

const predictions = loadFixture('marriage-predictions.json');
const planets = loadFixture('planets-slice.json');
const dasa = loadFixture('dasa-ranges.json');

const BIRTH = 'Janm: 14-06-1996, raat 7:45 baje, Kanpur (male).';

function toolBlock() {
  if (!predictions || !planets) return '';
  const payload = {
    HoroscopePredictions: predictions.Items,
    AllPlanetData: planets.Planets,
  };
  if (dasa) payload.DasaAtRange = dasa.Ranges;
  return '\n\n[TOOL RESULTS — vedastro-chart skill]\n' + JSON.stringify(payload, null, 0);
}

export const scenarios = [
  {
    name: 'gf-marriage',
    expect: 'reading',
    question: 'Kya meri GF se meri shadi hogi?',
    userTurn: `${BIRTH} Sawal: "Kya meri GF se meri shadi hogi?"${toolBlock()}`,
    mockGood: [
      'Abhi wali girlfriend se shaadi ki sambhavana kam hai — tumhare 7th ghar mein Sun baitha hai jo shaadi mein delay deta hai, aur 7th ka lord Mercury 6th ghar mein rishton ke conflict dikhata hai. Venus bhi Sun ke saath afflicted hai, isliye beech mein dooriyan aur tension ka sanket hai. Haan, 9th ka lord 7th mein hone se strong aur lucky partner ka yog zaroor hai, par wo thodi der baad, 30 ki umar ke aas-paas milega.',
      'Nahi, abhi wali GF se shaadi ki sambhavana kam hai.',
      'Kya future mein koi aur special person hai jo meri life badal sakta hai?',
    ].join('\n\n'),
    mockBad: 'VedAstro ke Shadbala assessment mein Shukra strong mana gaya hai. November 2031 se July 2034 ek conditional sanket hai, pakki date nahi. September 2027 se November 2028 bhi ek doosra window hai.',
  },
  {
    name: 'marriage-timing',
    expect: 'reading',
    timing: true,
    question: 'Meri shaadi kab hogi?',
    userTurn: `${BIRTH} Sawal: "Meri shaadi kab hogi?"${toolBlock()}`,
    mockGood: [
      'Shaadi ke liye sabse anukool window hai Nov 2031 se July 2034, jab tumhara Shukra-Guru period chal raha hoga. 7th ka Sun pehle ke saal delay karega, isliye 2027-28 wala pehla window kamzor maana hai. Guru ki kripa se rishta pakka hone ke chances usi daur sabse zyada hain, isliye usi ka intezaar best rahega.',
      'Nov 2031 se July 2034 shaadi ka best time.',
      'Shaadi ke baad paise ka kya scene rahega?',
    ].join('\n\n'),
    mockBad: 'Shaadi ke liye November 2031 se July 2034 zyada anukool window hai — Shukra-Guru period ka conditional sanket, pakki date nahi. September 2027 se November 2028 doosra, kam anukool period hai.',
  },
  {
    name: 'vague-result',
    expect: 'routine',
    question: 'Kya mera result achha aayega?',
    userTurn: 'Kya mera result achha aayega?',
    mockGood: 'Kaunsa result — exam ka ya interview ka? Subject aur mahina batao.',
    mockBad: 'Result achha aayega — aapke chart ka Guru 9th ghar mein balwan hai, Shani bhi support de raha hai.',
  },
  {
    name: 'greeting',
    expect: 'routine',
    question: 'Hi',
    userTurn: 'Hi',
    mockGood: 'Namaste! Batao, aaj kya jaanna hai?',
    mockBad: 'Namaste! Aapke lagna ka swami Guru 8th ghar mein hai — health aur rishton ke sawal zaroor poochhiye.',
  },
];

import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCompanionLanguage,companionInstructionEcho} from '../extensions/reviewed-reading/direct/companion-language.mjs';
const value={language:'hinglish'};

test('listening footer detection preserves quoted wording, requested drafts and ordinary acknowledgment',()=>{
 const input={query:'Bas meri baat suniye, advice ya sawal mat dijiye.'};
 for(const reply of [
  'Main sun raha hoon; uski taraf se koi reason nahi banaunga, aur abhi advice ya sawaal bhi nahi dunga.',
  'Main aapki disappointment samajh raha hoon—koi advice ya sawaal nahi.',
  'I will not give advice or ask questions.',
  'मैं न सलाह दूँगा और न सवाल पूछूँगा।',
 ])assert.equal(companionInstructionEcho(reply,input),true,reply);
 for(const reply of [
  'Bina bataye plan cancel hone se bura laga. Main sun raha hoon.',
  'Your friend gave no advice and asked no questions.',
  '"I will not give advice or ask questions."',
  '`No advice or questions`',
 ])assert.equal(companionInstructionEcho(reply,input),false,reply);
 assert.equal(companionInstructionEcho('I will not give advice or ask questions.',{query:'Confirm that you will not give advice or ask questions.'}),false);
 assert.equal(companionInstructionEcho('मैं न सलाह दूँगा और न सवाल पूछूँगा।',{query:'इसका हिंदी अनुवाद कीजिए।'}),false);
});
test('companion presentation preserves quotations, code, URLs, facts and self grammar',()=>{
 const protectedParts=['"tumhari baat keh do"','“practice karo”',"'kar lo'",'`karo`','```\ntum\n```','https://example.test/karo'];
 const original=protectedParts.join(' ')+' Main sun raha hoon. Main karungi. Rohan ka interview 28 November 2026 ko hai. Aap ho sakte hain.';
 assert.equal(normalizeCompanionLanguage(original,value),original);
 assert.equal(normalizeCompanionLanguage('Tumne kaha, practice karo.',{language:'english'}),'Tumne kaha, practice karo.');
 assert.equal(normalizeCompanionLanguage("I'm here; aap keh do.",value),"I'm here; aap keh dijiye.");
});

test('breathing and take imperatives use respectful address without changing quoted speech',()=>{
 assert.equal(normalizeCompanionLanguage('Dheere-dheere saans lo, phir ek break le lo.',value),'Dheere-dheere saans lijiye, phir ek break le lijiye.');
 for(const text of ['"saans lo"','“break le lo”','`saans lo`','https://example.test/le/lo','Main saans le raha hoon.'])
  assert.equal(normalizeCompanionLanguage(text,value),text);
});

test('negated commands and common lo verb forms preserve negation and respectful agreement',()=>{
 for(const verb of ['kar','dekh','rakh','le','pi','sun','soch','samajh','likh','padh','bol','kha','pooch','mat'])
  assert.equal(normalizeCompanionLanguage(`Aap ${verb} lo.`,value),`Aap ${verb} lijiye.`);
 assert.equal(normalizeCompanionLanguage('Saans lijiye; tayari ka pressure mat lo.',value),'Saans lijiye; tayari ka pressure mat lijiye.');
 assert.equal(normalizeCompanionLanguage('"pressure mat lo" Rohan ka interview parso hai.',value),'"pressure mat lo" Rohan ka interview parso hai.');
});

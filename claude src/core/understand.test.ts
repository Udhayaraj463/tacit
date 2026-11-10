import { describe, expect, test } from 'vitest';
import { BUILTIN_CARDS, cardsForStore } from './cards';
import { classify } from './classify';
import { MAX_AUDIO_B64, MAX_TEXT, buildPrompt, checkRequest, fuse, geminiBody, parseAnswer } from './understand';

const STORE_IDS = ['cvs', 'drink', 'pharmacy'];
const cvs = cardsForStore(BUILTIN_CARDS, 'cvs');

describe('checkRequest', () => {
  test('accepts text for a known store', () => {
    expect(checkRequest({ store: 'cvs', text: '那個要不要' }, STORE_IDS)).toEqual({ ok: true, req: { store: 'cvs', text: '那個要不要' } });
  });

  test('accepts wav audio', () => {
    const r = checkRequest({ store: 'cvs', audio: { mime: 'audio/wav', data: 'UklGRg==' } }, STORE_IDS);
    expect(r.ok).toBe(true);
  });

  test.each([
    ['not an object', null],
    ['unknown store', { store: 'bank', text: '你好' }],
    ['neither text nor audio', { store: 'cvs' }],
    ['both text and audio', { store: 'cvs', text: '你好', audio: { mime: 'audio/wav', data: 'UklGRg==' } }],
    ['empty text', { store: 'cvs', text: '   ' }],
    ['text too long', { store: 'cvs', text: '字'.repeat(MAX_TEXT + 1) }],
    ['audio too big', { store: 'cvs', audio: { mime: 'audio/wav', data: 'A'.repeat(MAX_AUDIO_B64 + 4) } }],
    ['other audio type', { store: 'cvs', audio: { mime: 'audio/mp3', data: 'UklGRg==' } }],
    ['audio that is not base64', { store: 'cvs', audio: { mime: 'audio/wav', data: '<script>' } }],
  ])('rejects %s', (_why, body) => {
    expect(checkRequest(body, STORE_IDS).ok).toBe(false);
  });
});

describe('buildPrompt', () => {
  test('lists every card of the store by id and question', () => {
    const p = buildPrompt(cvs, '那個要放手機嗎');
    for (const card of cvs) expect(p).toContain(`${card.id}：${card.question}`);
    expect(p).toContain('那個要放手機嗎');
  });

  test('asks for a transcript when the input is audio', () => {
    expect(buildPrompt(cvs)).toContain('逐字');
  });
});

describe('geminiBody', () => {
  test('text: one text part, JSON output limited to the store card ids', () => {
    const body = geminiBody({ store: 'cvs', text: '那個要不要' }, cvs) as {
      contents: { parts: { text?: string }[] }[];
      generationConfig: { responseMimeType: string; responseSchema: { properties: { card_id: { enum: string[] } } } };
    };
    expect(body.contents[0].parts).toHaveLength(1);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.properties.card_id.enum).toEqual([...cvs.map((x) => x.id), 'none']);
  });

  test('audio: the recording goes along as inline data', () => {
    const body = geminiBody({ store: 'cvs', audio: { mime: 'audio/wav', data: 'UklGRg==' } }, cvs) as {
      contents: { parts: { inlineData?: { mimeType: string; data: string } }[] }[];
    };
    expect(body.contents[0].parts).toContainEqual({ inlineData: { mimeType: 'audio/wav', data: 'UklGRg==' } });
  });
});

describe('parseAnswer', () => {
  test('reads the transcript and the card id', () => {
    expect(parseAnswer('{"transcript":"有載具嗎","card_id":"carrier"}', cvs)).toEqual({ transcript: '有載具嗎', cardId: 'carrier' });
  });

  test('"none" means no card', () => {
    expect(parseAnswer('{"transcript":"今天好熱","card_id":"none"}', cvs)).toEqual({ transcript: '今天好熱', cardId: null });
  });

  test('a card from another store is dropped, never guessed', () => {
    expect(parseAnswer('{"transcript":"要甜度嗎","card_id":"sugar"}', cvs)?.cardId).toBeNull();
  });

  test('broken JSON is null', () => {
    expect(parseAnswer('sorry', cvs)).toBeNull();
    expect(parseAnswer('{"card_id":42}', cvs)).toBeNull();
  });

  test('a missing transcript becomes empty', () => {
    expect(parseAnswer('{"card_id":"bag"}', cvs)).toEqual({ transcript: '', cardId: 'bag' });
  });
});

describe('fuse: rules first, the model only fills in an unknown', () => {
  const ctx = { store: 'cvs', cards: BUILTIN_CARDS, call: { number: '42' } };

  test('a rule hit wins over the model', () => {
    const rule = classify('有載具嗎', ctx);
    expect(fuse(rule, 'bag', cvs)).toBe(rule);
  });

  test('amounts and calls stay with the rules', () => {
    const rule = classify('總共235元', ctx);
    expect(fuse(rule, 'bag', cvs)).toBe(rule);
  });

  test('an unknown becomes the model card, marked as from the model', () => {
    const r = fuse(classify('那個要不要放手機裡', ctx), 'carrier', cvs);
    expect(r).toMatchObject({ kind: 'card', card: { id: 'carrier' }, byModel: true });
  });

  test('no model card keeps the unknown', () => {
    const rule = classify('今天好熱', ctx);
    expect(fuse(rule, null, cvs)).toBe(rule);
  });
});

import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { z } from 'zod';
import { mnemonicPrompt } from '../../lib/prompt';

const schema = z.object({
  word: z.string().min(1).max(30).regex(/^[A-Za-z']+$/)
});

type Candidate = { mnemonic: string; scene: string };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  }
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid word' } });
  }
  const { word } = parse.data;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = mnemonicPrompt(word);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs ONLY valid JSON for developers.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    });
    const text = completion.choices[0]?.message?.content ?? '{}';
    let data: any = {};
    try { data = JSON.parse(text); } catch (e) {}
    const candidates: Candidate[] = Array.isArray(data?.candidates) ? data.candidates : [];
    if (!candidates.length) {
      throw new Error('No candidates returned');
    }
    // basic safety filter (client still must check)
    const banned = /(死|殺|差別|ヘイト|fuck|shit)/i;
    const safe = candidates.filter(c => !banned.test(c.mnemonic) && !banned.test(c.scene)).slice(0, 3);
    if (!safe.length) throw new Error('Filtered all candidates');
    return res.status(200).json({ candidates: safe });
  } catch (err: any) {
    console.error('mnemonic error', err);
    return res.status(500).json({ error: { code: 'MNEMONIC_FAILED', message: err?.message || 'Generation failed' } });
  }
}

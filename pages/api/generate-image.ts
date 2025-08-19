import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { z } from 'zod';

const schema = z.object({
  mnemonic: z.string().min(1).max(200),
  scene: z.string().min(1).max(200)
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'POST only' } });
  }
  const parse = schema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid body' } });
  }
  const { mnemonic, scene } = parse.data;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    // Quick translate scene into English for image prompt
    const translation = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Translate the following concise Japanese scene into simple English, one short sentence. Output English only.' },
        { role: 'user', content: scene }
      ],
      temperature: 0.2
    });
    const sceneEn = translation.choices[0]?.message?.content?.trim() || scene;

    const prompt = `A clear, memorable illustration for vocabulary learning.
Scene: ${sceneEn}.
Style: simple, clean, bright, educational, no text.
Square 1024x1024, high readability, single main subject.`;

    const img = await openai.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: '1024x1024'
    });
    const b64 = img.data?.[0]?.b64_json;
    if (!b64) {
      // some SDKs provide URL instead — try url fall-back
      const url = (img.data?.[0] as any)?.url;
      if (url) return res.status(200).json({ imageUrl: url });
      throw new Error('No image produced');
    }
    const dataUrl = `data:image/png;base64,${b64}`;
    return res.status(200).json({ imageUrl: dataUrl });
  } catch (err: any) {
    console.error('image error', err);
    return res.status(500).json({ error: { code: 'IMAGE_FAILED', message: err?.message || 'Image generation failed' } });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import path from 'path';

const anthropic = new Anthropic();

interface ExtractedScore {
  homeScore: number | null;
  awayScore: number | null;
  confidence: 'high' | 'medium' | 'low';
  rawText: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl, imageBase64, homeTeamName, awayTeamName } = body;

    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { error: 'Either imageUrl or imageBase64 is required' },
        { status: 400 }
      );
    }

    let imageData: { type: 'base64'; media_type: string; data: string } | { type: 'url'; url: string };

    if (imageBase64) {
      // Use provided base64 data
      imageData = {
        type: 'base64',
        media_type: 'image/jpeg',
        data: imageBase64,
      };
    } else if (imageUrl.startsWith('/uploads/')) {
      // Local file - read and convert to base64
      const filePath = path.join(process.cwd(), 'public', imageUrl);
      const fileBuffer = await readFile(filePath);
      const base64 = fileBuffer.toString('base64');
      const ext = path.extname(imageUrl).toLowerCase();
      const mediaType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : 'image/jpeg';

      imageData = {
        type: 'base64',
        media_type: mediaType,
        data: base64,
      };
    } else {
      // External URL
      imageData = {
        type: 'url',
        url: imageUrl,
      };
    }

    // Build the prompt for score extraction
    const teamContext = homeTeamName && awayTeamName
      ? `The teams playing are: "${homeTeamName}" (home) vs "${awayTeamName}" (away).`
      : 'Extract the scores for both teams shown.';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: imageData as Anthropic.ImageBlockParam['source'],
            },
            {
              type: 'text',
              text: `Analyze this bocce league scoreboard image and extract the final scores.

${teamContext}

Look for:
- Digital displays showing numbers
- Handwritten scores on a whiteboard or paper
- Scoreboard with team names and numbers
- Any numeric values that represent game scores

Bocce scores typically range from 0-12 or 0-15 per game.

Respond ONLY with a JSON object in this exact format (no markdown, no code blocks, just the raw JSON):
{
  "homeScore": <number or null if unclear>,
  "awayScore": <number or null if unclear>,
  "confidence": "<high|medium|low>",
  "rawText": "<brief description of what you see on the scoreboard>"
}

If you cannot determine the scores with any confidence, set both scores to null and explain in rawText.`,
            },
          ],
        },
      ],
    });

    // Parse the response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    // Try to parse the JSON response
    let extractedScore: ExtractedScore;
    try {
      // Remove any potential markdown code blocks
      const cleanJson = responseText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      extractedScore = JSON.parse(cleanJson);
    } catch {
      // If parsing fails, return a structured error response
      extractedScore = {
        homeScore: null,
        awayScore: null,
        confidence: 'low',
        rawText: `Could not parse AI response: ${responseText}`,
      };
    }

    return NextResponse.json(extractedScore);
  } catch (error) {
    console.error('Error extracting score from image:', error);

    // Check if it's an API key error
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json(
        {
          error: 'AI service not configured',
          details: 'Please set the ANTHROPIC_API_KEY environment variable',
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to extract score from image' },
      { status: 500 }
    );
  }
}

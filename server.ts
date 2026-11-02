import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  buildQuotaFallbackReply,
  buildSystemInstruction,
  derivePlaceSearchQuery,
  determineGroundingStrategy,
  extractGroundingSources,
  getModelFallbackChain,
  isQuotaOrRateLimitError,
} from './src/utils/spatialParser.ts';
import type {
  ChatbotRoleId,
  GeminiModelId,
  GroundedSource,
  GroundingMode,
  LatLngLiteral,
} from './src/utils/spatialParser.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY || 'MISSING_KEY',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/chat', async (req, res) => {
    const {
      messages = [],
      model = 'gemini-3.8-flash',
      roleId = 'concierge',
      groundingMode = 'auto',
      activeCityName = 'San Francisco, CA',
      center = { lat: 37.7955, lng: -122.3937 },
    }: {
      messages: ChatHistoryTurn[];
      model: GeminiModelId;
      roleId: ChatbotRoleId;
      groundingMode: GroundingMode;
      activeCityName: string;
      center: LatLngLiteral;
    } = req.body || {};

    const validMessages = Array.isArray(messages)
      ? messages.filter(
          (m) => m && typeof m.text === 'string' && m.text.trim() !== ''
        )
      : [];

    if (validMessages.length === 0) {
      res
        .status(400)
        .json({ error: 'Please enter a location question or message.' });
      return;
    }

    const latestUserMessage =
      validMessages[validMessages.length - 1].text.trim();
    const systemInstruction = buildSystemInstruction(
      roleId,
      activeCityName,
      center
    );
    const strategy = determineGroundingStrategy(
      latestUserMessage,
      groundingMode
    );

    const contents = validMessages.map((m) => ({
      role: m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.text }],
    }));

    const ai = getAiClient();
    const allowedModels: GeminiModelId[] = [
      'gemini-3.8-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
      'gemini-4-argon',
    ];
    let targetModel: GeminiModelId = allowedModels.includes(model)
      ? model
      : 'gemini-3.8-flash';
    let modelNote: string | undefined;

    const callWithModelFallback = async (
      selectedModel: GeminiModelId,
      toolType: 'maps' | 'search'
    ) => {
      const config: Record<string, any> = {
        systemInstruction,
      };

      if (toolType === 'maps') {
        config.tools = [{ googleMaps: {} }];
        config.toolConfig = {
          retrievalConfig: {
            latLng: {
              latitude: Number(center.lat) || 37.7955,
              longitude: Number(center.lng) || -122.3937,
            },
          },
        };
      } else {
        config.tools = [{ googleSearch: {} }];
      }

      const fallbackChain = getModelFallbackChain(selectedModel);
      let lastError: unknown = null;

      for (let i = 0; i < fallbackChain.length; i++) {
        const candidateModel = fallbackChain[i];
        try {
          const result = await ai.models.generateContent({
            model: candidateModel,
            contents,
            config,
          });
          if (candidateModel !== selectedModel) {
            modelNote = `Automatically switched to ${candidateModel}`;
          }
          targetModel = candidateModel;
          return result;
        } catch (err: any) {
          lastError = err;
        }
      }

      throw lastError || new Error('All Gemini models failed.');
    };

    try {
      const primaryToolType: 'maps' | 'search' =
        strategy === 'search' ? 'search' : 'maps';
      const response = await callWithModelFallback(
        targetModel,
        primaryToolType
      );
      const replyText = response.text || '';
      const extractedSources = extractGroundingSources(
        response.candidates?.[0]?.groundingMetadata
      );

      // Deduplicate sources by URI
      const uniqueSources: GroundedSource[] = [];
      const seen = new Set<string>();
      for (const src of extractedSources) {
        if (!seen.has(src.uri)) {
          seen.add(src.uri);
          uniqueSources.push(src);
        }
      }

      const suggestedPlaceQuery = derivePlaceSearchQuery(
        latestUserMessage,
        uniqueSources,
        activeCityName
      );

      res.json({
        reply:
          replyText ||
          `I searched Google Maps and Google Search around ${activeCityName}. Select any place pin on the map to inspect live ratings, hours, and directions.`,
        sources: uniqueSources,
        suggestedPlaceQuery,
        usedModel: targetModel,
        modelNote,
        strategyUsed: strategy,
      });
    } catch (error: any) {
      const rawMessage = String(
        error?.message || error || 'Unknown Gemini error'
      );

      // When Gemini API returns 429 RESOURCE_EXHAUSTED across all fallback models,
      // serve a graceful live-map spatial fallback response so the app continues plotting places seamlessly.
      if (isQuotaOrRateLimitError(rawMessage)) {
        console.warn(
          'Gemini API quota reached (429 RESOURCE_EXHAUSTED); serving live Google Maps spatial fallback.'
        );
        const fallbackPayload = buildQuotaFallbackReply({
          userQuery: latestUserMessage,
          roleId,
          activeCityName,
          center,
        });

        res.json({
          reply: fallbackPayload.reply,
          sources: fallbackPayload.sources,
          suggestedPlaceQuery: fallbackPayload.suggestedPlaceQuery,
          usedModel: targetModel,
          modelNote: fallbackPayload.modelNote,
          strategyUsed: strategy,
          quotaFallback: true,
        });
        return;
      }

      console.warn('Notice in /api/chat:', rawMessage);

      let userFriendlyError = rawMessage;
      if (
        rawMessage.includes('403') ||
        rawMessage.includes('PERMISSION_DENIED') ||
        rawMessage.includes('API_KEY_INVALID') ||
        rawMessage.includes('MISSING_KEY')
      ) {
        userFriendlyError =
          'Unable to verify Gemini API key permissions. Please check your API key configuration in the Settings > Secrets panel.';
      }

      res.status(500).json({
        error: userFriendlyError,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();

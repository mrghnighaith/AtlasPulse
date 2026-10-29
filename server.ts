import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  buildSystemInstruction,
  ChatbotRoleId,
  derivePlaceSearchQuery,
  determineGroundingStrategy,
  extractGroundingSources,
  GeminiModelId,
  GroundedSource,
  GroundingMode,
  LatLngLiteral,
} from './src/utils/spatialParser';

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
    try {
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
        ? messages.filter((m) => m && typeof m.text === 'string' && m.text.trim() !== '')
        : [];

      if (validMessages.length === 0) {
        res.status(400).json({ error: 'Please enter a location question or message.' });
        return;
      }

      const latestUserMessage = validMessages[validMessages.length - 1].text.trim();
      const systemInstruction = buildSystemInstruction(roleId, activeCityName, center);
      const strategy = determineGroundingStrategy(latestUserMessage, groundingMode);

      const contents = validMessages.map((m) => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.text }],
      }));

      const ai = getAiClient();
      const allowedModels: GeminiModelId[] = [
        'gemini-3.8-flash',
        'gemini-3.1-flash-lite',
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

        try {
          return await ai.models.generateContent({
            model: selectedModel,
            contents,
            config,
          });
        } catch (err: any) {
          const msg = String(err?.message || err || '');
          if (selectedModel !== 'gemini-3.8-flash') {
            modelNote = 'Automatically switched to gemini-3.8-flash';
            targetModel = 'gemini-3.8-flash';
            return await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents,
              config,
            });
          }
          throw new Error(msg);
        }
      };

      let replyText = '';
      const allSources: GroundedSource[] = [];

      if (strategy === 'maps') {
        const response = await callWithModelFallback(targetModel, 'maps');
        replyText = response.text || '';
        const mapsSources = extractGroundingSources(
          response.candidates?.[0]?.groundingMetadata
        );
        allSources.push(...mapsSources);
      } else if (strategy === 'search') {
        // Per prompt requirement: Use gemini-3.8-flash (with googleSearch tool) for Search Grounding
        const searchModel: GeminiModelId =
          targetModel === 'gemini-4-argon' ? 'gemini-4-argon' : 'gemini-3.8-flash';
        const response = await callWithModelFallback(searchModel, 'search');
        replyText = response.text || '';
        const webSources = extractGroundingSources(
          response.candidates?.[0]?.groundingMetadata
        );
        allSources.push(...webSources);
      } else {
        // 'both' strategy: Run primary multi-turn with Maps Grounding + parallel Search Grounding on gemini-3.8-flash
        const [mapsResult, searchResult] = await Promise.allSettled([
          callWithModelFallback(targetModel, 'maps'),
          ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: `${latestUserMessage} (Focus location: ${activeCityName}, ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})`,
            config: {
              systemInstruction:
                'Provide concise, up-to-date local facts, current hours/events, and verified web context in 2-3 sentences.',
              tools: [{ googleSearch: {} }],
            },
          }),
        ]);

        if (mapsResult.status === 'fulfilled') {
          replyText = mapsResult.value.text || '';
          const mapsSources = extractGroundingSources(
            mapsResult.value.candidates?.[0]?.groundingMetadata
          );
          allSources.push(...mapsSources);
        }

        if (searchResult.status === 'fulfilled') {
          const webSources = extractGroundingSources(
            searchResult.value.candidates?.[0]?.groundingMetadata
          );
          allSources.push(...webSources);
          if (!replyText && searchResult.value.text) {
            replyText = searchResult.value.text;
          }
        }

        if (mapsResult.status === 'rejected' && searchResult.status === 'rejected') {
          throw mapsResult.reason;
        }
      }

      // Deduplicate combined sources by URI
      const uniqueSources: GroundedSource[] = [];
      const seen = new Set<string>();
      for (const src of allSources) {
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
      const rawMessage = String(error?.message || error || 'Unknown Gemini error');
      console.error('Error in /api/chat:', rawMessage);

      // Provide helpful guidance per gemini-api skill error rules
      let userFriendlyError = rawMessage;
      if (rawMessage.includes('403') || rawMessage.includes('PERMISSION_DENIED') || rawMessage.includes('API_KEY_INVALID') || rawMessage.includes('MISSING_KEY')) {
        userFriendlyError =
          'Unable to verify Gemini API key permissions. Please check your API key configuration in the Settings > Secrets panel.';
      } else if (rawMessage.includes('429') || rawMessage.includes('RESOURCE_EXHAUSTED')) {
        userFriendlyError =
          'API rate limit or quota reached. Upgrading to a paid tier in Settings > Secrets increases your quota.';
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  determineGroundingStrategy,
  extractGroundingSources,
  derivePlaceSearchQuery,
  calculateHaversineDistanceKm,
  formatCoordinate,
  buildSystemInstruction,
  resolveMapStyleConfig,
  MAP_STYLE_OPTIONS,
  calculateMultiStopMetrics,
  CHATBOT_ROLES,
  getBotRoleById,
  detectAndroidOrMobile,
  resolveEffectiveDevicePlatform,
  getModelFallbackChain,
  isQuotaOrRateLimitError,
  buildQuotaFallbackReply,
  resolveChatLayoutConfig,
  findNearestKnownLocality,
  extractLocalityFromFormattedAddress,
  buildUserLocationPreset,
  resolveInitialUserLocationPreset,
  formatExactCoordinate,
  parseCoordinateInput,
  extractExactStreetAddress,
  buildInitialGreetingMessage,
} from './spatialParser';

test('resolveMapStyleConfig resolves standard, roadmap, satellite, hybrid, and high-contrast styles', () => {
  assert.equal(MAP_STYLE_OPTIONS.length, 5);
  assert.equal(resolveMapStyleConfig('standard').mapTypeId, 'roadmap');
  assert.equal(resolveMapStyleConfig('roadmap').mapTypeId, 'roadmap');
  assert.equal(resolveMapStyleConfig('satellite').mapTypeId, 'satellite');
  assert.equal(resolveMapStyleConfig('hybrid').mapTypeId, 'hybrid');

  const highContrast = resolveMapStyleConfig('high-contrast');
  assert.equal(highContrast.id, 'high-contrast');
  assert.equal(highContrast.isHighContrast, true);
  assert.equal(highContrast.colorScheme, 'DARK');
  assert.equal(highContrast.pinPalette.defaultBg, '#facc15');
  assert.equal(highContrast.pinPalette.defaultGlyph, '#000000');
  assert.ok(Array.isArray(highContrast.customMapStyles) && highContrast.customMapStyles.length > 0);

  assert.equal(resolveMapStyleConfig('unknown').id, 'standard');
});

test('determineGroundingStrategy honors explicit modes and auto-detects hybrid queries', () => {
  assert.equal(determineGroundingStrategy('best coffee nearby', 'maps'), 'maps');
  assert.equal(determineGroundingStrategy('best coffee nearby', 'search'), 'search');
  assert.equal(determineGroundingStrategy('what events are happening today', 'auto'), 'search');
  assert.equal(
    determineGroundingStrategy('best coffee shops open today near Ferry Building', 'auto'),
    'both'
  );
});

test('extractGroundingSources extracts and deduplicates both maps and web chunks with review snippets', () => {
  const mockMetadata = {
    groundingChunks: [
      {
        maps: {
          title: 'Tartine Bakery',
          uri: 'https://maps.google.com/?cid=111',
          placeAnswerSources: {
            reviewSnippets: [
              { text: 'Incredible morning buns and country bread.' },
              'Expect a short line on weekends.',
            ],
          },
        },
      },
      {
        maps: {
          title: 'Duplicate Tartine',
          uri: 'https://maps.google.com/?cid=111',
        },
      },
      {
        web: {
          title: 'SF Eater Guide 2026',
          uri: 'https://sf.eater.com/essential-bakeries',
        },
      },
    ],
  };

  const sources = extractGroundingSources(mockMetadata);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].kind, 'maps');
  assert.equal(sources[0].title, 'Tartine Bakery');
  assert.deepEqual(sources[0].reviewSnippets, [
    'Incredible morning buns and country bread.',
    'Expect a short line on weekends.',
  ]);
  assert.equal(sources[1].kind, 'web');
  assert.equal(sources[1].title, 'SF Eater Guide 2026');
});

test('derivePlaceSearchQuery prioritizes grounded map titles or cleans user prompt', () => {
  const withMaps = derivePlaceSearchQuery(
    'Where can I get pastries?',
    [{ id: '1', kind: 'maps', title: 'b. patisserie', uri: 'https://maps.google.com/1' }],
    'San Francisco, CA'
  );
  assert.equal(withMaps, 'b. patisserie San Francisco, CA');

  const fromPrompt = derivePlaceSearchQuery(
    'What are the best ramen spots?',
    [],
    'Tokyo, Japan'
  );
  assert.equal(fromPrompt, 'best ramen spots in Tokyo, Japan');
});

test('calculateHaversineDistanceKm and formatCoordinate return accurate values', () => {
  const ferryBuilding = { lat: 37.7955, lng: -122.3937 };
  const unionSquare = { lat: 37.7879, lng: -122.4075 };
  const dist = calculateHaversineDistanceKm(ferryBuilding, unionSquare);
  assert.ok(dist > 1.3 && dist < 1.6, `Expected distance around 1.48km, got ${dist}`);
  assert.equal(formatCoordinate(37.7955, -122.3937), '37.7955°N, 122.3937°W');
});

test('CHATBOT_ROLES defines 8 specialized AI bots with badges, samplePrompts, and system instructions', () => {
  assert.equal(CHATBOT_ROLES.length, 8);
  const expectedIds = [
    'concierge',
    'culinary',
    'urbanist',
    'transit',
    'nightlife',
    'outdoors',
    'work',
    'family',
  ];
  assert.deepEqual(
    CHATBOT_ROLES.map((r) => r.id),
    expectedIds
  );

  for (const role of CHATBOT_ROLES) {
    assert.ok(role.specialtyBadge.length > 0);
    assert.ok(role.samplePrompts.length >= 2);
    assert.equal(getBotRoleById(role.id).id, role.id);

    const instruction = buildSystemInstruction(role.id, 'London, UK', {
      lat: 51.5074,
      lng: -0.1278,
    });
    assert.ok(instruction.includes('London, UK'));
    assert.ok(instruction.includes('51.5074'));
  }

  assert.equal(getBotRoleById('unknown-bot').id, 'concierge');
  assert.ok(
    buildSystemInstruction('nightlife', 'Tokyo, Japan', { lat: 35.6762, lng: 139.6503 }).includes(
      'Nightlife & Live Music Curator'
    )
  );
  assert.ok(
    buildSystemInstruction('work', 'New York, NY', { lat: 40.7128, lng: -74.006 }).includes(
      'Remote Work & Study Scout'
    )
  );
});

test('calculateMultiStopMetrics handles zero, single, and multiple coordinates', () => {
  const empty = calculateMultiStopMetrics([]);
  assert.equal(empty.totalDistanceKm, 0);
  assert.equal(empty.totalDurationMinutes, 0);

  const ferryBuilding = { lat: 37.7955, lng: -122.3937 };
  const unionSquare = { lat: 37.7879, lng: -122.4075 };
  const coitTower = { lat: 37.8024, lng: -122.4058 };

  const walk = calculateMultiStopMetrics([ferryBuilding, unionSquare, coitTower], 'WALKING');
  assert.ok(walk.totalDistanceKm > 2.5 && walk.totalDistanceKm < 4.0);
  assert.ok(walk.totalDurationMinutes > 20);
  assert.ok(walk.formattedDistance.includes('km'));
  assert.ok(walk.formattedDuration.includes('min'));

  const drive = calculateMultiStopMetrics([ferryBuilding, unionSquare, coitTower], 'DRIVING');
  assert.ok(drive.totalDurationMinutes < walk.totalDurationMinutes);
});

test('detectAndroidOrMobile and resolveEffectiveDevicePlatform support PC and Android Browser versions', () => {
  const desktopUA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const androidChromeUA =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.122 Mobile Safari/537.36';

  assert.equal(detectAndroidOrMobile(desktopUA, 1440), false);
  assert.equal(detectAndroidOrMobile(androidChromeUA, 412), true);
  assert.equal(detectAndroidOrMobile(desktopUA, 390), true);

  assert.equal(resolveEffectiveDevicePlatform('auto', desktopUA, 1440), 'pc');
  assert.equal(resolveEffectiveDevicePlatform('auto', androidChromeUA, 412), 'android');
  assert.equal(resolveEffectiveDevicePlatform('android', desktopUA, 1440), 'android');
  assert.equal(resolveEffectiveDevicePlatform('pc', androidChromeUA, 412), 'pc');
});

test('getModelFallbackChain, isQuotaOrRateLimitError, and buildQuotaFallbackReply handle 429 RESOURCE_EXHAUSTED gracefully', () => {
  const chainFromDefault = getModelFallbackChain('gemini-3.8-flash');
  assert.deepEqual(chainFromDefault, [
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ]);

  const chainFromPro = getModelFallbackChain('gemini-4-argon');
  assert.deepEqual(chainFromPro, [
    'gemini-4-argon',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
  ]);

  assert.equal(
    isQuotaOrRateLimitError(
      '{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}'
    ),
    true
  );
  assert.equal(isQuotaOrRateLimitError('Network timeout error'), false);

  const fallback = buildQuotaFallbackReply({
    userQuery: 'Find top specialty coffee roasters in San Francisco, CA',
    roleId: 'concierge',
    activeCityName: 'San Francisco, CA',
    center: { lat: 37.7749, lng: -122.4194 },
  });

  assert.ok(fallback.reply.includes('Local Concierge'));
  assert.ok(fallback.reply.includes('San Francisco, CA'));
  assert.ok(fallback.suggestedPlaceQuery.length > 0);
  assert.ok(fallback.sources.length >= 2);
  assert.ok(fallback.modelNote.includes('Live Google Maps fallback active'));
});

test('resolveChatLayoutConfig resolves split, wide, and fullscreen AI chat layout modes', () => {
  const split = resolveChatLayoutConfig('split');
  assert.equal(split.mode, 'split');
  assert.ok(split.chatColSpanClass.includes('lg:col-span-6'));
  assert.ok(split.mapColSpanClass.includes('lg:col-span-6'));
  assert.equal(split.showMapInWorkspace, true);

  const wide = resolveChatLayoutConfig('wide');
  assert.equal(wide.mode, 'wide');
  assert.ok(wide.chatColSpanClass.includes('lg:col-span-8'));
  assert.ok(wide.mapColSpanClass.includes('lg:col-span-4'));
  assert.equal(wide.showMapInWorkspace, true);

  const fullscreen = resolveChatLayoutConfig('fullscreen');
  assert.equal(fullscreen.mode, 'fullscreen');
  assert.ok(fullscreen.chatColSpanClass.includes('lg:col-span-12'));
  assert.equal(fullscreen.showMapInWorkspace, false);
});

test('user location default helpers resolve exact coordinates, street addresses, and initial preset', () => {
  assert.equal(
    formatExactCoordinate(37.7955, -122.3937),
    '37.795500°N, 122.393700°W'
  );
  assert.deepEqual(parseCoordinateInput('47.606200, -122.332100'), {
    lat: 47.6062,
    lng: -122.3321,
  });
  assert.equal(parseCoordinateInput('invalid coords'), null);
  assert.equal(parseCoordinateInput('99.5, -122.3'), null);

  assert.equal(
    extractExactStreetAddress('1 Ferry Building, San Francisco, CA 94111, USA'),
    '1 Ferry Building, San Francisco, CA 94111'
  );

  assert.equal(
    findNearestKnownLocality({ lat: 37.789, lng: -122.401 }),
    'San Francisco, CA'
  );
  assert.equal(
    findNearestKnownLocality({ lat: 40.758, lng: -73.9855 }),
    'New York, NY'
  );
  assert.equal(
    findNearestKnownLocality({ lat: 0, lng: 0 }),
    '0.0000°N, 0.0000°E'
  );

  assert.equal(
    extractLocalityFromFormattedAddress('1 Ferry Building, San Francisco, CA 94111, USA'),
    'San Francisco, CA'
  );
  assert.equal(
    extractLocalityFromFormattedAddress('230 W 4th St, New York, NY 10014, USA'),
    'New York, NY'
  );

  const gpsPreset = buildUserLocationPreset({
    coords: { lat: 47.6062, lng: -122.3321 },
    exactAddress: '85 Pike St, Seattle, WA 98101',
    accuracyMeters: 8.4,
    source: 'gps',
  });
  assert.equal(gpsPreset.id, 'user-location');
  assert.equal(gpsPreset.isUserLocation, true);
  assert.equal(gpsPreset.zoom, 16);
  assert.equal(gpsPreset.localityLabel, 'Seattle, WA');
  assert.equal(gpsPreset.exactAddress, '85 Pike St, Seattle, WA 98101');
  assert.equal(gpsPreset.accuracyMeters, 8);
  assert.equal(gpsPreset.name, 'My Location (85 Pike St, Seattle, WA 98101)');

  const tzPreset = resolveInitialUserLocationPreset({
    timeZone: 'America/New_York',
  });
  assert.equal(tzPreset.id, 'user-location');
  assert.equal(tzPreset.source, 'timezone');
  assert.equal(tzPreset.localityLabel, 'New York, NY');
  assert.ok(tzPreset.exactAddress?.includes('Washington Square Park'));

  const cachedPreset = resolveInitialUserLocationPreset({
    cachedJson: JSON.stringify({
      lat: 30.2672,
      lng: -97.7431,
      localityLabel: 'Austin, TX',
      exactAddress: '1100 Congress Ave, Austin, TX 78701',
      accuracyMeters: 12,
    }),
    timeZone: 'America/New_York',
  });
  assert.equal(cachedPreset.id, 'user-location');
  assert.equal(cachedPreset.source, 'cached');
  assert.equal(cachedPreset.localityLabel, 'Austin, TX');
  assert.equal(cachedPreset.exactAddress, '1100 Congress Ave, Austin, TX 78701');
  assert.equal(cachedPreset.accuracyMeters, 12);
});

test('buildInitialGreetingMessage welcomes user with worldwide real-time data coverage', () => {
  const greeting = buildInitialGreetingMessage();
  assert.ok(
    greeting.includes(
      'Welcome to **AtlasPulse**. I am grounded in real-time **Google Maps** and **Google Search** data all over the world.'
    )
  );
  assert.ok(!greeting.includes('around San Francisco, CA'));
  assert.ok(!greeting.includes('around **San Francisco, CA**'));
  assert.ok(greeting.includes('8 specialized AI bots'));
  assert.ok(greeting.includes('Local Concierge'));

  // Should also be worldwide when passing any city name or preset
  const sfGreeting = buildInitialGreetingMessage('San Francisco, CA');
  assert.ok(
    sfGreeting.includes(
      'Welcome to **AtlasPulse**. I am grounded in real-time **Google Maps** and **Google Search** data all over the world.'
    )
  );
  assert.ok(!sfGreeting.includes('around **San Francisco, CA**'));
});



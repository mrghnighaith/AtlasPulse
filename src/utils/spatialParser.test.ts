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



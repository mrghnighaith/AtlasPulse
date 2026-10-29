import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeRawReview,
  extractReviewHighlights,
  summarizePlaceReviews,
  NormalizedReview,
} from './reviewSummarizer';

test('normalizeRawReview handles both Places API (New) authorAttribution and classic PlacesService format', () => {
  // Places API New format
  const rawNew = {
    id: 'places-rev-1',
    authorAttribution: {
      displayName: 'Alice Chen',
      photoURI: 'https://lh3.googleusercontent.com/alice',
      uri: 'https://maps.google.com/contrib/alice',
    },
    rating: 5,
    text: { text: 'Incredible pour-over and freshly baked almond croissants!' },
    relativePublishTimeDescription: '2 days ago',
  };

  const normNew = normalizeRawReview(rawNew, 0);
  assert.equal(normNew.authorName, 'Alice Chen');
  assert.equal(normNew.authorPhotoUrl, 'https://lh3.googleusercontent.com/alice');
  assert.equal(normNew.authorUrl, 'https://maps.google.com/contrib/alice');
  assert.equal(normNew.rating, 5);
  assert.equal(normNew.text, 'Incredible pour-over and freshly baked almond croissants!');
  assert.equal(normNew.relativeTime, '2 days ago');

  // Classic PlacesService format
  const rawClassic = {
    author_name: 'Marcus Vance',
    profile_photo_url: 'https://lh3.googleusercontent.com/marcus',
    author_url: 'https://maps.google.com/contrib/marcus',
    rating: 4.2,
    text: 'Friendly staff and prompt service even during peak hours.',
    relative_time_description: 'a week ago',
    time: 1710000000,
  };

  const normClassic = normalizeRawReview(rawClassic, 1);
  assert.equal(normClassic.authorName, 'Marcus Vance');
  assert.equal(normClassic.rating, 4);
  assert.equal(normClassic.text, 'Friendly staff and prompt service even during peak hours.');
  assert.equal(normClassic.relativeTime, 'a week ago');
  assert.equal(normClassic.publishTimeMs, 1710000000000);
});

test('extractReviewHighlights detects keywords for atmosphere, service, quality, and location', () => {
  const sampleReviews: NormalizedReview[] = [
    {
      id: '1',
      authorName: 'Sarah',
      rating: 5,
      relativeTime: 'yesterday',
      text: 'Superb quality and perfection in every pastry! The friendly staff made us feel so welcoming.',
    },
    {
      id: '2',
      authorName: 'David',
      rating: 5,
      relativeTime: '3 days ago',
      text: 'Cozy vibes, lovely decor and relaxed atmosphere with a scenic view of the park.',
    },
  ];

  const highlights = extractReviewHighlights(sampleReviews);
  assert.ok(highlights.includes('Exceptional Quality'));
  assert.ok(highlights.includes('Warm & Attentive Staff'));
  assert.ok(highlights.includes('Great Atmosphere'));
  assert.ok(highlights.includes('Scenic / Prime Location'));
});

test('summarizePlaceReviews computes rating distribution, top-rated filter, and synthesis blurb', () => {
  const reviews: NormalizedReview[] = [
    { id: '1', authorName: 'R1', rating: 5, relativeTime: '1d', text: 'Stunning espresso and great vibe.' },
    { id: '2', authorName: 'R2', rating: 4, relativeTime: '2d', text: 'Good tea, prompt service.' },
    { id: '3', authorName: 'R3', rating: 5, relativeTime: '3d', text: 'Unmatched quality, highly recommend.' },
    { id: '4', authorName: 'R4', rating: 2, relativeTime: '4d', text: 'Crowded on Saturday morning.' },
  ];

  const summary = summarizePlaceReviews(reviews, 4.6, 1250);
  assert.equal(summary.averageRating, 4.6);
  assert.equal(summary.totalRatingsCount, 1250);
  assert.equal(summary.reviewsCount, 4);
  assert.equal(summary.ratingDistribution[5], 2);
  assert.equal(summary.ratingDistribution[4], 1);
  assert.equal(summary.ratingDistribution[2], 1);
  assert.equal(summary.ratingDistribution[1], 0);

  // Top rated reviews should include 4 and 5 star reviews
  assert.equal(summary.topRatedReviews.length, 3);
  assert.ok(summary.topRatedReviews.every((r) => r.rating >= 4));

  // Positive percentage (5 + 4 out of 4 = 75%)
  assert.equal(summary.positivePercentage, 75);
  assert.ok(summary.generatedSummary.includes('4.6/5'));
  assert.ok(summary.generatedSummary.includes('1,250'));
});

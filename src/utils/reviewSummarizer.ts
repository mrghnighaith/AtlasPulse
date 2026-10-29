export interface NormalizedReview {
  id: string;
  authorName: string;
  authorPhotoUrl?: string;
  authorUrl?: string;
  rating: number;
  relativeTime: string;
  text: string;
  publishTimeMs?: number;
}

export interface ReviewRatingDistribution {
  5: number;
  4: number;
  3: number;
  2: number;
  1: number;
}

export interface ReviewSummaryResult {
  averageRating: number;
  totalRatingsCount: number;
  reviewsCount: number;
  ratingDistribution: ReviewRatingDistribution;
  positivePercentage: number;
  topRatedReviews: NormalizedReview[];
  sentimentHighlights: string[];
  editorialSummary?: string;
  generatedSummary: string;
}

/**
 * Normalizes review objects from either Google Maps Places API (New) or classic PlacesService.
 */
export function normalizeRawReview(raw: any, index: number): NormalizedReview {
  // Support Places API New: { rating, text: { text: "..." } or "...", authorAttribution: { displayName, photoURI, uri } }
  // Support Classic PlacesService: { rating, text: "...", author_name, profile_photo_url, author_url, relative_time_description, time }
  const authorName =
    raw?.authorAttribution?.displayName ||
    raw?.author_name ||
    raw?.authorName ||
    `Verified Visitor ${index + 1}`;

  const authorPhotoUrl =
    raw?.authorAttribution?.photoURI ||
    raw?.profile_photo_url ||
    raw?.authorPhotoUrl ||
    undefined;

  const authorUrl =
    raw?.authorAttribution?.uri ||
    raw?.author_url ||
    raw?.authorUrl ||
    undefined;

  let text = '';
  if (typeof raw?.text === 'string') {
    text = raw.text;
  } else if (raw?.text?.text) {
    text = raw.text.text;
  } else if (typeof raw?.originalText === 'string') {
    text = raw.originalText;
  } else if (raw?.originalText?.text) {
    text = raw.originalText.text;
  }

  const rating = typeof raw?.rating === 'number' ? Math.max(1, Math.min(5, Math.round(raw.rating))) : 5;
  const relativeTime =
    raw?.relativePublishTimeDescription ||
    raw?.relative_time_description ||
    raw?.relativeTime ||
    'Recent review';

  const publishTimeMs =
    typeof raw?.time === 'number'
      ? raw.time * 1000
      : typeof raw?.publishTime === 'string'
      ? new Date(raw.publishTime).getTime()
      : undefined;

  const id = raw?.id || raw?.name || `review-${index}-${authorName.replace(/\s+/g, '-').toLowerCase()}`;

  return {
    id,
    authorName,
    authorPhotoUrl,
    authorUrl,
    rating,
    relativeTime,
    text: text.trim(),
    publishTimeMs,
  };
}

/**
 * Extracts positive keywords and sentiment highlights from reviews.
 */
export function extractReviewHighlights(reviews: NormalizedReview[]): string[] {
  const highlightDict = [
    { label: 'Exceptional Quality', keywords: ['quality', 'exceptional', 'perfection', 'outstanding', 'best in town', 'superb'] },
    { label: 'Warm & Attentive Staff', keywords: ['friendly', 'welcoming', 'staff', 'service', 'hospitality', 'attentive', 'kind'] },
    { label: 'Great Atmosphere', keywords: ['ambiance', 'atmosphere', 'vibes', 'cozy', 'aesthetic', 'interior', 'decor', 'music'] },
    { label: 'Fast & Efficient', keywords: ['quick', 'fast', 'prompt', 'efficient', 'no wait', 'smooth'] },
    { label: 'Fresh & Artisanal', keywords: ['fresh', 'roast', 'handmade', 'freshly baked', 'baked in-house', 'artisan', 'craft'] },
    { label: 'Scenic / Prime Location', keywords: ['view', 'location', 'scenic', 'patio', 'neighborhood', 'convenient', 'terrace'] },
    { label: 'Great Value', keywords: ['value', 'worth it', 'generous', 'affordable', 'reasonable price'] },
  ];

  const matched = new Set<string>();
  const combinedText = reviews.map((r) => r.text.toLowerCase()).join(' ');

  for (const item of highlightDict) {
    if (item.keywords.some((kw) => combinedText.includes(kw))) {
      matched.add(item.label);
    }
  }

  if (matched.size === 0 && reviews.length > 0) {
    matched.add('Highly Recommended by Visitors');
    matched.add('Consistent Top Ratings');
  }

  return Array.from(matched).slice(0, 5);
}

/**
 * Summarizes user reviews, computes distributions, extracts top-rated items, and builds an editorial synthesis.
 */
export function summarizePlaceReviews(
  reviews: NormalizedReview[],
  overallRating?: number,
  totalRatingsCount?: number,
  editorialSummary?: string
): ReviewSummaryResult {
  const distribution: ReviewRatingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

  let sumRatings = 0;
  reviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[star] += 1;
    sumRatings += r.rating;
  });

  const avgFromReviews = reviews.length > 0 ? Number((sumRatings / reviews.length).toFixed(1)) : 0;
  const finalAverage = overallRating !== undefined && overallRating > 0 ? overallRating : avgFromReviews;
  const finalTotalCount = totalRatingsCount !== undefined && totalRatingsCount > 0 ? totalRatingsCount : reviews.length;

  // Filter and sort top-rated reviews (rating >= 4 preferred, sorted desc by rating, then text length/detail)
  const topRatedReviews = [...reviews]
    .filter((r) => r.rating >= 4 || reviews.length <= 3)
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return (b.text.length || 0) - (a.text.length || 0);
    });

  const positiveCount = (distribution[5] || 0) + (distribution[4] || 0);
  const positivePercentage = reviews.length > 0 ? Math.round((positiveCount / reviews.length) * 100) : 100;

  const sentimentHighlights = extractReviewHighlights(reviews);

  // Generate a concise 2-sentence summary synthesizing rating, sentiment, and top review details
  let generatedSummary = '';
  if (editorialSummary) {
    generatedSummary = editorialSummary;
  } else if (reviews.length > 0) {
    const highlightsText = sentimentHighlights.length > 0
      ? `frequently praising ${sentimentHighlights.slice(0, 2).map((h) => h.toLowerCase()).join(' and ')}`
      : 'highlighting consistent visitor satisfaction';

    generatedSummary = `Visitors give this location a stellar ${finalAverage.toFixed(1)}/5 rating (${finalTotalCount.toLocaleString()} total reviews), ${highlightsText}. Most reviewers commend the overall presentation, atmosphere, and service reliability.`;
  } else {
    generatedSummary = `Rated ${finalAverage.toFixed(1)}/5 based on ${finalTotalCount.toLocaleString()} Google Maps user ratings. Detailed individual customer reviews are pending or restricted.`;
  }

  return {
    averageRating: finalAverage,
    totalRatingsCount: finalTotalCount,
    reviewsCount: reviews.length,
    ratingDistribution: distribution,
    positivePercentage,
    topRatedReviews,
    sentimentHighlights,
    editorialSummary,
    generatedSummary,
  };
}

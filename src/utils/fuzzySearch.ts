/**
 * Fuzzy search utility similar to VS Code's command palette
 * Allows partial matching where search terms can match different parts of the target string
 * Example: "pho circle" matches "photo-in-circle"
 */

export interface FuzzyMatch {
  score: number;
  matches: number[];
}

/**
 * Performs fuzzy search on a target string
 * @param searchTerm - The search query (e.g., "pho circle")
 * @param target - The string to search in (e.g., "photo-in-circle")
 * @returns FuzzyMatch object with score and match positions, or null if no match
 */
export function fuzzyMatch(
  searchTerm: string,
  target: string
): FuzzyMatch | null {
  const search = searchTerm.toLowerCase().trim();
  const text = target.toLowerCase();

  if ( !search ) {
    return {
      score: 0,
      matches: []
    };
  }

  // Split search into words
  const searchWords = search.split( /\s+/ );
  let totalScore = 0;
  const allMatches: number[] = [];

  // Each word must match somewhere in the target
  for ( const word of searchWords ) {
    let wordIndex = 0;
    let textIndex = 0;
    let wordScore = 0;
    let consecutiveMatches = 0;
    const wordMatches: number[] = [];
    let lastMatchIndex = -1;

    while ( wordIndex < word.length && textIndex < text.length ) {
      if ( word[ wordIndex ] === text[ textIndex ] ) {
        wordMatches.push( textIndex );

        // Bonus for consecutive matches
        if ( textIndex === lastMatchIndex + 1 ) {
          consecutiveMatches++;
          wordScore += 5 + consecutiveMatches;
        } else {
          consecutiveMatches = 0;
          wordScore += 1;
        }

        // Bonus for matching at word boundaries
        if (
          textIndex === 0 ||
          text[ textIndex - 1 ] === "-" ||
          text[ textIndex - 1 ] === "_" ||
          text[ textIndex - 1 ] === " "
        ) {
          wordScore += 10;
        }

        lastMatchIndex = textIndex;
        wordIndex++;
      }
      textIndex++;
    }

    // If we didn't match all characters in this word, no match
    if ( wordIndex < word.length ) {
      return null;
    }

    totalScore += wordScore;
    allMatches.push( ...wordMatches );
  }

  return {
    score: totalScore,
    matches: allMatches
  };
}

/**
 * Filters and sorts an array of items based on fuzzy search
 * @param items - Array of items to search
 * @param searchTerm - The search query
 * @param getSearchableText - Function to extract searchable text from an item
 * @returns Filtered and sorted array of items
 */
export function fuzzyFilter<T>(
  items: T[],
  searchTerm: string,
  getSearchableText: ( item: T ) => string | string[]
): T[] {
  if ( !searchTerm.trim() ) {
    return items;
  }

  const results: Array<{
    item: T;
    score: number;
  }> = [];

  for ( const item of items ) {
    const searchableTexts = getSearchableText( item );
    const textsArray = Array.isArray( searchableTexts )
      ? searchableTexts
      : [
        searchableTexts
      ];

    let bestScore = -1;

    for ( const text of textsArray ) {
      const match = fuzzyMatch(
        searchTerm,
        text
      );

      if ( match && match.score > bestScore ) {
        bestScore = match.score;
      }
    }

    if ( bestScore > -1 ) {
      results.push( {
        item,
        score: bestScore
      } );
    }
  }

  // Sort by score (higher is better)
  results.sort( (
    a, b
  ) => b.score - a.score );

  return results.map( ( r ) => r.item );
}

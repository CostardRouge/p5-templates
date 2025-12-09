import { NextRequest } from 'next/server';
import { getAllTemplates, getTemplatesByCategory, searchTemplates } from '@/lib/gsap/templateRegistry';

/**
 * GET /api/templates/gsap
 * List all available GSAP templates
 * 
 * Query params:
 * - category: Filter by category (photo, text, motion, mixed)
 * - search: Search by name or description
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');
  const search = searchParams.get('search');

  try {
    let templates;

    if (search) {
      templates = searchTemplates(search);
    } else if (category) {
      templates = getTemplatesByCategory(category as any);
    } else {
      templates = getAllTemplates();
    }

    return Response.json({
      templates,
      count: templates.length,
    });
  } catch (error) {
    console.error('Failed to list templates:', error);
    return Response.json(
      { error: 'Failed to list templates' },
      { status: 500 }
    );
  }
}

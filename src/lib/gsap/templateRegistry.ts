/**
 * GSAP Template Registry
 * Discovers and manages available GSAP templates
 */

import { GSAPTemplateMetadata } from '@/types/gsap-template.types';

/**
 * Registry of available GSAP templates
 * In a production app, this could be dynamically generated from the filesystem
 */
export const gsapTemplates: GSAPTemplateMetadata[] = [
  {
    id: 'photo-exif',
    name: 'Photo EXIF',
    description: 'Animated photo display with EXIF metadata overlay',
    category: 'photo',
    thumbnail: '/templates/gsap/photo-exif/thumbnail.png',
    defaultOptions: {
      animation: {
        duration: 5,
        framerate: 30,
      },
      photo: {
        image: null,
        margin: 0.1,
        backgroundColor: [255, 255, 255],
      },
      font: {
        face: 'martian',
        size: 20,
        color: [0, 0, 0],
        stroke: [255, 255, 255],
      },
      textOverrides: {
        topLeft: '',
        topRight: '',
        bottomLeft: '',
        bottomRight: '',
      },
    },
  },
];

/**
 * Get all GSAP templates
 */
export function getAllTemplates(): GSAPTemplateMetadata[] {
  return gsapTemplates;
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): GSAPTemplateMetadata | undefined {
  return gsapTemplates.find((t) => t.id === id);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: GSAPTemplateMetadata['category']
): GSAPTemplateMetadata[] {
  return gsapTemplates.filter((t) => t.category === category);
}

/**
 * Search templates by name or description
 */
export function searchTemplates(query: string): GSAPTemplateMetadata[] {
  const lowerQuery = query.toLowerCase();
  return gsapTemplates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery)
  );
}

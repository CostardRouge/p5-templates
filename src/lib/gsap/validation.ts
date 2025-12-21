/**
 * Validation utilities for GSAP template options
 */

import {
  GSAPTemplateOptions,
  GSAPAnimationOptions,
} from "@/types/gsap-template.types";

/**
 * Validation error class
 */
export class TemplateValidationError extends Error {
  constructor( message: string ) {
    super( message );
    this.name = "TemplateValidationError";
  }
}

/**
 * Validate animation options
 */
export function validateAnimationOptions( options: unknown ): options is GSAPAnimationOptions {
  if ( !options || typeof options !== "object" ) {
    throw new TemplateValidationError( "Animation options must be an object" );
  }

  const opts = options as Record<string, unknown>;

  if ( typeof opts.duration !== "number" || opts.duration <= 0 ) {
    throw new TemplateValidationError( "Animation duration must be a positive number" );
  }

  if ( typeof opts.framerate !== "number" || opts.framerate <= 0 ) {
    throw new TemplateValidationError( "Animation framerate must be a positive number" );
  }

  if ( opts.duration > 300 ) {
    throw new TemplateValidationError( "Animation duration cannot exceed 300 seconds (5 minutes)" );
  }

  if ( opts.framerate > 120 ) {
    throw new TemplateValidationError( "Animation framerate cannot exceed 120 fps" );
  }

  return true;
}

/**
 * Validate template options structure
 */
export function validateTemplateOptions( options: unknown ): options is GSAPTemplateOptions {
  if ( !options || typeof options !== "object" ) {
    throw new TemplateValidationError( "Template options must be an object" );
  }

  const opts = options as Record<string, unknown>;

  if ( !opts.animation ) {
    throw new TemplateValidationError( "Template options must include animation settings" );
  }

  validateAnimationOptions( opts.animation );

  return true;
}

/**
 * Type guard for checking if value is a valid RGB color array
 */
export function isRGBColor( value: unknown ): value is [number, number, number] {
  return (
    Array.isArray( value ) &&
    value.length === 3 &&
    value.every( ( v ) => typeof v === "number" && v >= 0 && v <= 255 )
  );
}

/**
 * Validate RGB color
 */
export function validateRGBColor(
  value: unknown, fieldName: string
): void {
  if ( !isRGBColor( value ) ) {
    throw new TemplateValidationError( `${ fieldName } must be an RGB array [r, g, b] with values 0-255` );
  }
}

/**
 * Safe parse JSON with validation
 */
export function safeParseOptions<T extends GSAPTemplateOptions>(
  json: string,
  validator?: ( options: unknown ) => options is T
): T {
  try {
    const parsed = JSON.parse( json );

    if ( validator ) {
      if ( !validator( parsed ) ) {
        throw new TemplateValidationError( "Options validation failed" );
      }
    } else {
      validateTemplateOptions( parsed );
    }

    return parsed as T;
  } catch ( error ) {
    if ( error instanceof TemplateValidationError ) {
      throw error;
    }
    throw new TemplateValidationError( `Failed to parse options: ${ error instanceof Error ? error.message : "Unknown error" }` );
  }
}

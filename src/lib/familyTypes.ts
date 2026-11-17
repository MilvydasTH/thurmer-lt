import type { Recipe } from './types';

/** A recipe as it travels between family members: personal bits (favourite, cookbooks) stay on each phone. */
export type SharedRecipe = Omit<Recipe, 'favorite' | 'cookbookIds'>;

export interface FamilyMember {
  id: string;
  name: string;
}

/** One change to the family library. `recipe` is absent when the recipe was deleted. */
export interface FamilyChange {
  id: string;
  updatedAt: number;
  deleted?: boolean;
  recipe?: SharedRecipe;
  /** The recipe photo as base64 JPEG, when it lives on the sender's phone rather than at a web address. */
  imageData?: string;
  /** Name of the member who made the change. */
  by?: string;
}

export interface FamilyInfo {
  code: string;
  name: string;
  members: FamilyMember[];
}

export type FamilyRequest =
  | { action: 'create'; familyName: string; memberName: string }
  | { action: 'join'; code: string; memberName: string }
  | { action: 'sync'; code: string; memberId: string; cursor: number; push: FamilyChange[] }
  | { action: 'leave'; code: string; memberId: string };

export type FamilyResponse =
  | { ok: true; family: FamilyInfo; memberId: string }
  | { ok: true; family: FamilyInfo; cursor: number; changes: FamilyChange[]; more: boolean }
  | { ok: true; left: true }
  | { ok: false; error: 'not_found' | 'not_member' | 'bad_request' | 'too_large' | 'full' | 'rate_limited' | 'storage' };

/** Invite codes avoid look-alike characters (0/O, 1/I/L) because they get read out over the phone. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 10;

export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function prettyCode(code: string): string {
  return code.replace(/(.{5})(?=.)/g, '$1-');
}

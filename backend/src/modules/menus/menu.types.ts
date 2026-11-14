import { MealType } from '@prisma/client';

export type MenuOptionInput = {
  id?: string;
  title: string;
  displayOrder?: number;
};

export type ConfiguredMeal = {
  mealDate: Date;
  mealType: MealType;
  options: { id?: string; title: string; displayOrder: number }[];
};

export type MenuValidationIssue = {
  sheet?: string;
  row?: number;
  field?: string;
  message: string;
};

export const ImportPolicy = {
  KeepExistingOrders: 'KEEP_EXISTING_ORDERS',
  ExactMatchOnly: 'EXACT_MATCH_ONLY',
  Reset: 'RESET',
} as const;

export type ImportPolicy = (typeof ImportPolicy)[keyof typeof ImportPolicy];

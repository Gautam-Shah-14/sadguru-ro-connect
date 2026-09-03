import { buildDueList } from "../../shared/domain";
import type { DueItem } from "../../shared/types";
import { listCustomers } from "./customers";
import { getSettings } from "./settings";

export function dueList(): DueItem[] {
  const settings = getSettings();
  return buildDueList(listCustomers(), settings.reminderDays);
}

-- Merges the redundant "deadline" column into the single SMART "Time-bound"
-- dimension (timeBound). deadline was a separate date picker that duplicated
-- the Time-bound concept; it is now derived from timeBound where needed
-- (e.g. the Progress tracker sync). Only the two SMART tables are affected.
ALTER TABLE "ProjectSmartGoal" DROP COLUMN "deadline";--> statement-breakpoint
ALTER TABLE "SmartGoalVersion" DROP COLUMN "deadline";

export {
  createTeam,
  getTeam,
  listTeams,
  updateTeam,
  deleteTeam,
  addSlot,
  updateSlot,
  removeSlot,
  clearSlots,
  reorderSlots,
  domainSlotToDb,
  dbTeamToDomain,
  dbSlotToDomain,
  cleanupEmptyTeams,
} from "./team.service"
export type { DbSlotRow } from "./team.service"
export { validateTeam } from "./validation.service"
export {
  importShowdownPaste,
  importIntoTeam,
  exportShowdownPaste,
  createTeamFromExtractedData,
} from "./import-export.service"
export {
  fingerprintFromPaste,
  fingerprintFromSlots,
  fingerprintFromExtracted,
  compareFingerprints,
  findMatchingTeams,
} from "./team-matcher.service"
export type { TeamFingerprint, MatchLevel, TeamMatchResult } from "./team-matcher.service"
export {
  createSampleTeam,
  listSampleTeams,
  getSampleTeam,
  deleteSampleTeam,
  importSampleTeamsFromPastes,
  extractPokemonIds,
} from "./sample-team.service"
export type { SampleTeamData } from "./sample-team.service"
export {
  forkTeam,
  compareTeams,
  mergeTeams,
  getLineageTree,
  getTeamHistory,
  archiveTeam,
  restoreTeam,
} from "./version.service"

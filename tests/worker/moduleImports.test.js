import test from "node:test";
import assert from "node:assert/strict";

const MODULES = [
  "../../src/database/aircraftRepository.js",
  "../../src/database/classCommentRepository.js",
  "../../src/database/connectionRepository.js",
  "../../src/database/flightRepository.js",
  "../../src/database/groupRepository.js",
  "../../src/database/historyRepository.js",
  "../../src/database/importRepository.js",
  "../../src/database/loadRepository.js",
  "../../src/database/manualChangeRepository.js",
  "../../src/database/particularityRepository.js",
  "../../src/database/passengerRepository.js",
  "../../src/database/repositoryUtils.js",
  "../../src/database/ticketDocumentRepository.js",
  "../../src/database/timingRepository.js",
  "../../src/import/importFlightData.js",
  "../../src/models/aircraftModel.js",
  "../../src/models/connectionModel.js",
  "../../src/models/flightImportModel.js",
  "../../src/models/flightModel.js",
  "../../src/models/groupModel.js",
  "../../src/models/importModel.js",
  "../../src/models/loadModel.js",
  "../../src/models/modelUtils.js",
  "../../src/models/particularityModel.js",
  "../../src/models/passengerModel.js",
  "../../src/models/ticketDocumentModel.js",
  "../../src/models/timingModel.js",
  "../../src/utils/comparisonUtils.js",
  "../../src/utils/dateUtils.js",
  "../../src/utils/documentUtils.js",
  "../../src/utils/flightIdentityUtils.js",
  "../../src/utils/issueFactory.js",
  "../../src/utils/normalizePassengerName.js",
  "../../src/utils/normalizeSeat.js",
  "../../src/utils/overrideUtils.js",
  "../../src/utils/scopeUtils.js",
  "../../src/utils/ssrUtils.js",
  "../../src/utils/timeUtils.js",
  "../../src/worker.js",
];

test("every source module resolves as an ES Module", async () => {
  const modules = await Promise.all(MODULES.map((specifier) => import(specifier)));
  assert.equal(modules.length, MODULES.length);
  assert.ok(modules.every((module) => module && typeof module === "object"));
});

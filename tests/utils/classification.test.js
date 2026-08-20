import test from "node:test";
import assert from "node:assert/strict";

import { classifyDocument } from "../../src/utils/documentUtils.js";
import { classifySsrCode } from "../../src/utils/ssrUtils.js";

test("known SSR codes use the validated common mapping", () => {
  assert.deepEqual(classifySsrCode("WCHR"), {
    category: "PRM",
    code: "WCHR",
  });
  assert.deepEqual(classifySsrCode("UM_DECLINED"), {
    category: "UM",
    code: "UM_DECLINED",
  });
});

test("special meals are accepted from explicit context without a whitelist", () => {
  assert.deepEqual(classifySsrCode("FIXTURE_MEAL", { isSpecialMeal: true }), {
    category: "MEAL",
    code: "FIXTURE_MEAL",
  });
});

test("unknown SSR codes are retained exactly under OTHER", () => {
  assert.deepEqual(classifySsrCode(" X9-FIXTURE "), {
    category: "OTHER",
    code: " X9-FIXTURE ",
  });
});

test("document classification requires explicit ETKT or EMD context", () => {
  const fixtureNumber = "9999999999999";

  assert.deepEqual(classifyDocument({ value: fixtureNumber }), {
    type: "UNCLASSIFIED",
    document_value: fixtureNumber,
  });
  assert.deepEqual(
    classifyDocument({ value: fixtureNumber, explicitType: "ETKT" }),
    { type: "ETKT", etkt_number: fixtureNumber },
  );
  assert.deepEqual(
    classifyDocument({
      value: fixtureNumber,
      explicitType: "EMD",
      associated_code: "FIXTURE",
    }),
    {
      type: "EMD",
      emd_number: fixtureNumber,
      associated_code: "FIXTURE",
    },
  );
});

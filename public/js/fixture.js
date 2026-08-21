const MONTHS = Object.freeze([
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
]);

function rawFixtureDate(isoDate) {
  const [, month, day] = isoDate.split("-");
  return `${day}${MONTHS[Number(month) - 1]}`;
}

function uniqueFixtureToken() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.getRandomValues(new Uint32Array(1))[0]
    .toString(36)
    .toUpperCase();
  return `${timestamp}${random}`.slice(-8);
}

export function createBrowserFixture(serviceDateInternal) {
  const token = uniqueFixtureToken();
  const flightNumber = `T${token}`;
  const dateToken = serviceDateInternal.replaceAll("-", "");
  const flightId = `ZZ-${flightNumber}-${dateToken}-TST-LAB`;

  return {
    flight: {
      airline: "ZZ",
      flight_number: flightNumber,
      service_date_raw: rawFixtureDate(serviceDateInternal),
      service_date_internal: serviceDateInternal,
      origin: "TST",
      destination: "LAB",
      movement_type: "DEPARTURE",
      flight_id: flightId,
    },
    timings: {
      std: "08:30",
      etd: "08:45",
      boarding_time: "07:40",
      flight_status: "SCHEDULED",
      acceptance_status: "OPEN",
      status_validated_at: new Date().toISOString(),
      status_validated_by: "LOT2_FIXTURE_UI",
    },
    aircraft: {
      type: "TEST-AIRCRAFT",
      seatmap_id: "FIXTURE-SEATMAP",
      cabin_configuration: [
        { class: "TEST_PREMIUM", capacity: 8 },
        { class: "TEST_STANDARD", capacity: 24 },
      ],
    },
    load: {
      booked: [
        { class: "TEST_PREMIUM", value: 5 },
        { class: "TEST_STANDARD", value: 0 },
      ],
      accepted: [
        { class: "TEST_PREMIUM", value: 1 },
        { class: "TEST_STANDARD", value: null },
      ],
      standby: [{ class: "TEST_STANDARD", value: 0 }],
      booked_infants: 1,
      accepted_infants: null,
    },
    passengers: [
      {
        temp_id: "FIXTURE-ADT-1",
        passenger_name_raw: "FIXTURE/ADULT01",
        passenger_type: "ADT",
        cabin_class: "TEST_PREMIUM",
        booking_class: "TP",
        seat: "01 A",
        remark: "DONNÉE DE TEST LOT 2",
      },
      {
        temp_id: "FIXTURE-INF-1",
        passenger_name_raw: "FIXTURE/INFANT01",
        passenger_type: "INF",
        parent_ref: "FIXTURE-ADT-1",
        cabin_class: "TEST_PREMIUM",
        booking_class: "TI",
        remark: "PASSAGER INF FIXTURE DISTINCT",
      },
    ],
    particularities: [
      {
        category: "INFANT",
        pax_count: 1,
        codes: [{ code: "INFT", count: 1 }],
        passenger_ids: ["FIXTURE-INF-1"],
      },
      {
        category: "OTHER",
        pax_count: 1,
        codes: [{ code: "FIXTURE_UNKNOWN_SSR", count: 1 }],
        passenger_ids: ["FIXTURE-ADT-1"],
      },
    ],
    tickets_documents: {
      etkt: [
        {
          number: `FIXTURE-ETKT-${token}`,
          passenger_id: "FIXTURE-ADT-1",
        },
      ],
      emds: [
        {
          number: `FIXTURE-EMD-${token}`,
          passenger_id: "FIXTURE-ADT-1",
          associated_code: "FIXTURE_SERVICE",
          remark: "DOCUMENT EXPLICITEMENT IDENTIFIÉ EMD — TEST",
        },
      ],
      unclassified: [
        {
          document_value: `FIXTURE-UNCLASSIFIED-${token}`,
          document_hint: "DOCUMENT AMBIGU DE TEST",
          passenger_id: null,
        },
      ],
    },
    inbound: [
      {
        inbound_flight: "ZZ100T",
        origin: "ORG",
        destination: "TST",
        arrival_time: "06:50",
        connection_time: "01:40",
        pax_count: 2,
        passenger_ids: ["FIXTURE-ADT-1", "FIXTURE-INF-1"],
        remark: "CONNEXION ENTRANTE FIXTURE",
      },
    ],
    outbound_connections: [
      {
        outbound_flight: "ZZ200T",
        origin: "LAB",
        destination: "DST",
        std: "12:10",
        connection_time: "02:30",
        booked: [{ class: "TEST_PREMIUM", pax: 2 }],
        total_pax: 3,
        passenger_ids: ["FIXTURE-ADT-1", "FIXTURE-INF-1"],
        final_destination: "END",
        terminal: "T-FIXTURE",
        gate: "G-FIXTURE",
        remark: "CONNEXION SORTANTE FIXTURE",
      },
    ],
    groups: {
      summary: { group_count: 1, total_group_pax: 2 },
      items: [
        {
          group_name: "GROUPE FIXTURE LOT 2",
          pax_count: 2,
          cabin_class: "TEST_PREMIUM",
          pnr: `T${token.slice(-5)}`,
          remark: "DONNÉE DE TEST",
        },
      ],
    },
    class_comments: [
      {
        class: "TEST_PREMIUM",
        comment: "Commentaire cabine de test Lot 2.",
      },
    ],
    airline_extensions: {},
    import: {},
    issues: [],
  };
}

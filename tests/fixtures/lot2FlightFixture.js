export function createLot2FlightFixture() {
  return {
    flight: {
      airline: "ZZ",
      flight_number: "TEST21",
      service_date_raw: "31DEC",
      service_date_internal: "2099-12-31",
      origin: "TST",
      destination: "LAB",
      movement_type: "DEPARTURE",
      flight_id: "ZZ-TEST21-20991231-TST-LAB",
    },
    timings: {
      std: "08:30",
      etd: "08:45",
      boarding_time: "07:40",
      flight_status: "SCHEDULED",
      acceptance_status: "OPEN",
      status_validated_at: "2099-12-31T06:00:00Z",
      status_validated_by: "LOT2_TEST_OPERATOR",
    },
    aircraft: {
      type: "TEST-AIRCRAFT",
      seatmap_id: "FIXTURE-SEATMAP",
      cabin_configuration: [
        { class: "PREMIUM_FIXTURE", capacity: 8 },
        { class: "STANDARD_FIXTURE", capacity: 24 },
      ],
    },
    load: {
      booked: [
        { class: "PREMIUM_FIXTURE", value: 5 },
        { class: "STANDARD_FIXTURE", value: 0 },
      ],
      accepted: [
        { class: "PREMIUM_FIXTURE", value: 1 },
        { class: "STANDARD_FIXTURE", value: null },
      ],
      standby: [{ class: "STANDARD_FIXTURE", value: 0 }],
      booked_infants: 1,
      accepted_infants: null,
    },
    passengers: [
      {
        temp_id: "PAX-ADT-1",
        passenger_name_raw: "FIXTURE/ADULT01",
        passenger_type: "ADT",
        cabin_class: "PREMIUM_FIXTURE",
        booking_class: "PF",
        seat: "01 A",
        remark: "DONNÉE DE TEST LOT 2",
      },
      {
        temp_id: "PAX-INF-1",
        passenger_name_raw: "FIXTURE/INFANT01",
        passenger_type: "INF",
        parent_ref: "PAX-ADT-1",
        cabin_class: "PREMIUM_FIXTURE",
        booking_class: "IF",
        remark: "PASSAGER INF FIXTURE DISTINCT",
      },
    ],
    particularities: [
      {
        category: "INFANT",
        pax_count: 1,
        codes: [{ code: "INFT", count: 1 }],
        passenger_ids: ["PAX-INF-1"],
      },
      {
        category: "OTHER",
        pax_count: 1,
        codes: [{ code: "FIXTURE_UNKNOWN_SSR", count: 1 }],
        passenger_ids: ["PAX-ADT-1"],
      },
    ],
    tickets_documents: {
      etkt: [
        { number: "FIXTURE-ETKT-0001", passenger_id: "PAX-ADT-1" },
      ],
      emds: [
        {
          number: "FIXTURE-EMD-0001",
          passenger_id: "PAX-ADT-1",
          associated_code: "FIXTURE_SERVICE",
          remark: "DOCUMENT DE TEST EXPLICITEMENT IDENTIFIÉ EMD",
        },
      ],
      unclassified: [
        {
          document_value: "FIXTURE-DOCUMENT-AMBIGU",
          document_hint: "FORMAT NON CLASSÉ DE TEST",
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
        passenger_ids: ["PAX-ADT-1", "PAX-INF-1"],
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
        booked: [{ class: "PREMIUM_FIXTURE", pax: 2 }],
        total_pax: 3,
        passenger_ids: ["PAX-ADT-1", "PAX-INF-1"],
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
          cabin_class: "PREMIUM_FIXTURE",
          pnr: "TESTPNR",
          remark: "DONNÉE DE TEST",
        },
      ],
    },
    class_comments: [
      {
        class: "PREMIUM_FIXTURE",
        comment: "Commentaire cabine de test Lot 2.",
      },
    ],
    airline_extensions: {},
    import: {},
    issues: [],
  };
}

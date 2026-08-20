import {
  assertD1Database,
  updateMappedFields,
} from "./repositoryUtils.js";

const COMMENT_COLUMNS = Object.freeze({
  class: "class_code",
  comment: "comment_text",
});

export function createClassCommentRepository(db) {
  assertD1Database(db);

  return {
    async getByFlightId(flightId) {
      const result = await db
        .prepare(
          "SELECT * FROM flight_class_comments WHERE flight_id = ?1 ORDER BY id",
        )
        .bind(flightId)
        .all();
      return result.results ?? [];
    },

    add(flightId, { class: classCode, comment }) {
      return db
        .prepare(
          `INSERT INTO flight_class_comments (flight_id, class_code, comment_text)
           VALUES (?1, ?2, ?3)`,
        )
        .bind(flightId, classCode, comment)
        .run();
    },

    update(commentId, fields) {
      return updateMappedFields({
        db,
        table: "flight_class_comments",
        whereColumn: "id",
        whereValue: commentId,
        data: fields,
        columnMap: COMMENT_COLUMNS,
      });
    },

    remove(commentId) {
      return db
        .prepare("DELETE FROM flight_class_comments WHERE id = ?1")
        .bind(commentId)
        .run();
    },
  };
}

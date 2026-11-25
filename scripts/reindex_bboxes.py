import os
import json
import sqlite3
import shutil
import fitz
from app.ingestion.parser import parse_pdf, segment_clauses_with_bboxes

DB_PATH = "storage/db/veritas.db"
RENDERED_DIR = "storage/rendered"
UPLOAD_DIR = "storage/uploads"

def reindex_all_bounding_boxes():
    print(f"Connecting to database at {DB_PATH}...")
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    docs = c.execute("SELECT id, name, file_path FROM documents").fetchall()
    print(f"Found {len(docs)} documents in database.")

    total_clauses_updated = 0
    total_oversized_fixed = 0

    for doc_id, doc_name, file_path in docs:
        actual_path = file_path
        if not os.path.exists(actual_path):
            alt_path = os.path.join(UPLOAD_DIR, doc_name)
            if os.path.exists(alt_path):
                actual_path = alt_path
            else:
                continue

        try:
            parsed_pages, _ = parse_pdf(actual_path)
            new_clauses = segment_clauses_with_bboxes(parsed_pages)
        except Exception as e:
            print(f"  [ERROR] Parsing {doc_name}: {e}")
            continue

        # Get existing clauses for this doc from DB
        db_clauses = c.execute("""
            SELECT c.id, c.clause_number, c.section_title, c.bounding_box, p.page_number
            FROM clauses c
            JOIN pages p ON c.page_id = p.id
            WHERE c.document_id = ?
        """, (doc_id,)).fetchall()

        # Map new clauses by (page_number, clause_number)
        new_map = {}
        for nc in new_clauses:
            key = (nc["page_number"], str(nc["clause_number"]).strip())
            new_map[key] = nc

        doc_updated = 0
        for cid, cnum, stitle, old_bbox_json, pnum in db_clauses:
            key = (pnum, str(cnum).strip() if cnum else "Preamble")
            matched = new_map.get(key)
            if not matched:
                # Try matching without exact prefix
                for (p, cn), nc in new_map.items():
                    if p == pnum and cn and cnum and (cn in cnum or cnum in cn):
                        matched = nc
                        break

            new_bbox = matched["bounding_box"] if matched else None
            # Safety limit: reject if area > 8% of standard page
            if new_bbox:
                w = new_bbox[2] - new_bbox[0]
                h = new_bbox[3] - new_bbox[1]
                if w * h > 0.08 * (595.0 * 842.0) or h > 45.0:
                    new_bbox = None
                    total_oversized_fixed += 1

            new_bbox_json = json.dumps(new_bbox) if new_bbox else None
            if new_bbox_json != old_bbox_json:
                c.execute("UPDATE clauses SET bounding_box = ? WHERE id = ?", (new_bbox_json, cid))
                doc_updated += 1
                total_clauses_updated += 1

        if doc_updated > 0:
            print(f"  Updated {doc_updated} clauses in {doc_name}")

    conn.commit()
    conn.close()
    print(f"\n[DONE] Successfully re-indexed database: {total_clauses_updated} clauses updated ({total_oversized_fixed} oversized boxes clamped/cleared).")

    # Purge storage/rendered cache
    if os.path.exists(RENDERED_DIR):
        purged_count = 0
        for f in os.listdir(RENDERED_DIR):
            fpath = os.path.join(RENDERED_DIR, f)
            if os.path.isfile(fpath):
                os.remove(fpath)
                purged_count += 1
        print(f"[CACHE PURGE] Cleared {purged_count} cached images from {RENDERED_DIR}.")

if __name__ == "__main__":
    reindex_all_bounding_boxes()

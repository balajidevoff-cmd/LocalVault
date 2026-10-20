import os
import shutil
import sqlite3
from pathlib import Path

def migrate():
    root = Path(__file__).resolve().parent.parent
    db_path = root / "data" / "db" / "localvault.db"
    storage_root = root / "data" / "storage"
    objects_dir = storage_root / "objects"

    if not db_path.exists():
        print("Database not found.")
        return

    con = sqlite3.connect(str(db_path))
    cur = con.cursor()

    rows = cur.execute("""
        SELECT f.id, f.original_name, f.internal_storage_key, u.username
        FROM files f
        JOIN users u ON f.owner_id = u.id
    """).fetchall()

    print(f"Found {len(rows)} file(s) to inspect for readable migration.")

    for file_id, original_name, internal_key, username in rows:
        user_dir = storage_root / username
        user_dir.mkdir(parents=True, exist_ok=True)

        target_file = user_dir / original_name

        # If already migrated
        if internal_key.startswith(f"{username}/"):
            print(f"Already migrated: {internal_key}")
            continue

        # Look in legacy objects directory: objects/{p1}/{p2}/{key}
        prefix1 = internal_key[:2]
        prefix2 = internal_key[2:4]
        legacy_path = objects_dir / prefix1 / prefix2 / internal_key

        if legacy_path.is_file():
            # If target already exists, avoid collision
            stem, ext = os.path.splitext(original_name)
            candidate = original_name
            counter = 1
            while target_file.exists():
                candidate = f"{stem} ({counter}){ext}"
                target_file = user_dir / candidate
                counter += 1

            shutil.move(str(legacy_path), str(target_file))
            new_internal_key = f"{username}/{target_file.name}"
            cur.execute("UPDATE files SET internal_storage_key = ? WHERE id = ?", (new_internal_key, file_id))
            print(f"Migrated: {legacy_path} -> {target_file}")
        else:
            print(f"Warning: Legacy file not found at {legacy_path}")

    con.commit()
    con.close()

    # Clean up empty legacy objects directory if empty
    if objects_dir.exists():
        try:
            shutil.rmtree(str(objects_dir))
            print("Removed legacy objects/ folder.")
        except Exception as e:
            print(f"Could not remove objects/ folder: {e}")

    print("Migration complete!")

if __name__ == "__main__":
    migrate()

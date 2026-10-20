import sys
import sqlite3
from pathlib import Path

def backup_sqlite(source_db_path: str, destination_db_path: str) -> None:
    src_file = Path(source_db_path).resolve()
    dst_file = Path(destination_db_path).resolve()

    if not src_file.is_file():
        raise FileNotFoundError(f"Source database file not found: {src_file}")

    dst_file.parent.mkdir(parents=True, exist_ok=True)

    print(f"Connecting to source database: {src_file}")
    src_conn = sqlite3.connect(str(src_file))
    dst_conn = sqlite3.connect(str(dst_file))

    try:
        with dst_conn:
            src_conn.backup(dst_conn, pages=1000)
        print("SQLite transactional backup completed successfully.")
    finally:
        dst_conn.close()
        src_conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python sqlite_backup.py <source_db> <dest_db>")
        sys.exit(1)
    backup_sqlite(sys.argv[1], sys.argv[2])
